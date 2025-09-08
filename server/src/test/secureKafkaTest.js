const { 
  startProducer, 
  sendFriendRequestEvent, 
  startConsumer, 
  createUserConsumer, 
  disconnectUserConsumer,
  MESSAGE_TYPES 
} = require('../services/kafka');

const readline = require('readline-sync');

// Simulate user sessions
const userSessions = new Map();

async function simulateUserLogin(userId) {
  console.log(`\n👤 User ${userId} logging in...`);
  
  // Create user-specific consumer
  const userConsumer = await createUserConsumer(userId, (message) => {
    console.log(`\n📨 ${userId} received notification:`);
    console.log(`   Type: ${message.type}`);
    console.log(`   From: ${message.fromUserId}`);
    console.log(`   To: ${message.toUserId}`);
    console.log(`   Status: ${message.payload.status}`);
    console.log(`   Request ID: ${message.payload.requestId || 'N/A'}`);
    console.log(`   Timestamp: ${message.timestamp}`);
  });
  
  userSessions.set(userId, userConsumer);
  console.log(`✅ User ${userId} is now listening for messages`);
}

async function simulateUserLogout(userId) {
  console.log(`\n👤 User ${userId} logging out...`);
  const userConsumer = userSessions.get(userId);
  if (userConsumer) {
    await disconnectUserConsumer(userConsumer);
    userSessions.delete(userId);
    console.log(`✅ User ${userId} disconnected`);
  }
}

async function simulateFriendRequest(fromUserId, toUserId) {
  console.log(`\n📨 Sending friend request from ${fromUserId} to ${toUserId}...`);
  
  try {
    await sendFriendRequestEvent({
      type: MESSAGE_TYPES.FRIEND_REQUEST_SENT,
      fromUserId,
      toUserId,
      request: {
        id: Math.floor(Math.random() * 1000),
        sender_id: fromUserId,
        receiver_id: toUserId,
        status: 'pending',
        created_at: new Date().toISOString()
      },
      status: 'pending'
    });
    
    console.log(`✅ Friend request sent successfully`);
  } catch (error) {
    console.error(`❌ Failed to send friend request: ${error.message}`);
  }
}

async function simulateFriendResponse(responderId, originalSenderId, status) {
  console.log(`\n📨 ${responderId} responding to friend request from ${originalSenderId} with ${status}...`);
  
  try {
    await sendFriendRequestEvent({
      type: status === 'accepted' ? MESSAGE_TYPES.FRIEND_REQUEST_ACCEPTED : MESSAGE_TYPES.FRIEND_REQUEST_REJECTED,
      fromUserId: responderId,
      toUserId: originalSenderId,
      request: {
        id: Math.floor(Math.random() * 1000),
        sender_id: originalSenderId,
        receiver_id: responderId,
        status: status,
        updated_at: new Date().toISOString()
      },
      requestId: Math.floor(Math.random() * 1000),
      status
    });
    
    console.log(`✅ Friend request response sent successfully`);
  } catch (error) {
    console.error(`❌ Failed to send friend request response: ${error.message}`);
  }
}

async function main() {
  console.log('🔐 Secure Kafka Messaging Test\n');
  
  // Start producer
  await startProducer();
  
  // Start general consumer for logging (optional)
  await startConsumer((message) => {
    console.log(`\n📋 LOG: ${message.type} message processed for ${message.toUserId}`);
  });
  
  console.log('\nAvailable commands:');
  console.log('1. login <userId> - Simulate user login');
  console.log('2. logout <userId> - Simulate user logout');
  console.log('3. send <fromUserId> <toUserId> - Send friend request');
  console.log('4. respond <responderId> <originalSenderId> <accepted|rejected> - Respond to friend request');
  console.log('5. status - Show active user sessions');
  console.log('6. exit - Exit test');
  
  while (true) {
    const input = readline.question('\nEnter command: ');
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    
    try {
      switch (command) {
        case 'login':
          if (parts.length !== 2) {
            console.log('❌ Usage: login <userId>');
            break;
          }
          await simulateUserLogin(parts[1]);
          break;
          
        case 'logout':
          if (parts.length !== 2) {
            console.log('❌ Usage: logout <userId>');
            break;
          }
          await simulateUserLogout(parts[1]);
          break;
          
        case 'send':
          if (parts.length !== 3) {
            console.log('❌ Usage: send <fromUserId> <toUserId>');
            break;
          }
          await simulateFriendRequest(parts[1], parts[2]);
          break;
          
        case 'respond':
          if (parts.length !== 4) {
            console.log('❌ Usage: respond <responderId> <originalSenderId> <accepted|rejected>');
            break;
          }
          const status = parts[3];
          if (!['accepted', 'rejected'].includes(status)) {
            console.log('❌ Status must be "accepted" or "rejected"');
            break;
          }
          await simulateFriendResponse(parts[1], parts[2], status);
          break;
          
        case 'status':
          console.log('\n📊 Active User Sessions:');
          if (userSessions.size === 0) {
            console.log('  No active sessions');
          } else {
            for (const [userId] of userSessions) {
              console.log(`  ✅ ${userId} - Listening for messages`);
            }
          }
          break;
          
        case 'exit':
          console.log('\n👋 Disconnecting all users...');
          for (const [userId] of userSessions) {
            await simulateUserLogout(userId);
          }
          console.log('✅ Test completed');
          process.exit(0);
          break;
          
        default:
          console.log('❌ Unknown command. Use: login, logout, send, respond, status, or exit');
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  for (const [userId] of userSessions) {
    await simulateUserLogout(userId);
  }
  process.exit(0);
});

// Run the test
main().catch(console.error); 