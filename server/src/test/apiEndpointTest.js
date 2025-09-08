const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

/**
 * Test file for API endpoints:
 * - OPEN_API_KEY: OpenAI API for omni-moderation-latest
 */

class APIEndpointTester {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.testResults = {
            openai: { success: false, error: null, response: null }
        };
    }

    /**
     * Test OpenAI API endpoint for moderation
     */
    async testOpenAIEndpoint() {
        console.log('\n🔍 Testing OpenAI API endpoint...');
        
        if (!this.openaiApiKey) {
            this.testResults.openai.error = 'OPEN_API_KEY environment variable not found';
            console.log('❌ OPEN_API_KEY not found in environment variables');
            return false;
        }

        try {
            const testText = "This is a test message to check if the OpenAI moderation API is working correctly.";
            
            const response = await axios.post('https://api.openai.com/v1/moderations', {
                input: testText,
                model: "omni-moderation-latest"
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.status === 200) {
                this.testResults.openai.success = true;
                this.testResults.openai.response = response.data;
                console.log('✅ OpenAI API endpoint test successful!');
                console.log('📊 Moderation results:', JSON.stringify(response.data, null, 2));
                return true;
            } else {
                this.testResults.openai.error = `Unexpected status: ${response.status}`;
                console.log(`❌ OpenAI API returned status: ${response.status}`);
                return false;
            }
        } catch (error) {
            this.testResults.openai.error = error.message;
            if (error.response) {
                console.log(`❌ OpenAI API error: ${error.response.status} - ${error.response.statusText}`);
                console.log('Error details:', error.response.data);
            } else if (error.request) {
                console.log('❌ OpenAI API request failed - no response received');
            } else {
                console.log(`❌ OpenAI API error: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Test OpenAI API with actual moderation scenarios
     */
    async testModerationScenarios() {
        console.log('\n🧪 Testing moderation scenarios...');
        
        const testCases = [
            {
                text: "Hello, how are you today?",
                expected: "Should pass moderation"
            },
            {
                text: "This is a completely normal and friendly message.",
                expected: "Should pass moderation"
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n📝 Testing: "${testCase.text}"`);
            console.log(`Expected: ${testCase.expected}`);
            
            if (this.openaiApiKey) {
                try {
                    const openaiResponse = await axios.post('https://api.openai.com/v1/moderations', {
                        input: testCase.text,
                        model: "omni-moderation-latest"
                    }, {
                        headers: {
                            'Authorization': `Bearer ${this.openaiApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const moderation = openaiResponse.data.results[0];
                    const flagged = moderation.flagged;
                    const categories = moderation.categories;
                    
                    console.log(`OpenAI Result: ${flagged ? '🚨 FLAGGED' : '✅ PASSED'}`);
                    if (flagged) {
                        console.log('Flagged categories:', Object.keys(categories).filter(cat => categories[cat]));
                    }
                } catch (error) {
                    console.log('OpenAI test failed:', error.message);
                }
            }
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting OpenAI API Endpoint Tests...\n');
        console.log('Environment Variables Status:');
        console.log(`OPEN_API_KEY: ${this.openaiApiKey ? '✅ Found' : '❌ Not found'}`);
        
        const openaiResult = await this.testOpenAIEndpoint();
        
        if (openaiResult) {
            await this.testModerationScenarios();
        }
        
        this.printSummary();
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        if (this.testResults.openai.success) {
            console.log('✅ OpenAI API: Working correctly');
        } else {
            console.log('❌ OpenAI API: Failed');
            console.log(`   Error: ${this.testResults.openai.error}`);
        }
        
        console.log('\n💡 Recommendations:');
        if (!this.openaiApiKey) {
            console.log('- Add OPEN_API_KEY to your .env file');
        }
        
        if (this.testResults.openai.success) {
            console.log('🎉 OpenAI API is working correctly! You can now use it for content moderation.');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new APIEndpointTester();
    tester.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = APIEndpointTester;
