const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

/**
 * Test file for the moderation endpoint
 * Tests JWT authentication, rate limiting, and OpenAI moderation
 */
class ModerationEndpointTester {
    constructor() {
        this.baseURL = 'https://localhost:5000';
        this.jwtToken = null;
        this.testResults = {
            auth: { success: false, error: null },
            moderation: { success: false, error: null },
            rateLimit: { success: false, error: null }
        };
    }

    /**
     * Get JWT token for testing
     */
    async getJWTToken() {
        console.log('🔐 Getting JWT token for testing...');
        
        try {
            // You'll need to implement this based on your auth system
            // For now, we'll use a placeholder
            console.log('⚠️  Note: You need to implement JWT token generation for testing');
            console.log('   You can either:');
            console.log('   1. Login through your auth endpoint and get a token');
            console.log('   2. Create a test user and generate a token');
            console.log('   3. Temporarily disable JWT auth for testing');
            
            // Placeholder - replace with actual token
            this.jwtToken = 'your_jwt_token_here';
            
            if (this.jwtToken === 'your_jwt_token_here') {
                this.testResults.auth.error = 'JWT token not configured for testing';
                console.log('❌ JWT token not configured - skipping endpoint tests');
                return false;
            }
            
            this.testResults.auth.success = true;
            console.log('✅ JWT token obtained');
            return true;
            
        } catch (error) {
            this.testResults.auth.error = error.message;
            console.log(`❌ Failed to get JWT token: ${error.message}`);
            return false;
        }
    }

