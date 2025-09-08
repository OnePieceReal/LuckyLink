const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'luckylink-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'friend-request-logger' });

// message types for analytics and logging
const MESSAGE_TYPES = {
  // friend request events
  FRIEND_REQUEST_SENT: 'friend-request-sent',
  FRIEND_REQUEST_ACCEPTED: 'friend-request-accepted',
  FRIEND_REQUEST_REJECTED: 'friend-request-rejected',
  FRIEND_REQUEST_DELETED: 'friend-request-deleted',
  
  // user connection events
  USER_CONNECTED: 'user-connected',
  USER_DISCONNECTED: 'user-disconnected',
  USER_STATUS_CHANGED: 'user-status-changed',
  
  // chat events (for future expansion)
  MESSAGE_SENT: 'message-sent',
  RANDOM_CHAT_STARTED: 'random-chat-started',
  RANDOM_CHAT_ENDED: 'random-chat-ended'
};

// connect kafka producer
async function startProducer() {
  await producer.connect();
  console.log(' Kafka producer connected');
}

// send secure friend request event with proper user targeting
async function sendFriendRequestEvent(event) {
  // validate required fields
  if (!event.type || !event.fromUserId || !event.toUserId) {
    throw new Error('Missing required fields: type, fromUserId, toUserId');
  }

  // create secure message payload with proper metadata
  const message = {
    // message metadata for routing and filtering
    messageId: generateMessageId(),
    timestamp: new Date().toISOString(),
    type: event.type,
    
    // user targeting - only intended recipient should process this
    fromUserId: event.fromUserId,
    toUserId: event.toUserId,
    
    // message content
    payload: {
      request: event.request,
      requestId: event.requestId,
      status: event.status || 'pending'
    },
    
    // security metadata
    version: '1.0',
    source: 'luckylink-backend'
  };

  // use toUserId as message key for efficient partitioning
  const messageKey = event.toUserId;

  try {
    await producer.send({
      topic: 'friend-requests',
      messages: [
        {
          key: messageKey,
          value: JSON.stringify(message),
          headers: {
            'message-type': event.type,
            'from-user': event.fromUserId,
            'to-user': event.toUserId
          }
        },
      ],
    });
    
    console.log(` Kafka: Sent ${event.type} event from ${event.fromUserId} to ${event.toUserId}`);
  } catch (error) {
    console.error(' Kafka producer error:', error);
    throw error;
  }
}

// start consumer with user-specific message filtering
async function startConsumer(onMessage, currentUserId = null) {
  await consumer.connect();
  await consumer.subscribe({ topic: 'friend-requests', fromBeginning: true });
  
  console.log(` Kafka consumer connected${currentUserId ? ` for user: ${currentUserId}` : ''}`);
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const messageData = JSON.parse(message.value.toString());
        
        // validate message structure
        if (!isValidMessage(messageData)) {
          console.warn(' Invalid message structure received:', messageData);
          return;
        }
        
        // user-specific filtering: only process messages intended for this user
        if (currentUserId && messageData.toUserId !== currentUserId) {
          console.log(` Skipping message for user ${messageData.toUserId} (not intended for ${currentUserId})`);
          return;
        }
        
        // process the message
        console.log(` Processing ${messageData.type} message for user ${messageData.toUserId}`);
        await onMessage(messageData);
        
      } catch (error) {
        console.error(' Error processing Kafka message:', error);
      }
    },
  });
}

// validate message structure and security
function isValidMessage(message) {
  return (
    message &&
    message.messageId &&
    message.timestamp &&
    message.type &&
    message.fromUserId &&
    message.toUserId &&
    message.payload &&
    message.version === '1.0' &&
    message.source === 'luckylink-backend'
  );
}

// generate unique message id
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// send generic analytics event to kafka
async function sendAnalyticsEvent(event) {
  // validate required fields
  if (!event.type || !event.userId) {
    throw new Error('Missing required fields: type, userId');
  }

  // create analytics message payload
  const message = {
    // message metadata
    messageId: generateMessageId(),
    timestamp: new Date().toISOString(),
    type: event.type,
    
    // user information
    userId: event.userId,
    username: event.username || null,
    
    // event-specific metadata
    metadata: event.metadata || {},
    
    // system metadata
    version: '1.0',
    source: 'luckylink-backend',
    serverInstance: process.env.SERVER_INSTANCE || 'default'
  };

  // use userId as message key for partitioning
  const messageKey = event.userId;
  const topic = event.topic || 'user-analytics';

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: messageKey,
          value: JSON.stringify(message),
          headers: {
            'message-type': event.type,
            'user-id': event.userId,
            'timestamp': new Date().toISOString()
          }
        },
      ],
    });
    
    console.log(` Analytics: ${event.type} event for user ${event.username || event.userId}`);
  } catch (error) {
    console.error(' Kafka analytics error:', error);
    // don't throw - analytics failures shouldn't break app functionality
  }
}

// create user-specific consumer for real-time notifications
async function createUserConsumer(userId, onMessage) {
  const userConsumer = kafka.consumer({ 
    groupId: `user-${userId}-friend-requests`,
    sessionTimeout: 30000,
    heartbeatInterval: 3000
  });
  
  await userConsumer.connect();
  await userConsumer.subscribe({ topic: 'friend-requests', fromBeginning: false });
  
  console.log(`👤 Created user-specific consumer for ${userId}`);
  
  await userConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const messageData = JSON.parse(message.value.toString());
        
        // strict filtering: only process messages for this specific user
        if (messageData.toUserId === userId) {
          console.log(` User ${userId} received ${messageData.type} message`);
          await onMessage(messageData);
        }
      } catch (error) {
        console.error(` Error processing message for user ${userId}:`, error);
      }
    },
  });
  
  return userConsumer;
}

// disconnect user-specific consumer
async function disconnectUserConsumer(userConsumer) {
  if (userConsumer) {
    await userConsumer.disconnect();
    console.log(' User consumer disconnected');
  }
}

module.exports = {
  startProducer,
  sendFriendRequestEvent,
  sendAnalyticsEvent,
  startConsumer,
  createUserConsumer,
  disconnectUserConsumer,
  MESSAGE_TYPES,
  isValidMessage
}; 