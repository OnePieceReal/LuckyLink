require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const OpenAIModerationService = require('../services/openaiModeration');

// Test texts
const testTexts = [
  "Hello, how are you today?",
  "I hate you so much!",
  "Let's play a game together",
  "You're stupid and worthless",
  "Want to grab coffee sometime?"
];

async function testOpenAIDirectly() {
  console.log('🔍 Testing OpenAI Moderation Service Directly\n');
  console.log('=' .repeat(80));
  
  const moderationService = new OpenAIModerationService();
  
  if (!moderationService.isConfigured()) {
    console.error('❌ OpenAI API key not configured!');
    console.error('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }
  
  console.log('✅ OpenAI API key is configured\n');
  
  // Test single text moderation
  for (const text of testTexts) {
    console.log(`\n📝 Testing: "${text}"`);
    console.log('-'.repeat(60));
    
    try {
      // Get raw moderation result
      const rawResult = await moderationService.moderateContent(text);
      console.log('\n1️⃣ Raw OpenAI Response:');
      console.log(JSON.stringify(rawResult.results[0], null, 2));
      
      // Get detailed analysis
      const detailedResult = await moderationService.getDetailedAnalysis(text);
      console.log('\n2️⃣ Detailed Analysis:');
      console.log(JSON.stringify(detailedResult, null, 2));
      
      // Get simple flag check
      const flagResult = await moderationService.isContentFlagged(text);
      console.log('\n3️⃣ Simple Flag Check:');
      console.log(JSON.stringify(flagResult, null, 2));
      
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Test batch moderation
  console.log('\n\n🔄 Testing Batch Moderation');
  console.log('='.repeat(80));
  
  try {
    const batchResult = await moderationService.batchModerate(testTexts);
    console.log('\nBatch Results:');
    batchResult.forEach((result, index) => {
      console.log(`\n${index + 1}. "${result.text}"`);
      console.log(`   Flagged: ${result.flagged}`);
      console.log(`   Severity: ${(result.severity * 100).toFixed(1)}%`);
      console.log(`   Categories:`, result.categories);
      console.log(`   Scores:`, result.categoryScores);
    });
  } catch (error) {
    console.error('\n❌ Batch Error:', error.message);
  }
}

// Run the test
testOpenAIDirectly().then(() => {
  console.log('\n\n✅ Direct OpenAI test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n\n❌ Test failed:', error);
  process.exit(1);
});