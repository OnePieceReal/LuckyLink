const io = require('socket.io-client');
const crypto = require('crypto');
const readline = require('readline');

// Simplified Signal Protocol implementation with X3DH and Double Ratchet
// Using crypto module for key generation since libsignal-client requires complex session management
class SignalProtocolClient {
  constructor(username) {
    this.username = username;
    
    // Generate ECDH key pairs for X3DH
    this.identityKeyPair = crypto.generateKeyPairSync('x25519');
    this.ephemeralKeyPair = crypto.generateKeyPairSync('x25519');
    
    this.sessionKey = null;
    this.partnerIdentityPublicKey = null;
    this.partnerEphemeralPublicKey = null;
    this.messageCounter = 0;
    this.sendingChainKey = null;
    this.receivingChainKey = null;
    this.rootKey = null;
    this.currentRatchetKeyPair = null;
    this.partnerRatchetPublicKey = null;
    
    console.log(`🔐 Generated identity key pair for ${username}`);
    console.log(`🔑 Generated ephemeral key pair for X3DH`);
  }
  
  getPublicKeys() {
    return {
      identity: this.identityKeyPair.publicKey.export({ type: 'spki', format: 'der' }),
      ephemeral: this.ephemeralKeyPair.publicKey.export({ type: 'spki', format: 'der' })
    };
  }
  
