const { matchUser, removeUserFromQueues, redis, FINAL_ALLOWED_INTERESTS } = require('../services/matchmaking');
const readline = require('readline-sync');

async function simpleInteractiveTest() {
  console.log('🚀 Simple Interactive Lua Matchmaking Test\n');
  console.log('Commands:');
  console.log('1 - Add user to matchmaking queue');
  console.log('2 - Match users and print results');
  console.log('0 - Exit\n');
  
  // Clear any existing data
  await redis.flushall();
  console.log('✅ Cleared Redis data\n');
  
  const users = new Map(); // Store user data
  
  while (true) {
    const choice = readline.question('Enter command (0-2): ');
    
    switch (choice) {
      case '1':
        await addUser(users);
        break;
      case '2':
        await matchUsers(users);
        break;
      case '0':
        console.log('👋 Goodbye!');
        await redis.disconnect();
        return;
      default:
        console.log('❌ Invalid command. Please enter 0-2.\n');
    }
  }
}

async function addUser(users) {
  console.log('\n--- Add User to Matchmaking ---');
  
  const userId = readline.question('Enter user ID: ');
  if (!userId.trim()) {
    console.log('❌ User ID cannot be empty\n');
    return;
  }
  
  console.log('\nAvailable interests:');
  FINAL_ALLOWED_INTERESTS.forEach((interest, index) => {
    console.log(`${index + 1}. ${interest}`);
  });
  console.log(`${FINAL_ALLOWED_INTERESTS.length + 1}. No interests (fallback queue)`);
  
  const interestChoice = readline.question('\nEnter interest numbers (comma-separated, max 3): ');
  let interests = [];
  
  if (interestChoice.trim()) {
    const choices = interestChoice.split(',').map(c => c.trim());
    for (const choice of choices) {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < FINAL_ALLOWED_INTERESTS.length) {
        interests.push(FINAL_ALLOWED_INTERESTS[index]);
      }
    }
    interests = interests.slice(0, 3); // Max 3 interests
  }
  
  console.log(`\nAdding user ${userId} with interests: [${interests.join(', ')}]`);
  
  try {
    const result = await matchUser(userId, interests);
    users.set(userId, { interests, result });
    
    if (result.matched) {
      console.log(`✅ ${userId} matched with ${result.with} on interest: ${result.matchInterest}`);
    } else {
      console.log(`⏳ ${userId} added to queue(s), waiting for match...`);
    }
  } catch (error) {
    console.log(`❌ Error adding user: ${error.message}`);
  }
  
  console.log('');
}

async function matchUsers(users) {
  console.log('\n--- Match Users ---');
  
  if (users.size === 0) {
    console.log('❌ No users to match. Add users first.\n');
    return;
  }
  
  console.log('Current users and their status:');
  for (const [userId, userData] of users) {
    const status = await redis.get(`active:${userId}`);
    console.log(`  ${userId}: ${status || 'unknown'} (interests: [${userData.interests.join(', ')}])`);
  }
  
  console.log('\nMatching results:');
  for (const [userId, userData] of users) {
    const status = await redis.get(`active:${userId}`);
    if (status === 'matched') {
      console.log(`✅ ${userId}: Matched`);
    } else if (status === 'waiting') {
      console.log(`⏳ ${userId}: Waiting in queue`);
    } else {
      console.log(`❓ ${userId}: Unknown status`);
    }
  }
  
  console.log('');
}

// Run the simple interactive test
simpleInteractiveTest().catch(console.error); 