/**
 * e2ee test utilities for debugging and validation
 */

import SignalProtocolClient from './SignalProtocol';

class E2EETest {
  // ============================================================================
  // BASIC ENCRYPTION TEST
  // ============================================================================

  static async testBasicEncryption() {
    try {
      // create two users
      const alice = new SignalProtocolClient('Alice');
      const bob = new SignalProtocolClient('Bob');
      
      // initialize both
      await alice.initialize();
      await bob.initialize();
      
      // exchange public keys
      const aliceKeys = await alice.getPublicKeys();
      const bobKeys = await bob.getPublicKeys();
      
      // perform x3dh key agreement
      const aliceSuccess = await alice.performX3DHKeyAgreement(bobKeys, true);
      const bobSuccess = await bob.performX3DHKeyAgreement(aliceKeys, false);
      
      if (!aliceSuccess || !bobSuccess) {
        throw new Error('Key agreement failed');
      }
      
      // test message encryption/decryption
      const testMessage = 'Hello, this is a test message! 🔐';
      
      // alice encrypts
      const encrypted = await alice.encrypt(testMessage);
      
      // bob decrypts
      const decrypted = await bob.decrypt(encrypted);
      
      if (decrypted === testMessage) {
        return true;
      } else {
        return false;
      }
      
    } catch (error) {
      return false;
    }
  }
  
  // ============================================================================
  // MULTIPLE MESSAGE TEST
  // ============================================================================

  static async testMultipleMessages() {
    try {
      const alice = new SignalProtocolClient('Alice');
      const bob = new SignalProtocolClient('Bob');
      
      await alice.initialize();
      await bob.initialize();
      
      // key exchange
      const aliceKeys = await alice.getPublicKeys();
      const bobKeys = await bob.getPublicKeys();
      
      await alice.performX3DHKeyAgreement(bobKeys, true);
      await bob.performX3DHKeyAgreement(aliceKeys, false);
      
      // test multiple messages
      const messages = [
        'First message',
        'Second message with emojis 🚀',
        'Third message with special chars: !@#$%^&*()',
        'Fourth message...'
      ];
      
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        // alice sends to bob
        const encrypted = await alice.encrypt(message);
        const decrypted = await bob.decrypt(encrypted);
        
        if (decrypted !== message) {
          throw new Error(`Message ${i + 1} failed: "${decrypted}" !== "${message}"`);
        }
        
        // bob sends back to alice
        const response = `Re: ${message}`;
        const encryptedResponse = await bob.encrypt(response);
        const decryptedResponse = await alice.decrypt(encryptedResponse);
        
        if (decryptedResponse !== response) {
          throw new Error(`Response ${i + 1} failed`);
        }
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
  
  // ============================================================================
  // KEY ROTATION TEST
  // ============================================================================

  static async testKeyRotation() {
    try {
      const alice = new SignalProtocolClient('Alice');
      const bob = new SignalProtocolClient('Bob');
      
      await alice.initialize();
      await bob.initialize();
      
      // key exchange
      const aliceKeys = await alice.getPublicKeys();
      const bobKeys = await bob.getPublicKeys();
      
      await alice.performX3DHKeyAgreement(bobKeys, true);
      await bob.performX3DHKeyAgreement(aliceKeys, false);
      
      // send several messages to trigger key rotation
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);
      
      for (const message of messages) {
        const encrypted = await alice.encrypt(message);
        const decrypted = await bob.decrypt(encrypted);
        
        if (decrypted !== message) {
          throw new Error(`Key rotation test failed on: ${message}`);
        }
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
  
  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  static async runAllTests() {
    const results = {
      basicEncryption: await this.testBasicEncryption(),
      multipleMessages: await this.testMultipleMessages(),
      keyRotation: await this.testKeyRotation()
    };
    
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    return {
      results,
      passed,
      total,
      allPassed: passed === total
    };
  }
}

// Expose for debugging in browser console
window.E2EETest = E2EETest;

export default E2EETest;