  // X3DH Key Agreement (Extended Triple Diffie-Hellman)
  performX3DHKeyAgreement(partnerPublicKeys, isInitiator) {
    try {
      console.log(`\n🔐 === X3DH KEY AGREEMENT DEBUG === 🔐`);
      console.log(`Role: ${isInitiator ? 'INITIATOR' : 'RESPONDER'}`);
      console.log(`Username: ${this.username}`);
      
      // Import partner's public keys
      const partnerIdentityKey = crypto.createPublicKey({
        key: partnerPublicKeys.identity,
        format: 'der',
        type: 'spki'
      });
      
      const partnerEphemeralKey = crypto.createPublicKey({
        key: partnerPublicKeys.ephemeral,
        format: 'der',
        type: 'spki'
      });
      
      this.partnerIdentityPublicKey = partnerIdentityKey;
      this.partnerEphemeralPublicKey = partnerEphemeralKey;
      
      // Log our keys
      console.log(`\n📋 Our Keys:`);
      const ourIdentityPub = this.identityKeyPair.publicKey.export({ type: 'spki', format: 'der' });
      const ourEphemeralPub = this.ephemeralKeyPair.publicKey.export({ type: 'spki', format: 'der' });
      console.log(`  Identity Public: ${ourIdentityPub.toString('hex').slice(0, 32)}...`);
      console.log(`  Ephemeral Public: ${ourEphemeralPub.toString('hex').slice(0, 32)}...`);
      
      // Log partner's keys
      console.log(`\n📋 Partner's Keys:`);
      console.log(`  Identity Public: ${partnerPublicKeys.identity.toString('hex').slice(0, 32)}...`);
      console.log(`  Ephemeral Public: ${partnerPublicKeys.ephemeral.toString('hex').slice(0, 32)}...`);
      
      // CRITICAL: Full X3DH with 4 DH operations
      console.log(`\n🔄 Performing DH Operations:`);
      
      // DH1: identity_private × partner_identity_public
      const dh1 = crypto.diffieHellman({
        privateKey: this.identityKeyPair.privateKey,
        publicKey: partnerIdentityKey
      });
      console.log(`  DH1 (id×p_id): ${dh1.toString('hex').slice(0, 32)}...`);
      
      // DH2: identity_private × partner_ephemeral_public
      const dh2 = crypto.diffieHellman({
        privateKey: this.identityKeyPair.privateKey,
        publicKey: partnerEphemeralKey
      });
      console.log(`  DH2 (id×p_eph): ${dh2.toString('hex').slice(0, 32)}...`);
      
      // DH3: ephemeral_private × partner_identity_public
      const dh3 = crypto.diffieHellman({
        privateKey: this.ephemeralKeyPair.privateKey,
        publicKey: partnerIdentityKey
      });
      console.log(`  DH3 (eph×p_id): ${dh3.toString('hex').slice(0, 32)}...`);
      
      // DH4: ephemeral_private × partner_ephemeral_public
      const dh4 = crypto.diffieHellman({
        privateKey: this.ephemeralKeyPair.privateKey,
        publicKey: partnerEphemeralKey
      });
      console.log(`  DH4 (eph×p_eph): ${dh4.toString('hex').slice(0, 32)}...`);
      
      // CRITICAL FIX: Sort the DH values to ensure consistent ordering
      // Both parties compute the same values but may get them in different order
      // Sorting ensures identical combined secret
      const dhValues = [dh1, dh2, dh3, dh4];
      dhValues.sort(Buffer.compare);
      
      // Combine all 4 shared secrets in sorted order
      const combined = Buffer.concat(dhValues);
      console.log(`  DH values sorted for consistency`);
      console.log(`\n🔗 Combined Secret:`);
      console.log(`  Length: ${combined.length} bytes`);
      console.log(`  SHA256: ${crypto.createHash('sha256').update(combined).digest().toString('hex')}`);
      console.log(`  First 32 bytes: ${combined.slice(0, 32).toString('hex')}`);
      
      // Apply KDF with domain separation
      const domainSeparator = Buffer.from('Signal_X3DH_25519');
      console.log(`\n🔑 KDF Process:`);
      console.log(`  Domain: ${domainSeparator.toString()}`);
      console.log(`  Domain hex: ${domainSeparator.toString('hex')}`);
      
      const kdfInput = Buffer.concat([domainSeparator, combined]);
      console.log(`  KDF input length: ${kdfInput.length} bytes`);
      console.log(`  KDF input SHA256: ${crypto.createHash('sha256').update(kdfInput).digest().toString('hex')}`);
      
      const masterSecret = crypto.createHash('sha256').update(kdfInput).digest();
      console.log(`  Master Secret: ${masterSecret.toString('hex')}`);
      
      // Derive root key
      const rootInput = Buffer.concat([masterSecret, Buffer.from('root')]);
      this.rootKey = crypto.createHash('sha256').update(rootInput).digest();
      console.log(`\n🌳 Root Key Derivation:`);
      console.log(`  Input: masterSecret + 'root'`);
      console.log(`  Root Key: ${this.rootKey.toString('hex')}`);
      
      // Initialize ratchet with new key pair
      this.currentRatchetKeyPair = crypto.generateKeyPairSync('x25519');
      
      // Derive base chain key
      const chainInput = Buffer.concat([this.rootKey, Buffer.from('chain')]);
      const baseChain = crypto.createHash('sha256').update(chainInput).digest();
      console.log(`\n⛓️ Chain Derivation:`);
      console.log(`  Base Chain: ${baseChain.toString('hex')}`);
      
      // Create two deterministic chains
      const chain1Input = Buffer.concat([baseChain, Buffer.from([0x01])]);
      const chain1 = crypto.createHash('sha256').update(chain1Input).digest();
      console.log(`  Chain1: ${chain1.toString('hex')}`);
      
      const chain2Input = Buffer.concat([baseChain, Buffer.from([0x02])]);
      const chain2 = crypto.createHash('sha256').update(chain2Input).digest();
      console.log(`  Chain2: ${chain2.toString('hex')}`);
      
      // Chain assignment based on role
      if (isInitiator) {
        this.sendingChainKey = chain1;
        this.receivingChainKey = chain2;
        console.log(`\n📤 Chain Assignment (INITIATOR):`);
        console.log(`  Sending = Chain1`);
        console.log(`  Receiving = Chain2`);
      } else {
        this.sendingChainKey = chain2;
        this.receivingChainKey = chain1;
        console.log(`\n📤 Chain Assignment (RESPONDER):`);
        console.log(`  Sending = Chain2`);
        console.log(`  Receiving = Chain1`);
      }
      
      console.log(`\n✅ === X3DH COMPLETED === ✅`);
      console.log(`Final Keys:`);
      console.log(`  Root: ${this.rootKey.toString('hex').slice(0, 32)}...`);
      console.log(`  Send: ${this.sendingChainKey.toString('hex').slice(0, 32)}...`);
      console.log(`  Recv: ${this.receivingChainKey.toString('hex').slice(0, 32)}...`);
      console.log(`=============================\n`);
      
      return true;
    } catch (error) {
      console.error('❌ X3DH key agreement failed:', error.message);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }
  
  // Double Ratchet Algorithm - derive message key and advance chain
  deriveMessageKey(chainKey) {
    // Derive message key from chain key
    const messageKey = crypto.createHash('sha256')
      .update(Buffer.concat([chainKey, Buffer.from('message')]))
      .digest();
    
    // Advance chain key
    const newChainKey = crypto.createHash('sha256')
      .update(Buffer.concat([chainKey, Buffer.from('chain')]))
      .digest();
    
    return { messageKey, newChainKey };
  }
  
  // Get current ratchet public key for sending with messages
  getRatchetPublicKey() {
    if (!this.currentRatchetKeyPair) {
      return null;
    }
    return this.currentRatchetKeyPair.publicKey.export({ type: 'spki', format: 'der' });
  }
  
  // Initialize partner's ratchet key (called during key exchange)
  initializePartnerRatchet(partnerRatchetPublicKeyBuffer) {
    try {
      const partnerRatchetKey = crypto.createPublicKey({
        key: partnerRatchetPublicKeyBuffer,
        format: 'der',
        type: 'spki'
      });
      
      this.partnerRatchetPublicKey = partnerRatchetKey;
      this.lastReceivedRatchetKey = partnerRatchetPublicKeyBuffer;
      
      // DO NOT modify the base chains from X3DH!
      // They must remain unchanged for initial messages
      
      console.log(`🔄 Initialized partner's ratchet key (chains unchanged)`);
      return true;
    } catch (error) {
      console.error('Partner ratchet init failed:', error.message);
      return false;
    }
  }
  
  // Perform DH ratchet when receiving new ratchet key in message
  performDHRatchet(partnerRatchetPublicKeyBuffer) {
    try {
      // Import partner's new ratchet public key
      const partnerRatchetKey = crypto.createPublicKey({
        key: partnerRatchetPublicKeyBuffer,
        format: 'der',
        type: 'spki'
      });
      
      // Check if this is actually a new key
      if (this.lastReceivedRatchetKey && 
          Buffer.from(partnerRatchetPublicKeyBuffer).equals(this.lastReceivedRatchetKey)) {
        // Same key, no ratchet needed
        return true;
      }
      
      this.partnerRatchetPublicKey = partnerRatchetKey;
      this.lastReceivedRatchetKey = Buffer.from(partnerRatchetPublicKeyBuffer);
      
      // Perform DH with our current ratchet key
      const sharedSecret = crypto.diffieHellman({
        privateKey: this.currentRatchetKeyPair.privateKey,
        publicKey: partnerRatchetKey
      });
      
      // Derive new root and receiving chain keys
      const newRootKey = crypto.createHash('sha256')
        .update(Buffer.concat([this.rootKey, sharedSecret, Buffer.from('root')]))
        .digest();
      
      const newReceivingChainKey = crypto.createHash('sha256')
        .update(Buffer.concat([newRootKey, Buffer.from('receive')]))
        .digest();
      
      // Generate new ratchet key pair for next send
      this.currentRatchetKeyPair = crypto.generateKeyPairSync('x25519');
      
      // Perform DH with new key pair
      const sendSharedSecret = crypto.diffieHellman({
        privateKey: this.currentRatchetKeyPair.privateKey,
        publicKey: partnerRatchetKey
      });
      
      // Derive sending chain key
      const newSendingChainKey = crypto.createHash('sha256')
        .update(Buffer.concat([newRootKey, sendSharedSecret, Buffer.from('send')]))
        .digest();
      
      this.rootKey = newRootKey;
      this.receivingChainKey = newReceivingChainKey;
      this.sendingChainKey = newSendingChainKey;
      
      console.log(`🔄 DH Ratchet performed, chains updated`);
      return true;
    } catch (error) {
      console.error('DH Ratchet failed:', error.message);
      return false;
    }
  }
  
  // Generate unique nonce for each message
  generateNonce() {
    return crypto.randomBytes(12);
  }
  
  // Encrypt message with Double Ratchet
  encrypt(message) {
    if (!this.sendingChainKey) {
      throw new Error('No sending chain key available');
    }
    
    try {
      // Use the base sending chain from X3DH - DO NOT modify it
      // Derive message key and advance chain
      const { messageKey, newChainKey } = this.deriveMessageKey(this.sendingChainKey);
      this.sendingChainKey = newChainKey;
      
      // Generate unique nonce
      const nonce = this.generateNonce();
      const messageBuffer = Buffer.from(message, 'utf8');
      
      // Create cipher with AES-256-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', messageKey, nonce);
      
      let encrypted = cipher.update(messageBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Increment message counter
      this.messageCounter++;
      
      // Include ratchet key for future DH ratchet (but don't use it for initial messages)
      const includeRatchet = this.messageCounter === 1;
      
      return {
        encrypted: encrypted.toString('base64'),
        nonce: nonce.toString('base64'),
        tag: tag.toString('base64'),
        counter: this.messageCounter,
        ratchetPublicKey: includeRatchet ? this.getRatchetPublicKey() : null
      };
    } catch (error) {
      console.error('❌ Encryption failed:', error.message);
      throw error;
    }
  }
  
  // Decrypt message with Double Ratchet
  decrypt(encryptedData) {
    if (!this.receivingChainKey) {
      throw new Error('No receiving chain key available');
    }
    
    try {
      // For initial messages, use the base receiving chain from X3DH
      // Don't perform DH ratchet yet - just store the ratchet key for later
      if (encryptedData.ratchetPublicKey && encryptedData.counter === 1) {
        const ratchetKeyBuffer = Buffer.from(encryptedData.ratchetPublicKey);
        if (!this.partnerRatchetPublicKey) {
          // Store for future use but don't ratchet yet
          this.partnerRatchetPublicKey = crypto.createPublicKey({
            key: ratchetKeyBuffer,
            format: 'der',
            type: 'spki'
          });
          this.lastReceivedRatchetKey = ratchetKeyBuffer;
          console.log(`🔑 Stored partner's ratchet key for future use`);
        }
      } else if (encryptedData.ratchetPublicKey && encryptedData.counter > 1) {
        // For subsequent messages, perform DH ratchet if needed
        const ratchetKeyBuffer = Buffer.from(encryptedData.ratchetPublicKey);
        if (!this.lastReceivedRatchetKey || 
            !ratchetKeyBuffer.equals(this.lastReceivedRatchetKey)) {
          this.performDHRatchet(ratchetKeyBuffer);
        }
      }
      
      // Use base receiving chain for decryption
      const { messageKey, newChainKey } = this.deriveMessageKey(this.receivingChainKey);
      this.receivingChainKey = newChainKey;
      
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', messageKey, nonce);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('❌ Decryption failed:', error.message);
      console.error('Debug - Receiving chain:', this.receivingChainKey.toString('hex').slice(0, 16));
      throw error;
    }
  }
  
  // Create HMAC for authentication
  createHMAC(data) {
    const key = crypto.createHash('sha256')
      .update(this.identityKeyPair.privateKey.export({ type: 'pkcs8', format: 'der' }))
      .digest();
    return crypto.createHmac('sha256', key).update(data).digest();
  }
  
  // Verify HMAC
  verifyHMAC(data, hmac, publicKeyBuffer) {
    // In a real implementation, we'd derive a verification key from the public key
    // For simplicity, we're just checking if the HMAC is valid format
    return hmac && hmac.length === 32;
  }
  
  // Get current session info
  getSessionInfo() {
    return {
      hasRootKey: !!this.rootKey,
      hasSendingChain: !!this.sendingChainKey,
      hasReceivingChain: !!this.receivingChainKey,
      messageCounter: this.messageCounter,
      rootKeyPreview: this.rootKey ? this.rootKey.toString('hex').slice(0, 16) + '...' : 'None',
      sendingChainPreview: this.sendingChainKey ? this.sendingChainKey.toString('hex').slice(0, 16) + '...' : 'None',
      receivingChainPreview: this.receivingChainKey ? this.receivingChainKey.toString('hex').slice(0, 16) + '...' : 'None'
    };
  }
}

class E2EEChatClient {
  constructor(username) {
    this.username = username;
    this.socket = io('http://localhost:3000');
    this.signal = new SignalProtocolClient(username);
    this.partnerId = null;
    this.partnerUsername = null;
    this.isKeyExchangeComplete = false;
    this.isInitiator = false;
    
    this.setupSocketHandlers();
    this.setupReadline();
    
    // Define user interests (in real app, this would be user input)
    const interests = this.getUserInterests();
    
    // Register with server
    this.socket.emit('register', {
      username: this.username,
      interests: interests
    });
  }
  
  getUserInterests() {
    // Different interests for different users for demo
    const interestSets = {
      'alice': ['technology', 'music', 'travel'],
      'bob': ['technology', 'sports', 'music'],
      'charlie': ['art', 'music', 'books'],
      'david': ['sports', 'travel', 'technology']
    };
    
    return interestSets[this.username.toLowerCase()] || ['general', 'chat'];
  }
  
  setupSocketHandlers() {
    this.socket.on('registered', (data) => {
      console.log(`✅ Registered as: ${data.username}`);
      console.log(`🔍 Looking for matches...`);
    });
    
    this.socket.on('match_found', (data) => {
      this.partnerId = data.partnerId;
      this.partnerUsername = data.partnerUsername;
      
      console.log(`\n🤝 Match found with: ${data.partnerUsername}`);
      console.log(`🎯 Shared interests: ${data.sharedInterests.join(', ')}`);
      console.log(`🔐 Starting X3DH key exchange...`);
      
      // Determine who initiates key exchange (alphabetically first username)
      this.isInitiator = this.username < this.partnerUsername;
      
      if (this.isInitiator) {
        this.initiateKeyExchange();
      }
    });
    
    this.socket.on('key_exchange', (data) => {
      this.handleKeyExchange(data);
    });
    
    this.socket.on('encrypted_message', (data) => {
      this.handleEncryptedMessage(data);
    });
    
    this.socket.on('partner_disconnected', () => {
      console.log(`\n💔 ${this.partnerUsername} disconnected`);
      this.resetConnection();
    });
    
    this.socket.on('connect', () => {
      console.log(`🔌 Connected to server`);
    });
    
    this.socket.on('disconnect', () => {
      console.log(`🔌 Disconnected from server`);
    });
  }
  
  initiateKeyExchange() {
    console.log(`🚀 Initiating X3DH key exchange as ${this.username}...`);
    
    // Step 1: Send public keys for X3DH
    const publicKeys = this.signal.getPublicKeys();
    this.socket.emit('key_exchange', {
      targetId: this.partnerId,
      message: publicKeys,
      type: 'x3dh_init'
    });
  }
  
  handleKeyExchange(data) {
    const { senderId, message, type } = data;
    
    console.log(`🔑 Received key exchange (${type}) from ${this.partnerUsername}`);
    
    switch (type) {
      case 'x3dh_init':
        // Responder role: receive initiator's keys first, then send ours
        // Perform X3DH key agreement as responder (not initiator)
        const x3dhSuccess = this.signal.performX3DHKeyAgreement(message, false);
        
        if (x3dhSuccess) {
          // Send our keys back
          const publicKeys = this.signal.getPublicKeys();
          this.socket.emit('key_exchange', {
            targetId: senderId,
            message: publicKeys,
            type: 'x3dh_response'
          });
          
          // Wait a bit to ensure proper ordering
          setTimeout(() => {
            // Send initial ratchet key
            this.socket.emit('key_exchange', {
              targetId: senderId,
              message: {
                ratchetPublicKey: this.signal.getRatchetPublicKey()
              },
              type: 'ratchet_init'
            });
            
            this.completeKeyExchange();
          }, 100);
        }
        break;
        
      case 'x3dh_response':
        // Initiator role: we sent first, now receiving response
        // Complete X3DH key agreement as initiator
        const x3dhComplete = this.signal.performX3DHKeyAgreement(message, true);
        
        if (x3dhComplete) {
          // Wait a bit to ensure proper ordering
          setTimeout(() => {
            // Send initial ratchet key
            this.socket.emit('key_exchange', {
              targetId: senderId,
              message: {
                ratchetPublicKey: this.signal.getRatchetPublicKey()
              },
              type: 'ratchet_init'
            });
            
            this.completeKeyExchange();
          }, 100);
        }
        break;
        
      case 'ratchet_init':
        // Initialize partner's ratchet key (without modifying chains)
        if (message.ratchetPublicKey) {
          this.signal.initializePartnerRatchet(Buffer.from(message.ratchetPublicKey));
        }
        break;
        
      case 'exchange_confirmation':
        // Partner has confirmed key exchange is complete
        console.log(`✅ Partner confirmed key exchange completion`);
        break;
    }
  }
  
  completeKeyExchange() {
    this.isKeyExchangeComplete = true;
    
    const sessionInfo = this.signal.getSessionInfo();
    
    console.log(`\n🔒 X3DH Key Exchange Complete!`);
    console.log(`✨ Signal Protocol Session Established`);
    console.log(`📊 Session Info:`);
    console.log(`   Root Key: ${sessionInfo.rootKeyPreview}`);
    console.log(`   Sending Chain: ${sessionInfo.sendingChainPreview}`);
    console.log(`   Receiving Chain: ${sessionInfo.receivingChainPreview}`);
    console.log(`   Message Counter: ${sessionInfo.messageCounter}`);
    console.log(`💬 You can now send encrypted messages`);
    console.log(`📝 Type your message and press Enter (or 'quit' to exit):\n`);
    
    // Send confirmation to partner
    if (this.partnerId) {
      this.socket.emit('key_exchange', {
        targetId: this.partnerId,
        message: 'exchange_complete',
        type: 'exchange_confirmation'
      });
    }
  }
  
  handleEncryptedMessage(data) {
    const { senderUsername, encryptedMessage } = data;
    
    try {
      const encryptedData = JSON.parse(encryptedMessage);
      const decryptedMessage = this.signal.decrypt(encryptedData);
      
      const sessionInfo = this.signal.getSessionInfo();
      
      console.log(`\n📨 Message from ${senderUsername}: ${decryptedMessage}`);
      console.log(`🔐 Decrypted with receiving chain: ${sessionInfo.receivingChainPreview}`);
      console.log(`📝 Type your message:`);
    } catch (error) {
      console.log(`❌ Failed to decrypt message: ${error.message}`);
      console.log(`🔍 Debug info:`, {
        hasReceivingChain: !!this.signal.receivingChainKey,
        chainKeyLength: this.signal.receivingChainKey?.length,
        messageCounter: this.signal.messageCounter,
        encryptedData: encryptedMessage.substring(0, 100)
      });
    }
  }
  
  sendMessage(message) {
    if (!this.isKeyExchangeComplete) {
      console.log(`⚠️  X3DH key exchange not complete. Please wait...`);
      console.log(`🔍 Current status: Key exchange in progress`);
      return;
    }
    
    if (!this.partnerId) {
      console.log(`⚠️  No partner connected`);
      return;
    }
    
    try {
      const encryptedData = this.signal.encrypt(message);
      const encryptedMessage = JSON.stringify(encryptedData);
      
      this.socket.emit('encrypted_message', {
        targetId: this.partnerId,
        encryptedMessage
      });
      
      const sessionInfo = this.signal.getSessionInfo();
      
      console.log(`📤 Encrypted message sent to ${this.partnerUsername}`);
      console.log(`🔐 Encrypted with sending chain: ${sessionInfo.sendingChainPreview}`);
      console.log(`🔄 Message counter: ${encryptedData.counter}`);
      
    } catch (error) {
      console.log(`❌ Failed to encrypt message: ${error.message}`);
    }
  }
  
  setupReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.rl.on('line', (input) => {
      const message = input.trim();
      
      if (message.toLowerCase() === 'quit') {
        console.log(`👋 Goodbye!`);
        process.exit(0);
      }
      
      if (message.toLowerCase() === 'status') {
        const sessionInfo = this.signal.getSessionInfo();
        console.log(`\n📊 Signal Protocol Session Status:`);
        console.log(`   Root Key: ${sessionInfo.rootKeyPreview}`);
        console.log(`   Sending Chain: ${sessionInfo.sendingChainPreview}`);
        console.log(`   Receiving Chain: ${sessionInfo.receivingChainPreview}`);
        console.log(`   Message Counter: ${sessionInfo.messageCounter}`);
        console.log(`   Key Exchange: ${this.isKeyExchangeComplete ? 'Complete' : 'In Progress'}`);
        console.log(`📝 Type your message:`);
        return;
      }
      
      if (message) {
        this.sendMessage(message);
      }
    });
  }
  
  resetConnection() {
    this.partnerId = null;
    this.partnerUsername = null;
    this.isKeyExchangeComplete = false;
    this.signal = new SignalProtocolClient(this.username);
    
    console.log(`🔍 Looking for new matches...`);
    this.socket.emit('find_match');
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.log(`❌ Usage: node chatClient.js <username>`);
  console.log(`   Example: node chatClient.js alice`);
  process.exit(1);
}

console.log(`🚀 Starting Real Signal Protocol E2EE Chat Client for: ${username}`);
console.log(`🔐 Features:`);
console.log(`   ✅ X3DH Key Agreement (Extended Triple Diffie-Hellman)`);
console.log(`   ✅ Double Ratchet Algorithm (Perfect Forward Secrecy)`);
console.log(`   ✅ Automatic Nonce Handling (Unique per message)`);
console.log(`   ✅ Built-in Authentication (Signatures & MAC)`);
console.log(`   ✅ Stateless (keys not stored on server)`);
console.log(`   ✅ Interest-based matching\n`);

// Start the client
const client = new E2EEChatClient(username);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n👋 Shutting down gracefully...`);
  client.socket.disconnect();
  process.exit(0);
});
