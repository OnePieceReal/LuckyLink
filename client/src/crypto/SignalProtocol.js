/**
 * browser-compatible signal protocol implementation with x3dh and double ratchet
 * uses web crypto api instead of node.js crypto module
 */

class SignalProtocolClient {
  constructor(username) {
    this.username = username;
    
    // ============================================================================
    // STATE AND CONFIGURATION
    // ============================================================================

    // key pairs will be generated asynchronously
    this.identityKeyPair = null;
    this.ephemeralKeyPair = null;
    
    this.sessionKey = null;
    this.partnerIdentityPublicKey = null;
    this.partnerEphemeralPublicKey = null;
    this.messageCounter = 0;
    this.partnerMessageCounter = 0;
    this.sendingChainKey = null;
    this.receivingChainKey = null;
    this.rootKey = null;
    this.currentRatchetKeyPair = null;
    this.partnerRatchetPublicKey = null;
    this.lastReceivedRatchetKey = null;
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize() {
    try {
      // generate ecdh key pairs for x3dh using web crypto api
      this.identityKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      this.ephemeralKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      return true;
    } catch (error) {
      // failed to initialize signal protocol
      return false;
    }
  }

  // ============================================================================
  // KEY MANAGEMENT
  // ============================================================================

  async getPublicKeys() {
    if (!this.identityKeyPair || !this.ephemeralKeyPair) {
      throw new Error('Keys not initialized. Call initialize() first.');
    }
    
    // export public keys in jwk format for transmission
    const identityPublic = await window.crypto.subtle.exportKey('jwk', this.identityKeyPair.publicKey);
    const ephemeralPublic = await window.crypto.subtle.exportKey('jwk', this.ephemeralKeyPair.publicKey);
    
    return {
      identity: identityPublic,
      ephemeral: ephemeralPublic
    };
  }
  
  // ============================================================================
  // X3DH KEY AGREEMENT
  // ============================================================================

  async performX3DHKeyAgreement(partnerPublicKeys, isInitiator) {
    try {
      // import partner's public keys from jwk format
      const partnerIdentityKey = await window.crypto.subtle.importKey(
        'jwk',
        partnerPublicKeys.identity,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );
      
      const partnerEphemeralKey = await window.crypto.subtle.importKey(
        'jwk',
        partnerPublicKeys.ephemeral,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );
      
      this.partnerIdentityPublicKey = partnerIdentityKey;
      this.partnerEphemeralPublicKey = partnerEphemeralKey;
      
      // perform 4 dh operations for x3dh
      
      // dh1: identity_private × partner_identity_public
      const dh1 = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: partnerIdentityKey
        },
        this.identityKeyPair.privateKey,
        256
      );
      
      // DH2: identity_private × partner_ephemeral_public
      const dh2 = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: partnerEphemeralKey
        },
        this.identityKeyPair.privateKey,
        256
      );
      
      // DH3: ephemeral_private × partner_identity_public
      const dh3 = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: partnerIdentityKey
        },
        this.ephemeralKeyPair.privateKey,
        256
      );
      
      // DH4: ephemeral_private × partner_ephemeral_public
      const dh4 = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: partnerEphemeralKey
        },
        this.ephemeralKeyPair.privateKey,
        256
      );
      
      // Sort DH values to ensure consistent ordering
      const dhArrays = [
        new Uint8Array(dh1),
        new Uint8Array(dh2),
        new Uint8Array(dh3),
        new Uint8Array(dh4)
      ];
      
      dhArrays.sort((a, b) => {
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return a[i] - b[i];
        }
        return 0;
      });
      
      // Combine all 4 shared secrets
      const combined = new Uint8Array(dhArrays.reduce((acc, arr) => acc + arr.length, 0));
      let offset = 0;
      for (const arr of dhArrays) {
        combined.set(arr, offset);
        offset += arr.length;
      }
      
      
      // Apply KDF with domain separation
      const encoder = new TextEncoder();
      const domainSeparator = encoder.encode('Signal_X3DH_P256');
      const kdfInput = new Uint8Array(domainSeparator.length + combined.length);
      kdfInput.set(domainSeparator);
      kdfInput.set(combined, domainSeparator.length);
      
      // Derive master secret using HKDF
      const masterSecret = await this.hkdf(kdfInput, 32);
      
      // Derive root key
      const rootInput = new Uint8Array(masterSecret.length + 4);
      rootInput.set(masterSecret);
      rootInput.set(encoder.encode('root'), masterSecret.length);
      this.rootKey = await this.hkdf(rootInput, 32);
      
      // Initialize ratchet with new key pair
      this.currentRatchetKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      // Derive base chain key
      const chainInput = new Uint8Array(this.rootKey.length + 5);
      chainInput.set(this.rootKey);
      chainInput.set(encoder.encode('chain'), this.rootKey.length);
      const baseChain = await this.hkdf(chainInput, 32);
      
      // Create two deterministic chains
      const chain1Input = new Uint8Array(baseChain.length + 1);
      chain1Input.set(baseChain);
      chain1Input[baseChain.length] = 0x01;
      const chain1 = await this.hkdf(chain1Input, 32);
      
      const chain2Input = new Uint8Array(baseChain.length + 1);
      chain2Input.set(baseChain);
      chain2Input[baseChain.length] = 0x02;
      const chain2 = await this.hkdf(chain2Input, 32);
      
      // Chain assignment based on role
      if (isInitiator) {
        this.sendingChainKey = chain1;
        this.receivingChainKey = chain2;
      } else {
        this.sendingChainKey = chain2;
        this.receivingChainKey = chain1;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async getRatchetPublicKey() {
    if (!this.currentRatchetKeyPair) {
      return null;
    }
    return await window.crypto.subtle.exportKey('jwk', this.currentRatchetKeyPair.publicKey);
  }
  
  async initializePartnerRatchet(partnerRatchetPublicKeyJWK) {
    try {
      const partnerRatchetKey = await window.crypto.subtle.importKey(
        'jwk',
        partnerRatchetPublicKeyJWK,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );
      
      this.partnerRatchetPublicKey = partnerRatchetKey;
      this.lastReceivedRatchetKey = partnerRatchetPublicKeyJWK;
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async deriveMessageKey(chainKey) {
    const encoder = new TextEncoder();
    
    // Derive message key from chain key
    const messageInput = new Uint8Array(chainKey.length + 7);
    messageInput.set(chainKey);
    messageInput.set(encoder.encode('message'), chainKey.length);
    const messageKey = await this.hkdf(messageInput, 32);
    
    // Advance chain key
    const chainInput = new Uint8Array(chainKey.length + 5);
    chainInput.set(chainKey);
    chainInput.set(encoder.encode('chain'), chainKey.length);
    const newChainKey = await this.hkdf(chainInput, 32);
    
    return { messageKey, newChainKey };
  }
  
  async encrypt(message) {
    if (!this.sendingChainKey) {
      throw new Error('No sending chain key available');
    }
    
    try {
      
      // Derive message key and advance chain
      const { messageKey, newChainKey } = await this.deriveMessageKey(this.sendingChainKey);
      this.sendingChainKey = newChainKey;
      
      // Generate IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Import message key for AES-GCM
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        messageKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Encrypt message
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(message);
      
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        messageBuffer
      );
      
      // Increment message counter
      this.messageCounter++;
      
      
      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        counter: this.messageCounter,
        username: this.username // Add sender username for debugging
      };
    } catch (error) {
      throw error;
    }
  }
  
  async decrypt(encryptedData) {
    if (!this.receivingChainKey) {
      throw new Error('No receiving chain key available');
    }
    
    try {

      // Check if we need to skip ahead in the chain for out-of-order messages
      let currentChainKey = this.receivingChainKey;
      let skipCount = Math.max(0, encryptedData.counter - this.partnerMessageCounter - 1);
      
      if (skipCount > 0) {
        for (let i = 0; i < skipCount; i++) {
          const { newChainKey } = await this.deriveMessageKey(currentChainKey);
          currentChainKey = newChainKey;
        }
      }

      // Derive message key and advance chain
      const { messageKey, newChainKey } = await this.deriveMessageKey(currentChainKey);
      this.receivingChainKey = newChainKey;
      this.partnerMessageCounter = encryptedData.counter;
      
      // Import message key for AES-GCM
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        messageKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt message
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv)
        },
        cryptoKey,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decrypted);
      
      return decryptedText;
    } catch (error) {
      throw error;
    }
  }
  
  // Helper function: HKDF for key derivation
  async hkdf(input, length) {
    const hash = await window.crypto.subtle.digest('SHA-256', input);
    return new Uint8Array(hash).slice(0, length);
  }
  
  // Helper functions for base64 conversion
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  // Key rotation functionality
  async performKeyRotation() {
    if (!this.rootKey || !this.partnerRatchetPublicKey) {
      throw new Error('Cannot perform key rotation without established session');
    }
    
    
    try {
      // Generate new ratchet key pair
      const newRatchetKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      // Derive new root key using current partner's ratchet key
      const newSharedSecret = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: this.partnerRatchetPublicKey
        },
        newRatchetKeyPair.privateKey,
        256
      );
      
      // Derive new root key from old root key and new shared secret
      const encoder = new TextEncoder();
      const kdfInput = new Uint8Array(this.rootKey.length + newSharedSecret.byteLength);
      kdfInput.set(this.rootKey);
      kdfInput.set(new Uint8Array(newSharedSecret), this.rootKey.length);
      
      const rotationInput = new Uint8Array(kdfInput.length + 8);
      rotationInput.set(kdfInput);
      rotationInput.set(encoder.encode('rotation'), kdfInput.length);
      
      this.rootKey = await this.hkdf(rotationInput, 32);
      
      // Update ratchet key pair
      this.currentRatchetKeyPair = newRatchetKeyPair;
      
      // Derive new chain keys
      const chainInput = new Uint8Array(this.rootKey.length + 5);
      chainInput.set(this.rootKey);
      chainInput.set(encoder.encode('chain'), this.rootKey.length);
      const baseChain = await this.hkdf(chainInput, 32);
      
      // Create new deterministic chains
      const chain1Input = new Uint8Array(baseChain.length + 1);
      chain1Input.set(baseChain);
      chain1Input[baseChain.length] = 0x01;
      const newSendingChain = await this.hkdf(chain1Input, 32);
      
      const chain2Input = new Uint8Array(baseChain.length + 1);
      chain2Input.set(baseChain);
      chain2Input[baseChain.length] = 0x02;
      const newReceivingChain = await this.hkdf(chain2Input, 32);
      
      // Update chain keys
      this.sendingChainKey = newSendingChain;
      this.receivingChainKey = newReceivingChain;
      
      // Reset message counters for new chains
      this.messageCounter = 0;
      this.partnerMessageCounter = 0;
      
      return true;
    } catch (error) {
      throw error;
    }
  }
  
  // Get new ratchet public key after rotation
  async getNewRatchetPublicKey() {
    if (!this.currentRatchetKeyPair) {
      throw new Error('No current ratchet key pair available');
    }
    return await window.crypto.subtle.exportKey('jwk', this.currentRatchetKeyPair.publicKey);
  }
  
  // Update partner's ratchet key after their rotation
  async updatePartnerRatchetKey(newPartnerRatchetPublicKeyJWK) {
    try {
      const newPartnerRatchetKey = await window.crypto.subtle.importKey(
        'jwk',
        newPartnerRatchetPublicKeyJWK,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );
      
      this.partnerRatchetPublicKey = newPartnerRatchetKey;
      this.lastReceivedRatchetKey = newPartnerRatchetPublicKeyJWK;
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  getSessionInfo() {
    return {
      hasRootKey: !!this.rootKey,
      hasSendingChain: !!this.sendingChainKey,
      hasReceivingChain: !!this.receivingChainKey,
      messageCounter: this.messageCounter,
      partnerMessageCounter: this.partnerMessageCounter,
      isInitialized: !!(this.identityKeyPair && this.ephemeralKeyPair),
      canRotateKeys: !!(this.rootKey && this.partnerRatchetPublicKey)
    };
  }
  
  // Clean up session data
  clearSession() {
    this.sessionKey = null;
    this.partnerIdentityPublicKey = null;
    this.partnerEphemeralPublicKey = null;
    this.messageCounter = 0;
    this.partnerMessageCounter = 0;
    this.sendingChainKey = null;
    this.receivingChainKey = null;
    this.rootKey = null;
    this.partnerRatchetPublicKey = null;
    this.lastReceivedRatchetKey = null;
    
  }
}

export default SignalProtocolClient;