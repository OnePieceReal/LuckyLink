require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');
const https = require('https');

// Create an HTTPS agent that accepts self-signed certificates for local testing
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Test texts with various content types
const testTexts = [
  {
    name: "Clean greeting",
    text: "Hello! How are you doing today? I hope you're having a great day!"
  },
  {
    name: "Mild profanity",
    text: "This is damn annoying, what the hell is going on?"
  },
  {
    name: "Discussion about violence in media",
    text: "The movie had a lot of fight scenes and violence, but it was well choreographed."
  },
  {
    name: "Political discussion",
    text: "I disagree with the current political policies and think we need change."
  },
  {
    name: "Romantic message",
    text: "You look absolutely beautiful today, I love spending time with you."
  },
  {
    name: "Gaming trash talk",
    text: "Get rekt noob, you're terrible at this game!"
  },
  {
    name: "Health discussion",
    text: "I've been feeling depressed lately and thinking about seeking therapy."
  },
  {
    name: "Spam-like content",
    text: "CLICK HERE NOW!!! FREE MONEY!!! LIMITED TIME OFFER!!!"
  }
];

async function testModerationAPI() {
  console.log('🔍 Testing Moderation API with various text samples\n');
  console.log('=' .repeat(80));
  
  // First, let's test the authentication
  const token = process.env.TEST_JWT_TOKEN || 'your-test-token-here';
  
  if (!token || token === 'your-test-token-here') {
    console.log('⚠️  WARNING: No TEST_JWT_TOKEN found in .env file');
    console.log('Please set TEST_JWT_TOKEN in your .env file or update this script');
    console.log('You can get a token by logging in and checking localStorage.getItem("token")\n');
  }
  
  for (const testCase of testTexts) {
    console.log(`\n📝 Testing: "${testCase.name}"`);
    console.log(`Text: "${testCase.text}"`);
    console.log('-'.repeat(60));
    
    try {
      const response = await axios.post(
        'https://localhost:5000/api/moderation/check',
        { text: testCase.text },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          httpsAgent
        }
      );
      
      const data = response.data;
      
      console.log('\n✅ Response received:');
      console.log('Success:', data.success);
      console.log('Flagged:', data.flagged);
      console.log('Severity:', data.severity ? (data.severity * 100).toFixed(1) + '%' : 'N/A');
      console.log('Recommendation:', data.recommendation);
      
      // Show flagged categories if any
      if (data.flaggedCategories && data.flaggedCategories.length > 0) {
        console.log('\n🚩 Flagged Categories:');
        data.flaggedCategories.forEach(cat => {
          console.log(`  - ${cat}`);
        });
      }
      
      // Show high score categories
      if (data.highScoreCategories && data.highScoreCategories.length > 0) {
        console.log('\n📊 High Score Categories (>70%):');
        data.highScoreCategories.forEach(item => {
          console.log(`  - ${item.category}: ${item.score}`);
        });
      }
      
      // Show all category scores
      if (data.allScores || data.categories) {
        console.log('\n📈 All Category Scores:');
        const scores = data.allScores || data.categoryScores || {};
        const categories = data.categories || {};
        
        // Get all unique category names
        const allCategoryNames = new Set([
          ...Object.keys(scores),
          ...Object.keys(categories)
        ]);
        
        allCategoryNames.forEach(category => {
          const score = scores[category] || 0;
          const flagged = categories[category] || false;
          const percentage = (score * 100).toFixed(2);
          const bar = '█'.repeat(Math.floor(score * 20)) + '░'.repeat(20 - Math.floor(score * 20));
          console.log(`  ${category.padEnd(30)} ${bar} ${percentage.padStart(6)}% ${flagged ? '🚩' : ''}`);
        });
      }
      
      // Log the full response for debugging
      console.log('\n🔍 Full Response (for debugging):');
      console.log(JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error('\n❌ Error testing moderation:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Error:', error.response.data);
      } else if (error.request) {
        console.error('No response received from server');
        console.error('Make sure the server is running on https://localhost:5000');
      } else {
        console.error('Error:', error.message);
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Test batch moderation
  console.log('\n\n🔄 Testing Batch Moderation API');
  console.log('='.repeat(80));
  
  try {
    const batchTexts = testTexts.slice(0, 3).map(t => t.text);
    console.log(`Testing batch with ${batchTexts.length} texts\n`);
    
    const response = await axios.post(
      'https://localhost:5000/api/moderation/batch',
      { texts: batchTexts },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      }
    );
    
    const data = response.data;
    console.log('✅ Batch Response received:');
    console.log('Success:', data.success);
    console.log('Total Texts:', data.totalTexts);
    console.log('\nResults:');
    
    data.results.forEach((result, index) => {
      console.log(`\n${index + 1}. Text: "${result.text.substring(0, 50)}..."`);
      console.log(`   Flagged: ${result.flagged}`);
      console.log(`   Severity: ${(result.severity * 100).toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error('\n❌ Error testing batch moderation:', error.message);
  }
}

// Run the test
testModerationAPI().then(() => {
  console.log('\n\n✅ Moderation API test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n\n❌ Test failed:', error);
  process.exit(1);
});