const io = require('socket.io-client');
const crypto = require('crypto');
const readline = require('readline');

// Simple Signal Protocol implementation for demo
class SignalProtocol {
  constructor(username) {
    this.username = username;
    this.keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    this.sessionKey = null;
    this.partnerPublicKey = null;
  }
  
  getPublicKey() {
    return this.keyPair.publicKey;
  }
  
  generateSessionKey() {
    this.sessionKey = crypto.randomBytes(32);
    return this.sessionKey;
  }
  
  setPartnerPublicKey(publicKey) {
    this.partnerPublicKey = publicKey;
  }
  
  encryptSessionKey(sessionKey) {
    return crypto.publicEncrypt(this.partnerPublicKey, sessionKey).toString('base64');
  }
  
  decryptSessionKey(encryptedKey) {
    const keyBuffer = Buffer.from(encryptedKey, 'base64');
    this.sessionKey = crypto.privateDecrypt(this.keyPair.privateKey, keyBuffer);
    return this.sessionKey;
  }
  
  encrypt(message) {
    if (!this.sessionKey) throw new Error('No session key available');
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.sessionKey);
    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      encrypted,
      iv: iv.toString('base64')
    };
  }
  
  decrypt(encryptedData) {
    if (!this.sessionKey) throw new Error('No session key available');
    
    const decipher = crypto.createDecipher('aes-256-cbc', this.sessionKey);
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

class E2EEChatClient {
  constructor(username) {
    this.username = username;
    this.socket = io('http://localhost:3000');
    this.signal = new SignalProtocol(username);
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
      console.log(`🔐 Starting key exchange...`);
      
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
    console.log(`🚀 Initiating key exchange as ${this.username}...`);
    
    // Step 1: Send public key
    this.socket.emit('key_exchange', {
      targetId: this.partnerId,
      message: this.signal.getPublicKey(),
      type: 'public_key'
    });
  }
  
  handleKeyExchange(data) {
    const { senderId, message, type } = data;
    
    console.log(`🔑 Received key exchange (${type}) from ${this.partnerUsername}`);
    
    switch (type) {
      case 'public_key':
        // Store partner's public key
        this.signal.setPartnerPublicKey(message);
        
        if (this.isInitiator) {
          // Generate and send encrypted session key
          const sessionKey = this.signal.generateSessionKey();
          const encryptedKey = this.signal.encryptSessionKey(sessionKey);
          
          this.socket.emit('key_exchange', {
            targetId: senderId,
            message: encryptedKey,
            type: 'session_key'
          });
          
          this.completeKeyExchange();
        } else {
          // Send our public key back
          this.socket.emit('key_exchange', {
            targetId: senderId,
            message: this.signal.getPublicKey(),
            type: 'public_key_response'
          });
        }
        break;
        
      case 'public_key_response':
        // Store partner's public key and generate session key
        this.signal.setPartnerPublicKey(message);
        const sessionKey = this.signal.generateSessionKey();
        const encryptedKey = this.signal.encryptSessionKey(sessionKey);
        
        this.socket.emit('key_exchange', {
          targetId: senderId,
          message: encryptedKey,
          type: 'session_key'
        });
        
        this.completeKeyExchange();
        break;
        
      case 'session_key':
        // Decrypt session key
        this.signal.decryptSessionKey(message);
        this.completeKeyExchange();
        break;
    }
  }
  
  completeKeyExchange() {
    this.isKeyExchangeComplete = true;
    console.log(`\n🔒 End-to-end encryption established!`);
    console.log(`✨ Session key generated (32 bytes, not stored on server)`);
    console.log(`💬 You can now send encrypted messages`);
    console.log(`📝 Type your message and press Enter (or 'quit' to exit):\n`);
  }
  
  handleEncryptedMessage(data) {
    const { senderUsername, encryptedMessage } = data;
    
    try {
      const encryptedData = JSON.parse(encryptedMessage);
      const decryptedMessage = this.signal.decrypt(encryptedData);
      
      console.log(`\n📨 Message from ${senderUsername}: ${decryptedMessage}`);
      console.log(`📝 Type your message:`);
    } catch (error) {
      console.log(`❌ Failed to decrypt message: ${error.message}`);
    }
  }
  
  sendMessage(message) {
    if (!this.isKeyExchangeComplete) {
      console.log(`⚠️  Key exchange not complete. Please wait...`);
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
      
      console.log(`📤 Encrypted message sent to ${this.partnerUsername}`);
      console.log(`🔐 Encrypted data: ${encryptedMessage.substring(0, 50)}...`);
      
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
      
      if (message) {
        this.sendMessage(message);
      }
    });
  }
  
  resetConnection() {
    this.partnerId = null;
    this.partnerUsername = null;
    this.isKeyExchangeComplete = false;
    this.signal = new SignalProtocol(this.username);
    
    console.log(`🔍 Looking for new matches...`);
    this.socket.emit('find_match');
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.log(`❌ Usage: node client.js <username>`);
  console.log(`   Example: node client.js alice`);
  process.exit(1);
}

console.log(`🚀 Starting E2EE Chat Client for: ${username}`);
console.log(`🔐 Features:`);
console.log(`   - Signal Protocol for key exchange`);
console.log(`   - AES-256-CBC encryption`);
console.log(`   - Stateless (keys not stored on server)`);
console.log(`   - Interest-based matching\n`);

// Start the client
const client = new E2EEChatClient(username);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n👋 Shutting down gracefully...`);
  client.socket.disconnect();
  process.exit(0);
});