const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store connected users and their matching preferences
const connectedUsers = new Map();
const waitingUsers = new Map();
const activeChats = new Map();

console.log('🚀 E2EE Chat Server starting...');

io.on('connection', (socket) => {
  console.log(`📱 User connected: ${socket.id}`);
  
  // Handle user registration with interests
  socket.on('register', (data) => {
    const { username, interests } = data;
    console.log(`👤 User registered: ${username} with interests: ${interests.join(', ')}`);
    
    connectedUsers.set(socket.id, {
      username,
      interests,
      socket
    });
    
    socket.emit('registered', { username });
    
    // Try to find a match
    findMatch(socket.id);
  });
  
  // Handle key exchange messages
  socket.on('key_exchange', (data) => {
    const { targetId, message, type } = data;
    console.log(`🔑 Key exchange (${type}) from ${socket.id} to ${targetId}`);
    
    // Forward the key exchange message to the target user
    const targetSocket = getSocketById(targetId);
    if (targetSocket) {
      targetSocket.emit('key_exchange', {
        senderId: socket.id,
        message,
        type
      });
    }
  });
  
  // Handle encrypted messages
  socket.on('encrypted_message', (data) => {
    const { targetId, encryptedMessage } = data;
    const sender = connectedUsers.get(socket.id);
    
    console.log(`💬 Encrypted message from ${sender?.username || socket.id} to ${targetId}`);
    console.log(`📦 Encrypted data (server cannot read): ${encryptedMessage.substring(0, 50)}...`);
    
    // Forward encrypted message to target user
    const targetSocket = getSocketById(targetId);
    if (targetSocket) {
      targetSocket.emit('encrypted_message', {
        senderId: socket.id,
        senderUsername: sender?.username,
        encryptedMessage
      });
    }
  });
  
  // Handle match requests
  socket.on('find_match', () => {
    findMatch(socket.id);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    console.log(`👋 User disconnected: ${user?.username || socket.id}`);
    
    // Remove from all data structures
    connectedUsers.delete(socket.id);
    waitingUsers.delete(socket.id);
    
    // Notify partner if in active chat
    const chatId = findActiveChatId(socket.id);
    if (chatId) {
      const chat = activeChats.get(chatId);
      const partnerId = chat.user1 === socket.id ? chat.user2 : chat.user1;
      const partnerSocket = getSocketById(partnerId);
      
      if (partnerSocket) {
        partnerSocket.emit('partner_disconnected');
      }
      
      activeChats.delete(chatId);
    }
  });
});

function findMatch(userId) {
  const user = connectedUsers.get(userId);
  if (!user) return;
  
  // Add to waiting list
  waitingUsers.set(userId, user);
  
  // Find a match based on shared interests
  for (const [waitingId, waitingUser] of waitingUsers.entries()) {
    if (waitingId === userId) continue;
    
    const sharedInterests = user.interests.filter(interest => 
      waitingUser.interests.includes(interest)
    );
    
    if (sharedInterests.length > 0) {
      // Match found!
      const chatId = `${userId}_${waitingId}`;
      
      activeChats.set(chatId, {
        user1: userId,
        user2: waitingId,
        sharedInterests
      });
      
      // Remove from waiting list
      waitingUsers.delete(userId);
      waitingUsers.delete(waitingId);
      
      // Notify both users
      const user1Socket = getSocketById(userId);
      const user2Socket = getSocketById(waitingId);
      
      console.log(`🤝 Match found: ${user.username} ↔ ${waitingUser.username}`);
      console.log(`🎯 Shared interests: ${sharedInterests.join(', ')}`);
      
      if (user1Socket) {
        user1Socket.emit('match_found', {
          partnerId: waitingId,
          partnerUsername: waitingUser.username,
          sharedInterests
        });
      }
      
      if (user2Socket) {
        user2Socket.emit('match_found', {
          partnerId: userId,
          partnerUsername: user.username,
          sharedInterests
        });
      }
      
      return;
    }
  }
  
  console.log(`⏳ ${user.username} is waiting for a match...`);
}

function getSocketById(socketId) {
  const user = connectedUsers.get(socketId);
  return user ? user.socket : null;
}

function findActiveChatId(userId) {
  for (const [chatId, chat] of activeChats.entries()) {
    if (chat.user1 === userId || chat.user2 === userId) {
      return chatId;
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌟 E2EE Chat Server running on port ${PORT}`);
  console.log(`📋 Server capabilities:`);
  console.log(`   - Routes encrypted messages (cannot read content)`);
  console.log(`   - Matches users by shared interests`);
  console.log(`   - Facilitates key exchange`);
  console.log(`   - Stateless (no session keys stored)`);
});