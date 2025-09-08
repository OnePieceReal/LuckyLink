const { matchUser, removeUserFromQueues, redis, FINAL_ALLOWED_INTERESTS } = require('../services/matchmaking');
const readline = require('readline-sync');

async function interactiveLuaTest() {
  console.log('🚀 Interactive Lua Matchmaking Test\n');
  console.log('Allowed interests:', FINAL_ALLOWED_INTERESTS.join(', '));
  console.log('\nCommands:');
  console.log('1 - Add user to matchmaking queue');
  console.log('2 - Match users and print results');
  console.log('3 - Show all queue states');
  console.log('4 - Show all active statuses');
  console.log('5 - Clear all data');
  console.log('0 - Exit\n');
  
  // Clear any existing data
  await redis.flushall();
  console.log('✅ Cleared Redis data\n');
  
  const users = new Map(); // Store user data
  
  while (true) {
    const choice = readline.question('Enter command (0-5): ');
    
    switch (choice) {
      case '1':
        await addUser(users);
        break;
      case '2':
        await matchUsers(users);
        break;
      case '3':
        await showQueueStates();
        break;
      case '4':
        await showActiveStatuses(users);
        break;
      case '5':
        await redis.flushall();
        users.clear();
        console.log('✅ Cleared all data\n');
        break;
      case '0':
        console.log('👋 Goodbye!');
        await redis.disconnect();
        return;
      default:
        console.log('❌ Invalid command. Please enter 0-5.\n');
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
  
  console.log('Current users:');
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

async function showQueueStates() {
  console.log('\n--- Queue States ---');
  
  // Show all interest queues
  for (const interest of FINAL_ALLOWED_INTERESTS) {
    const queue = await redis.lrange(`queue:${interest}`, 0, -1);
    if (queue.length > 0) {
      console.log(`  ${interest}: [${queue.join(', ')}]`);
    }
  }
  
  // Show fallback queue
  const fallbackQueue = await redis.lrange('queue:fallback', 0, -1);
  if (fallbackQueue.length > 0) {
    console.log(`  fallback: [${fallbackQueue.join(', ')}]`);
  }
  
  console.log('');
}

async function showActiveStatuses(users) {
  console.log('\n--- Active Statuses ---');
  
  if (users.size === 0) {
    console.log('No users added yet.\n');
    return;
  }
  
  for (const [userId, userData] of users) {
    const status = await redis.get(`active:${userId}`);
    console.log(`  ${userId}: ${status || 'unknown'} (interests: [${userData.interests.join(', ')}])`);
  }
  
  console.log('');
}

// Run the interactive test
interactiveLuaTest().catch(console.error); 