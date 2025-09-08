const { matchUser, removeUserFromQueues, redis } = require('../services/matchmaking');
const readline = require('readline-sync');

async function testLuaMatchmaking() {
  console.log('🚀 Testing Lua-based Matchmaking...\n');
  
  // Clear any existing data
  await redis.flushall();
  console.log('✅ Cleared Redis data');
  
  // Test 1: Add users and test matching with valid interests
  console.log('\n1. Testing basic matching with valid interests...');
  
  // Add user1 to gaming queue
  const user1 = 'user1';
  const user1Interests = ['Gaming (Video Games, Esports)'];
  const result1 = await matchUser(user1, user1Interests);
  console.log(`User ${user1} added with interests ${user1Interests}:`, result1);
  
  // Add user2 to gaming queue (should match with user1)
  const user2 = 'user2';
  const user2Interests = ['Gaming (Video Games, Esports)'];
  const result2 = await matchUser(user2, user2Interests);
  console.log(`User ${user2} added with interests ${user2Interests}:`, result2);
  
  if (result2.matched) {
    console.log('✅ Lua script working: Users matched successfully!');
    console.log(`   Match: ${user2} matched with ${result2.with} on interest: ${result2.matchInterest}`);
  } else {
    console.log('❌ Lua script failed: No match found');
  }
  
  // Test 2: Test fallback queue
  console.log('\n2. Testing fallback queue...');
  
  // Add user3 with no valid interests (should go to fallback)
  const user3 = 'user3';
  const user3Interests = ['invalid_interest'];
  const result3 = await matchUser(user3, user3Interests);
  console.log(`User ${user3} added with invalid interests:`, result3);
  
  // Add user4 with no interests (should match with user3 in fallback)
  const user4 = 'user4';
  const user4Interests = [];
  const result4 = await matchUser(user4, user4Interests);
  console.log(`User ${user4} added with no interests:`, result4);
  
  if (result4.matched) {
    console.log('✅ Fallback queue working: Users matched in fallback!');
    console.log(`   Match: ${user4} matched with ${result4.with} on interest: ${result4.matchInterest}`);
  } else {
    console.log('❌ Fallback queue failed: No match found');
  }
  
  // Test 3: Check queue states
  console.log('\n3. Checking queue states...');
  const gamingQueue = await redis.lrange('queue:Gaming (Video Games, Esports)', 0, -1);
  const fallbackQueue = await redis.lrange('queue:fallback', 0, -1);
  console.log('Gaming queue:', gamingQueue);
  console.log('Fallback queue:', fallbackQueue);
  
  // Test 4: Check active statuses
  console.log('\n4. Checking active statuses...');
  const user1Status = await redis.get('active:user1');
  const user2Status = await redis.get('active:user2');
  const user3Status = await redis.get('active:user3');
  const user4Status = await redis.get('active:user4');
  console.log('User1 status:', user1Status);
  console.log('User2 status:', user2Status);
  console.log('User3 status:', user3Status);
  console.log('User4 status:', user4Status);
  
  // Test 5: Testing multiple interests
  console.log('\n5. Testing multiple interests...');
  const user5 = 'user5';
  const user5Interests = ['Technology & AI', 'Books & Literature'];
  const result5 = await matchUser(user5, user5Interests);
  console.log(`User ${user5} added with multiple interests:`, result5);
  
  const user6 = 'user6';
  const user6Interests = ['Books & Literature'];
  const result6 = await matchUser(user6, user6Interests);
  console.log(`User ${user6} added with single interest:`, result6);
  
  if (result6.matched) {
    console.log('✅ Multiple interests working: Users matched on shared interest!');
    console.log(`   Match: ${user6} matched with ${result6.with} on interest: ${result6.matchInterest}`);
  }
  
  console.log('\n🏁 Lua matchmaking test complete!');
  
  // Cleanup
  await redis.disconnect();
}

// Run the test
testLuaMatchmaking().catch(console.error); 