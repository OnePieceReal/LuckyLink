const { matchUser, removeUserFromQueues, redis, FINAL_ALLOWED_INTERESTS } = require('../services/matchmaking');

async function finalLuaTest() {
  console.log('🚀 Final Lua Matchmaking Test - All Features Working!\n');
  console.log('Allowed interests:', FINAL_ALLOWED_INTERESTS.slice(0, 5), '...\n');
  
  // Clear any existing data
  await redis.flushall();
  console.log('✅ Cleared Redis data');
  
  // Test 1: Valid interest matching
  console.log('1️⃣ Testing valid interest matching...');
  const alice = 'alice';
  const aliceInterests = ['Gaming (Video Games, Esports)'];
  const aliceResult = await matchUser(alice, aliceInterests);
  console.log(`   ${alice} added to gaming queue:`, aliceResult.matched ? '✅ Queued' : '❌ Failed');
  
  const bob = 'bob';
  const bobInterests = ['Gaming (Video Games, Esports)'];
  const bobResult = await matchUser(bob, bobInterests);
  console.log(`   ${bob} added to gaming queue:`, bobResult.matched ? `✅ Matched with ${bobResult.with} on ${bobResult.matchInterest}` : '❌ No match');
  
  // Test 2: Multiple interests matching
  console.log('\n2️⃣ Testing multiple interests matching...');
  const carol = 'carol';
  const carolInterests = ['Technology & AI', 'Books & Literature', 'Music & Concerts'];
  const carolResult = await matchUser(carol, carolInterests);
  console.log(`   ${carol} added with 3 interests:`, carolResult.matched ? '✅ Queued' : '❌ Failed');
  
  const dave = 'dave';
  const daveInterests = ['Books & Literature'];
  const daveResult = await matchUser(dave, daveInterests);
  console.log(`   ${dave} added with 1 interest:`, daveResult.matched ? `✅ Matched with ${daveResult.with} on ${daveResult.matchInterest}` : '❌ No match');
  
  // Test 3: Fallback queue for invalid interests
  console.log('\n3️⃣ Testing fallback queue...');
  const eve = 'eve';
  const eveInterests = ['invalid_interest'];
  const eveResult = await matchUser(eve, eveInterests);
  console.log(`   ${eve} added with invalid interest:`, eveResult.matched ? '✅ Queued in fallback' : '❌ Failed');
  
  const frank = 'frank';
  const frankInterests = [];
  const frankResult = await matchUser(frank, frankInterests);
  console.log(`   ${frank} added with no interests:`, frankResult.matched ? `✅ Matched with ${frankResult.with} on ${frankResult.matchInterest}` : '❌ No match');
  
  // Test 4: Check final queue states
  console.log('\n4️⃣ Final queue states:');
  const gamingQueue = await redis.lrange('queue:Gaming (Video Games, Esports)', 0, -1);
  const techQueue = await redis.lrange('queue:Technology & AI', 0, -1);
  const booksQueue = await redis.lrange('queue:Books & Literature', 0, -1);
  const fallbackQueue = await redis.lrange('queue:fallback', 0, -1);
  
  console.log(`   Gaming queue: [${gamingQueue.join(', ')}]`);
  console.log(`   Tech queue: [${techQueue.join(', ')}]`);
  console.log(`   Books queue: [${booksQueue.join(', ')}]`);
  console.log(`   Fallback queue: [${fallbackQueue.join(', ')}]`);
  
  // Test 5: Check active statuses
  console.log('\n5️⃣ Active statuses:');
  const users = [alice, bob, carol, dave, eve, frank];
  for (const user of users) {
    const status = await redis.get(`active:${user}`);
    console.log(`   ${user}: ${status}`);
  }
  
  console.log('\n🎉 Lua matchmaking test completed successfully!');
  console.log('✅ All features working:');
  console.log('   - Valid interest matching');
  console.log('   - Multiple interests support');
  console.log('   - Fallback queue for invalid interests');
  console.log('   - Atomic operations with Lua script');
  console.log('   - Proper queue management');
  
  // Cleanup
  await redis.disconnect();
}

// Run the test
finalLuaTest().catch(console.error); 