const libsignal = require('@signalapp/libsignal-client');

console.log('🔍 Debugging IdentityKeyPair structure...\n');

const identityKey = libsignal.IdentityKeyPair.generate();
console.log('IdentityKey type:', typeof identityKey);
console.log('IdentityKey constructor:', identityKey.constructor.name);
console.log('IdentityKey methods:', Object.getOwnPropertyNames(identityKey));
console.log('IdentityKey prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(identityKey)));

console.log('\nChecking for specific methods:');
console.log('publicKey method:', typeof identityKey.publicKey);
console.log('privateKey method:', typeof identityKey.privateKey);

if (identityKey.publicKey) {
  console.log('publicKey type:', typeof identityKey.publicKey);
  console.log('publicKey methods:', Object.getOwnPropertyNames(identityKey.publicKey));
}

if (identityKey.privateKey) {
  console.log('privateKey type:', typeof identityKey.privateKey);
  console.log('privateKey methods:', Object.getOwnPropertyNames(identityKey.privateKey));
}

console.log('\nDirect properties:');
console.log('Keys:', Object.keys(identityKey));
console.log('Values:', Object.values(identityKey).map(v => typeof v));