    /**
     * Test single text moderation
     */
    async testSingleModeration() {
        console.log('\n🔍 Testing single text moderation...');
        
        if (!this.jwtToken) {
            console.log('⚠️  Skipping - no JWT token available');
            return false;
        }

        try {
            const testText = "Hello, this is a test message for moderation.";
            
            const response = await axios.post(`${this.baseURL}/api/moderation/check`, {
                text: testText
            }, {
                headers: {
                    'Authorization': `Bearer ${this.jwtToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            if (response.status === 200) {
                this.testResults.moderation.success = true;
                console.log('✅ Single moderation test successful!');
                console.log('📊 Moderation result:', JSON.stringify(response.data, null, 2));
                return true;
            } else {
                this.testResults.moderation.error = `Unexpected status: ${response.status}`;
                console.log(`❌ Single moderation returned status: ${response.status}`);
                return false;
            }
        } catch (error) {
            this.testResults.moderation.error = error.message;
            if (error.response) {
                console.log(`❌ Single moderation error: ${error.response.status} - ${error.response.statusText}`);
                console.log('Error details:', error.response.data);
            } else {
                console.log(`❌ Single moderation error: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Test batch moderation
     */
    async testBatchModeration() {
        console.log('\n📦 Testing batch moderation...');
        
        if (!this.jwtToken) {
            console.log('⚠️  Skipping - no JWT token available');
            return false;
        }

        try {
            const testTexts = [
                "Hello, how are you?",
                "This is a normal message.",
                "Have a great day!"
            ];
            
            const response = await axios.post(`${this.baseURL}/api/moderation/batch`, {
                texts: testTexts
            }, {
                headers: {
                    'Authorization': `Bearer ${this.jwtToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            });

            if (response.status === 200) {
                console.log('✅ Batch moderation test successful!');
                console.log('📊 Batch result:', JSON.stringify(response.data, null, 2));
                return true;
            } else {
                console.log(`❌ Batch moderation returned status: ${response.status}`);
                return false;
            }
        } catch (error) {
            if (error.response) {
                console.log(`❌ Batch moderation error: ${error.response.status} - ${error.response.statusText}`);
                console.log('Error details:', error.response.data);
            } else {
                console.log(`❌ Batch moderation error: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Test health endpoint
     */
    async testHealthEndpoint() {
        console.log('\n🏥 Testing health endpoint...');
        
        if (!this.jwtToken) {
            console.log('⚠️  Skipping - no JWT token available');
            return false;
        }

        try {
            const response = await axios.get(`${this.baseURL}/api/moderation/health`, {
                headers: {
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                timeout: 10000
            });

            if (response.status === 200) {
                console.log('✅ Health endpoint test successful!');
                console.log('📊 Health status:', JSON.stringify(response.data, null, 2));
                return true;
            } else {
                console.log(`❌ Health endpoint returned status: ${response.status}`);
                return false;
            }
        } catch (error) {
            if (error.response) {
                console.log(`❌ Health endpoint error: ${error.response.status} - ${error.response.statusText}`);
                console.log('Error details:', error.response.data);
            } else {
                console.log(`❌ Health endpoint error: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Test rate limiting
     */
    async testRateLimiting() {
        console.log('\n⏱️  Testing rate limiting (10 requests per minute)...');
        
        if (!this.jwtToken) {
            console.log('⚠️  Skipping - no JWT token available');
            return false;
        }

        try {
            const requests = [];
            const testText = "Rate limit test message.";
            
            // Make 11 requests (should trigger rate limit on the 11th)
            for (let i = 0; i < 11; i++) {
                try {
                    const response = await axios.post(`${this.baseURL}/api/moderation/check`, {
                        text: `${testText} ${i + 1}`
                    }, {
                        headers: {
                            'Authorization': `Bearer ${this.jwtToken}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    
                    requests.push({ request: i + 1, status: response.status, success: true });
                    console.log(`   Request ${i + 1}: ✅ Success`);
                    
                } catch (error) {
                    if (error.response && error.response.status === 429) {
                        requests.push({ request: i + 1, status: 429, success: false, rateLimited: true });
                        console.log(`   Request ${i + 1}: 🚫 Rate Limited (Expected)`);
                        this.testResults.rateLimit.success = true;
                        break;
                    } else {
                        requests.push({ request: i + 1, status: error.response?.status || 'error', success: false });
                        console.log(`   Request ${i + 1}: ❌ Error - ${error.response?.status || error.message}`);
                    }
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const rateLimitedRequests = requests.filter(r => r.rateLimited);
            if (rateLimitedRequests.length > 0) {
                console.log('✅ Rate limiting working correctly!');
                console.log(`   Rate limit triggered after ${rateLimitedRequests[0].request} requests`);
                return true;
            } else {
                console.log('⚠️  Rate limiting not triggered - check configuration');
                return false;
            }

        } catch (error) {
            console.log(`❌ Rate limiting test error: ${error.message}`);
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Moderation Endpoint Tests...\n');
        
        console.log('Environment Variables Status:');
        console.log(`OPEN_API_KEY: ${process.env.OPEN_API_KEY ? '✅ Found' : '❌ Not found'}`);
        
        // Get JWT token first
        const authSuccess = await this.getJWTToken();
        
        if (authSuccess) {
            await this.testSingleModeration();
            await this.testBatchModeration();
            await this.testHealthEndpoint();
            await this.testRateLimiting();
        }
        
        this.printSummary();
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        // Auth summary
        if (this.testResults.auth.success) {
            console.log('✅ Authentication: Working correctly');
        } else {
            console.log('❌ Authentication: Failed');
            console.log(`   Error: ${this.testResults.auth.error}`);
        }
        
        // Moderation summary
        if (this.testResults.moderation.success) {
            console.log('✅ Moderation Endpoint: Working correctly');
        } else {
            console.log('❌ Moderation Endpoint: Failed');
            if (this.testResults.moderation.error) {
                console.log(`   Error: ${this.testResults.moderation.error}`);
            }
        }
        
        // Rate limiting summary
        if (this.testResults.rateLimit.success) {
            console.log('✅ Rate Limiting: Working correctly');
        } else {
            console.log('❌ Rate Limiting: Failed or not tested');
        }
        
        console.log('\n💡 Recommendations:');
        if (!process.env.OPEN_API_KEY) {
            console.log('- Add OPEN_API_KEY to your .env file');
        }
        if (!this.jwtToken || this.jwtToken === 'your_jwt_token_here') {
            console.log('- Configure JWT token for endpoint testing');
            console.log('- Or temporarily disable JWT auth for testing');
        }
        
        if (this.testResults.auth.success && this.testResults.moderation.success) {
            console.log('🎉 Moderation endpoint is working correctly!');
            console.log('   You can now use it for content moderation in your app.');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ModerationEndpointTester();
    tester.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = ModerationEndpointTester;
