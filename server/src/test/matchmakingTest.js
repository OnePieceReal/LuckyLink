const matchmaking = require('../services/matchmaking');

async function testMatchmaking() {
  console.log('Testing matchmaking functionality...');
  
  try {
    // Test 1: First user joins with interests
    console.log('\n1. Adding user1 with Technology & AI interest...');
    const result1 = await matchmaking.matchUser('user1', ['Technology & AI']);
    console.log('Result:', result1);
    
    // Test 2: Second user joins with same interest (should match)
    console.log('\n2. Adding user2 with Technology & AI interest...');
    const result2 = await matchmaking.matchUser('user2', ['Technology & AI']);
    console.log('Result:', result2);
    
    // Test 3: Third user joins (should be added to queue)
    console.log('\n3. Adding user3 with Gaming interest...');
    const result3 = await matchmaking.matchUser('user3', ['Gaming (Video Games, Esports)']);
    console.log('Result:', result3);
    
    // Test 4: Fourth user joins with Gaming (should match with user3)
    console.log('\n4. Adding user4 with Gaming interest...');
    const result4 = await matchmaking.matchUser('user4', ['Gaming (Video Games, Esports)']);
    console.log('Result:', result4);
    
    console.log('\nMatchmaking test completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMatchmaking(); 