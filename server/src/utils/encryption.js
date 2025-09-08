const sodium = require('libsodium-wrappers');

class MessageEncryption {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await sodium.ready;
      this.serverKey = Buffer.from(process.env.SERVER_KEY, 'hex');
      if (this.serverKey.length !== 32) {
        throw new Error('SERVER_KEY must be exactly 32 bytes (64 hex characters)');
      }
      this.initialized = true;
    }
  }

  async encrypt(plaintext) {
    await this.init();
    
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    // generate random nonce (24 bytes for XChaCha20-Poly1305)
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    
    // encrypt with authenticated encryption
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null, // no additional data
      null, // no secret nonce
      nonce,
      this.serverKey
    );

    return {
      encrypted_message: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(nonce).toString('base64'),
      signature: null // not needed with AEAD, authentication tag is included in ciphertext
    };
  }

  async decrypt(encryptedMessage, iv, signature = null) {
    await this.init();
    
    if (!encryptedMessage || !iv) {
      throw new Error('Encrypted message and IV are required');
    }

    try {
      const ciphertext = Buffer.from(encryptedMessage, 'base64');
      const nonce = Buffer.from(iv, 'base64');
      
      if (nonce.length !== sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
        throw new Error('Invalid nonce length');
      }

      // decrypt with authenticated decryption
      const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // no secret nonce
        ciphertext,
        null, // no additional data
        nonce,
        this.serverKey
      );

      return sodium.to_string(plaintext);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // utility method to check if a message is encrypted (based on format)
  isEncrypted(message, iv) {
    if (!message || !iv) return false;
    
    try {
      // check if message and iv are valid base64
      Buffer.from(message, 'base64');
      Buffer.from(iv, 'base64');
      
      // check if iv has correct length when decoded
      const decodedIv = Buffer.from(iv, 'base64');
      return decodedIv.length === sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    } catch (error) {
      return false;
    }
  }
}

// export singleton instance
const messageEncryption = new MessageEncryption();

module.exports = messageEncryption;