const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  username: 'testuser_recaptcha',
  email: 'test_recaptcha@example.com',
  password: 'testpassword123',
  recaptchaToken: 'test_token_123' // This will fail verification
};

async function testRecaptchaIntegration() {
  console.log('🧪 Testing reCAPTCHA Integration\n');

  try {
    // Test 1: Registration without reCAPTCHA token
    console.log('1. Testing registration without reCAPTCHA token...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, {
        username: testUser.username,
        email: testUser.email,
        password: testUser.password
      });
      console.log('❌ Should have failed - missing reCAPTCHA token');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error === 'reCAPTCHA token is required') {
        console.log('✅ Correctly rejected registration without reCAPTCHA token');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }

    // Test 2: Registration with invalid reCAPTCHA token
    console.log('\n2. Testing registration with invalid reCAPTCHA token...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, {
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        recaptchaToken: 'invalid_token_123'
      });
      console.log('❌ Should have failed - invalid reCAPTCHA token');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error === 'reCAPTCHA verification failed') {
        console.log('✅ Correctly rejected registration with invalid reCAPTCHA token');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }

    // Test 3: Login without reCAPTCHA token
    console.log('\n3. Testing login without reCAPTCHA token...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      console.log('❌ Should have failed - missing reCAPTCHA token');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error === 'reCAPTCHA token is required') {
        console.log('✅ Correctly rejected login without reCAPTCHA token');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }

    // Test 4: Login with invalid reCAPTCHA token
    console.log('\n4. Testing login with invalid reCAPTCHA token...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
        recaptchaToken: 'invalid_token_123'
      });
      console.log('❌ Should have failed - invalid reCAPTCHA token');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error === 'reCAPTCHA verification failed') {
        console.log('✅ Correctly rejected login with invalid reCAPTCHA token');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }

    console.log('\n📝 Note: To test with valid reCAPTCHA tokens, you need to:');
    console.log('1. Set up reCAPTCHA in Google Console');
    console.log('2. Add RECAPTCHA_SECRET_KEY to your .env file');
    console.log('3. Get valid tokens from the frontend reCAPTCHA widget');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test reCAPTCHA service directly
async function testRecaptchaService() {
  console.log('\n🔧 Testing reCAPTCHA Service Directly\n');

  const { verifyRecaptchaToken } = require('../services/recaptcha');

  try {
    // Test with invalid token
    const result = await verifyRecaptchaToken('invalid_token_123');
    console.log('Invalid token result:', result);
    
    // Test without secret key (should return false)
    const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.RECAPTCHA_SECRET_KEY;
    
    const resultNoSecret = await verifyRecaptchaToken('any_token');
    console.log('No secret key result:', resultNoSecret);
    
    // Restore secret key
    if (originalSecret) {
      process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    }
    
  } catch (error) {
    console.error('❌ Service test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting reCAPTCHA Integration Tests\n');
  
  await testRecaptchaIntegration();
  await testRecaptchaService();
  
  console.log('\n✅ reCAPTCHA tests completed!');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testRecaptchaIntegration, testRecaptchaService }; 