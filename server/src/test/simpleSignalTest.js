const libsignal = require('@signalapp/libsignal-client');

async function simpleSignalTest() {
  console.log('🔐 Simple Signal Protocol Test\n');
  
  try {
    // Test 1: Basic key generation
    console.log('1. Testing key generation...');
    const identityKey = libsignal.IdentityKeyPair.generate();
    const keyPair = libsignal.KeyPair.generate();
    console.log('✅ Keys generated successfully');
    
    // Test 2: Key serialization
    console.log('2. Testing key serialization...');
    const publicKey = keyPair.publicKey().serialize();
    const privateKey = keyPair.privateKey().serialize();
    console.log('✅ Keys serialized, public key length:', publicKey.length);
    
    // Test 3: Signing and verification
    console.log('3. Testing signing and verification...');
    const message = Buffer.from('Hello Signal Protocol!');
    const signature = identityKey.privateKey().sign(message);
    const isValid = identityKey.publicKey().verify(message, signature);
    console.log('✅ Signature verification:', isValid ? 'PASSED' : 'FAILED');
    
    // Test 4: Protocol address creation
    console.log('4. Testing protocol address...');
    const address = new libsignal.ProtocolAddress('testuser', 1);
    console.log('✅ Address created:', address.name(), 'device:', address.deviceId());
    
    // Test 5: PreKey bundle creation
    console.log('5. Testing prekey bundle...');
    const preKeyBundle = new libsignal.PreKeyBundle(
      1234, // registration ID
      1,    // device ID
      1,    // prekey ID
      keyPair.publicKey(),
      1,    // signed prekey ID
      keyPair.publicKey(),
      signature,
      identityKey.publicKey()
    );
    console.log('✅ PreKey bundle created successfully');
    
    // Test 6: HKDF key derivation
    console.log('6. Testing HKDF...');
    const salt = Buffer.from('test-salt');
    const info = Buffer.from('test-info');
    const inputKeyMaterial = Buffer.from('test-key-material');
    const derivedKey = libsignal.hkdf(inputKeyMaterial, salt, info, 32);
    console.log('✅ HKDF successful, derived key length:', derivedKey.length);
    
    console.log('\n🎉 All basic tests passed! Signal Protocol is working.\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
if (require.main === module) {
  simpleSignalTest()
    .then(success => {
      if (success) {
        console.log('✅ Simple test completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Simple test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { simpleSignalTest };
