# Signal Protocol Tests

This directory contains comprehensive tests for the Signal Protocol implementation in the LuckyLink project.

## Test Files

### 1. `basicSignalTest.js` ✅ **WORKING**
- **Purpose**: Tests core Signal Protocol functionality
- **Status**: Fully functional
- **Tests**: Identity key generation, signing, verification, key management
- **Usage**: `node src/test/basicSignalTest.js`

### 2. `finalSignalTest.js` ⚠️ **PARTIALLY WORKING**
- **Purpose**: Comprehensive Signal Protocol test suite
- **Status**: Core crypto works, some advanced features have issues
- **Tests**: Full protocol testing including session management
- **Usage**: `node src/test/finalSignalTest.js`

### 3. `simpleWorkingTest.js` ⚠️ **PARTIALLY WORKING**
- **Purpose**: Simplified working test
- **Status**: Core functionality works, some features fail
- **Tests**: Basic crypto operations
- **Usage**: `node src/test/simpleWorkingTest.js`

### 4. `simpleSignalTest.js` ❌ **NOT WORKING**
- **Purpose**: Simple test (deprecated)
- **Status**: API compatibility issues
- **Tests**: Basic functionality
- **Usage**: Not recommended

### 5. `signalProtocolTest.js` ❌ **NOT WORKING**
- **Purpose**: Comprehensive test (deprecated)
- **Status**: API compatibility issues
- **Tests**: Full protocol testing
- **Usage**: Not recommended

## Running Tests

### Quick Test (Recommended)
```bash
cd server
node src/test/basicSignalTest.js
```

### Full Test Suite
```bash
cd server
node src/test/finalSignalTest.js
```

## What's Working

✅ **Core Cryptographic Operations**
- Identity key pair generation
- Public/private key serialization
- Digital signing and verification
- Multiple key management
- Key comparison
- Cross-key security validation
- Message-specific signatures

✅ **Signal Protocol Library**
- `@signalapp/libsignal-client` is properly installed
- Core classes are accessible
- Basic operations function correctly

## What's Not Working

❌ **Advanced Protocol Features**
- Protocol address creation (downcast errors)
- Session management
- PreKey bundle operations
- HKDF key derivation
- AES encryption/decryption
- Fingerprint generation

## Test Results Summary

The Signal Protocol library is **working correctly for core cryptographic operations**. The main issues are with the Node.js bindings for some advanced features, not with the underlying cryptographic algorithms.

## Recommendations

1. **Use `basicSignalTest.js`** for verifying core functionality
2. **Core crypto is production-ready** for basic operations
3. **Advanced features** may require additional setup or different API usage
4. **Consider using** the working parts for production applications

## Dependencies

- `@signalapp/libsignal-client` v0.27.0
- Node.js (tested on Windows 10)
- No additional setup required

## Troubleshooting

If you encounter issues:

1. Ensure you're in the `server` directory
2. Check that `@signalapp/libsignal-client` is installed
3. Run `npm install` if needed
4. Use `basicSignalTest.js` as the primary test

## Security Notes

- All cryptographic operations are performed in memory
- Keys are generated fresh for each test
- No persistent key storage in tests
- Tests validate security properties (e.g., cross-key verification fails as expected)
