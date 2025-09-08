// ========================================
// imports and configuration
// ========================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');
const { socketManager } = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const matchmakingService = require('../services/matchmaking');
const { sendAnalyticsEvent, MESSAGE_TYPES } = require('../services/kafka');

// store active users and their socket mappings (in-memory for fast access)
const activeUsers = new Map();
const userSockets = new Map();
const typingUsers = new Map();
const pendingFriendRequests = new Set();

// status broadcast debounce map to prevent flicker
const statusBroadcastTimers = new Map();

// server-authoritative matchmaking queue
const matchQueue = new Map(); // key = userId, value = { socketId, interests, username }
const activeMatches = new Map(); // key = sessionId, value = { user1, user2, interests }
const skipCooldowns = new Map(); // key = userId, value = Set of users to skip

let io = null;

// ========================================
// helper functions
// ========================================

// create initial system messages for matched users
function createMatchSystemMessages(commonInterests) {
  const messages = [];
  
  // filter out fallback for display purposes
  const specificInterests = commonInterests.filter(interest => interest.toLowerCase() !== 'fallback');
  
  // interest match message
  if (specificInterests.length > 0) {
    // matched on specific interests
    const interestText = specificInterests.length === 1 
      ? specificInterests[0]
      : specificInterests.slice(0, -1).join(', ') + ' and ' + specificInterests[specificInterests.length - 1];
    
    messages.push({
      sender: 'system',
      message: `🎯 You've been matched based on your shared interest in ${interestText}!`,
      timestamp: new Date().toISOString(),
      isSystem: true,
      isRead: true
    });
  } else {
    // matched only on fallback (different specific interests)
    messages.push({
      sender: 'system',
      message: '🎲 You\'ve been matched from the general pool! Start chatting to find common ground.',
      timestamp: new Date().toISOString(),
      isSystem: true,
      isRead: true
    });
  }
  
  // civility reminder
  messages.push({
    sender: 'system',
    message: '💬 Please keep conversations respectful and civil. Report any inappropriate behavior.',
    timestamp: new Date().toISOString(),
    isSystem: true,
    isRead: true
  });
  
  return messages;
}

// ========================================
// matchmaking system
// ========================================

// server-authoritative matchmaking functions with lua script integration
async function enqueueUserForRandom(userId, socketId, interests, username) {
  // prevent duplicate entries in memory
  if (matchQueue.has(userId)) {
    return false;
  }
  
  // check if user is in an active match
  for (const [sessionId, match] of activeMatches) {
    if (match.user1 === userId || match.user2 === userId) {
      return false;
    }
  }
  
  // validate and normalize interests
  const validatedInterests = validateInterests(interests);
  
  // try lua script matchmaking first
  try {
    const result = await matchmakingService.matchUser(userId, validatedInterests);
    
    if (result.matched) {
      // get the matched user's socket data
      const matchedUserSocketId = userSockets.get(result.with);
      const matchedUserSocket = io.sockets.sockets.get(matchedUserSocketId);
      
      if (matchedUserSocket) {
        // check if matched user is already in an active match to prevent race conditions
        const matchedUserInActiveMatch = Array.from(activeMatches.values()).some(match => 
          match.user1 === result.with || match.user2 === result.with
        );
        
        if (matchedUserInActiveMatch) {
          // continue to fallback (in-memory) queue since lua match is invalid
        } else {
          // try to get the matched user's interests from in-memory queue first
          let matchedUserInterests = ['fallback'];
          const matchedUserData = matchQueue.get(result.with);
        
        if (matchedUserData) {
          matchedUserInterests = validateInterests(matchedUserData.interests);
        } else {
          // if not in memory, try to get from redis or fallback to match interest only
          if (result.matchInterest) {
            // at minimum, we know they share the match interest
            matchedUserInterests = [result.matchInterest];
            if (result.matchInterest !== 'fallback') {
              matchedUserInterests.push('fallback');
            }
          }
        }
        
        // calculate actual common interests
        const commonInterests = validatedInterests.filter(interest => 
          matchedUserInterests.includes(interest)
        );
        
        // ensure we have at least the match interest if available
        if (result.matchInterest && !commonInterests.includes(result.matchInterest)) {
          commonInterests.unshift(result.matchInterest);
        }
        
        // ensure we have at least fallback if no common interests
        if (commonInterests.length === 0) {
          commonInterests.push('fallback');
        }
        
          // create session id
          const sessionId = uuidv4();
          
          // Store active match with both individual and common interests
          activeMatches.set(sessionId, {
            user1: userId,
            user2: result.with,
            user1Interests: validatedInterests,
            user2Interests: matchedUserInterests,
            commonInterests: commonInterests
          });
        
        // LUA: Remove both users from in-memory queue since they're now matched
        matchQueue.delete(userId);
        matchQueue.delete(result.with);
         
        // Log random chat started to Kafka
        await sendAnalyticsEvent({
          type: MESSAGE_TYPES.RANDOM_CHAT_STARTED,
          userId: userId,
          username: username,
          metadata: {
            sessionId,
            partnerId: result.with,
            partnerUsername: matchedUserSocket.username,
            commonInterests: commonInterests,
            startTime: new Date().toISOString()
          }
        });
        
        // Create initial system messages with common interests
        const systemMessages = createMatchSystemMessages(commonInterests);
        
        // Emit match found to both users with common interests
        io.to(socketId).emit('matchFound', {
          sessionId,
          partner: matchedUserSocket.username,
          interests: commonInterests,
          systemMessages
        });
        
        io.to(matchedUserSocketId).emit('matchFound', {
          sessionId,
          partner: username,
          interests: commonInterests,
          systemMessages
        });
        
                  // server-side join to room
        const socket1 = io.sockets.sockets.get(socketId);
        const socket2 = io.sockets.sockets.get(matchedUserSocketId);
        
          if (socket1) socket1.join(`random:${sessionId}`);
          if (socket2) socket2.join(`random:${sessionId}`);
          
          return true; // match found via lua
        }
      }
    }
  } catch (error) {
    // fallback to in-memory queue if lua script fails
  }
  
  // fallback to in-memory queue if lua script fails or no match found
  matchQueue.set(userId, { socketId, interests: validatedInterests, username });
  
  // try in-memory matching
  tryMatchUsers();
  
  return true;
}

async function dequeueUser(userId) {
  const userData = matchQueue.get(userId);
  if (userData) {
    matchQueue.delete(userId);
    
    // lua: also remove from redis queues
    try {
      await matchmakingService.removeUserFromQueues(userId, userData.interests, 'left');
    } catch (error) {
      // failed to remove from redis
    }
    
    return userData;
  }
  return null;
}

// validate and normalize interests - hybrid system: specific interests + fallback
function validateInterests(interests) {
  const result = [];
  
  if (Array.isArray(interests) && interests.length > 0) {
    // filter and get specific interests (max 3)
    const filtered = interests
      .filter(i => i && i.trim() !== '' && i.toLowerCase() !== 'fallback')
      .slice(0, 3);
    
    if (filtered.length > 0) {
      result.push(...filtered);
    }
  }
  
  // always add fallback for maximum matching potential
  result.push('fallback');
  
  return result;
}

function haveCommonInterest(interests1, interests2) {
  // validate and normalize interests
  const validInterests1 = validateInterests(interests1);
  const validInterests2 = validateInterests(interests2);
  
  // since validateInterests always includes fallback, users can always match
  // this ensures maximum matching potential with minimal wait times
  return validInterests1.some(interest => validInterests2.includes(interest));
}

function isInSkipCooldown(userId1, userId2) {
  // only check if userId1 has userId2 in their cooldown (unidirectional)
  // this prevents the skipper from matching with the skipped user again
  const cooldown1 = skipCooldowns.get(userId1);
  const cooldown2 = skipCooldowns.get(userId2);
  
  // if userId1 skipped userId2, prevent userId1 from matching with userId2
  if (cooldown1 && cooldown1.has(userId2)) {
    return true;
  }
  
  // if userId2 skipped userId1, prevent userId2 from matching with userId1
  if (cooldown2 && cooldown2.has(userId1)) {
    return true;
  }
  
  return false;
}

function addSkipCooldown(userId, skippedUserId) {
  if (!skipCooldowns.has(userId)) {
    skipCooldowns.set(userId, new Set());
  }
  skipCooldowns.get(userId).add(skippedUserId);
  
  // remove cooldown after 30 seconds
  setTimeout(() => {
    const cooldown = skipCooldowns.get(userId);
    if (cooldown) {
      cooldown.delete(skippedUserId);
      if (cooldown.size === 0) {
        skipCooldowns.delete(userId);
      }
    }
  }, 30000);
}

function tryMatchUsers() {
  const users = Array.from(matchQueue.entries());
  
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const [userId1, userData1] = users[i];
      const [userId2, userData2] = users[j];
      
      // no cooldown check - allow immediate re-matching after skip
      
      // check for common interests
      const validInterests1 = validateInterests(userData1.interests);
      const validInterests2 = validateInterests(userData2.interests);
      
      if (haveCommonInterest(userData1.interests, userData2.interests)) {
        // check if either user is already in an active match to prevent race conditions
        const user1InActiveMatch = Array.from(activeMatches.values()).some(match => 
          match.user1 === userId1 || match.user2 === userId1
        );
        const user2InActiveMatch = Array.from(activeMatches.values()).some(match => 
          match.user1 === userId2 || match.user2 === userId2
        );
        
        if (user1InActiveMatch || user2InActiveMatch) {
          continue; // Skip this match, try next users
        }
        
        // Find common interests (using validated interests)
         const validInterests1 = validateInterests(userData1.interests);
         const validInterests2 = validateInterests(userData2.interests);
         const commonInterests = validInterests1.filter(interest => 
           validInterests2.includes(interest)
         );
        
                  // remove both users from queue
        matchQueue.delete(userId1);
        matchQueue.delete(userId2);
        
        // Create unique session ID
        const sessionId = uuidv4();
        
        // Store active match with both individual and common interests
        activeMatches.set(sessionId, {
          user1: userId1,
          user2: userId2,
          user1Interests: validInterests1,
          user2Interests: validInterests2,
          commonInterests: commonInterests
        });
        
        // Create initial system messages
        const systemMessages = createMatchSystemMessages(commonInterests);
        
        // Emit match found to both users with system messages
        io.to(userData1.socketId).emit('matchFound', {
          sessionId,
          partner: userData2.username,
          interests: commonInterests,
          systemMessages
        });
        
        io.to(userData2.socketId).emit('matchFound', {
          sessionId,
          partner: userData1.username,
          interests: commonInterests,
          systemMessages
        });
        
                  // server-side join to room
        const socket1 = io.sockets.sockets.get(userData1.socketId);
        const socket2 = io.sockets.sockets.get(userData2.socketId);
        
        if (socket1) socket1.join(`random:${sessionId}`);
        if (socket2) socket2.join(`random:${sessionId}`);
        
        return true; // found a match
      }
    }
  }
  
  return false; // no match found
}

async function endMatch(sessionId) {
  const match = activeMatches.get(sessionId);
  if (match) {
    activeMatches.delete(sessionId);
    
    // log random chat ended to kafka (only log once per match)
    await sendAnalyticsEvent({
      type: MESSAGE_TYPES.RANDOM_CHAT_ENDED,
      userId: match.user1,
      username: null, // we don't have username here, but userId is enough
      metadata: {
        sessionId,
        partnerId: match.user2,
        endTime: new Date().toISOString(),
        commonInterests: match.commonInterests || []
      }
    });
    
    return match;
  }
  return null;
}

// function to print current queue status
function printQueueStatus() {
  // debug function - commented out for production
}

// helper function to normalize user id format
function normalizeUserId(userId) {
  if (typeof userId === 'string') {
    return userId.toLowerCase();
  }
  return userId;
}

// helper function to generate friend room id
function generateFriendRoomId(userId1, userId2) {
  const sortedIds = [userId1, userId2].sort();
  return `room:${sortedIds.join(':')}`;
}

// ========================================
// socket initialization
// ========================================

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "https://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    // ensure secure transport
    transports: ["websocket", "polling"],
    upgradeTimeout: 30000,
    pingTimeout: 60000
  });

  // jwt authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // ========================================
  // connection management
  // ========================================

  io.on('connection', async (socket) => {
    
    // Log user connection to Kafka for analytics
    await sendAnalyticsEvent({
      type: MESSAGE_TYPES.USER_CONNECTED,
      userId: socket.userId,
      username: socket.username,
      metadata: {
        socketId: socket.id,
        connectionTime: new Date().toISOString(),
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      }
    });
    
    // Store user connection with better validation and race condition handling
    const normalizedUserId = normalizeUserId(socket.userId);
    
    // handle race conditions: disconnect previous socket if exists and clean up stale redis sockets
    const previousSocket = userSockets.get(normalizedUserId);
    if (previousSocket && previousSocket !== socket.id) {
      try {
        const previousSocketInstance = io.sockets.sockets.get(previousSocket);
        if (previousSocketInstance) {
          previousSocketInstance.disconnect(true);
        }
        // remove the old socket from redis
        await socketManager.removeUserSocket(normalizedUserId, previousSocket);
      } catch (e) {
        // failed to disconnect previous socket
      }
    }
    
    // clean up all stale sockets in redis for this user
    try {
      const existingSockets = await socketManager.getUserSockets(normalizedUserId);
      
      // check which sockets are actually connected
      const activeSockets = [];
      const staleSockets = [];
      
      for (const socketId of existingSockets) {
        const socketInstance = io.sockets.sockets.get(socketId);
        if (socketInstance && socketInstance.connected) {
          activeSockets.push(socketId);
        } else {
          staleSockets.push(socketId);
        }
      }
      
      // remove all stale sockets from redis
      for (const staleSocketId of staleSockets) {
        await socketManager.removeUserSocket(normalizedUserId, staleSocketId);
      }
    } catch (error) {
      // error cleaning up stale sockets
    }
    
    // update in-memory mappings
    activeUsers.set(socket.id, { userId: normalizedUserId, username: socket.username });
    userSockets.set(normalizedUserId, socket.id);
    
    // store in redis for persistence across server instances
    try {
      await socketManager.addUserSocket(normalizedUserId, socket.id);
      
      // get the user's current status from database first, then redis as fallback
      let effectiveStatus;
      try {
        const userResult = await query('SELECT status FROM users WHERE id = $1', [socket.userId]);
        const dbStatus = userResult.rows[0]?.status;
        
        // Use database status if it's not 'offline', otherwise use Redis last known status
        if (dbStatus && dbStatus !== 'offline') {
          effectiveStatus = dbStatus;
        } else {
          const lastKnownStatus = await socketManager.getLastKnownStatus(normalizedUserId);
          effectiveStatus = lastKnownStatus || 'online';
        }
      } catch (dbError) {
        const lastKnownStatus = await socketManager.getLastKnownStatus(normalizedUserId);
        effectiveStatus = lastKnownStatus || 'online';
      }
      
      // Update both Redis and database to ensure consistency
      await Promise.all([
        socketManager.setUserStatus(normalizedUserId, effectiveStatus),
        socketManager.setLastKnownStatus(normalizedUserId, effectiveStatus),
        updateUserStatus(socket.userId, effectiveStatus, true)
      ]);
      
      // Broadcast the user's status to friends when they reconnect
      broadcastUserStatus(socket.userId, effectiveStatus);
      
    } catch (error) {
      // failed to store socket in redis
    }
    
    
    // join user's personal room for direct messages
    socket.join(`user:${normalizedUserId}`);
    
    // join friend rooms for all online friends (both directions)
    try {
      const friendsResult = await query(
        'SELECT friend_id FROM friends WHERE user_id = $1 UNION SELECT user_id FROM friends WHERE friend_id = $1',
        [socket.userId]
      );
      
      for (const friend of friendsResult.rows) {
        const friendId = friend.friend_id || friend.user_id;
        const friendRoomId = generateFriendRoomId(normalizedUserId, normalizeUserId(friendId));
        socket.join(friendRoomId);
        await socketManager.addToFriendRoom(normalizedUserId, normalizeUserId(friendId), socket.id);
      }
    } catch (error) {
      // error joining friend rooms
    }
    
    // handle friend request accepted - join new friend room
    socket.on('friendRequestAccepted', async (data) => {
      const { friendId } = data;
      const normalizedFriendId = normalizeUserId(friendId);
      const roomId = generateFriendRoomId(normalizedUserId, normalizedFriendId);
      
      socket.join(roomId);
      await socketManager.addToFriendRoom(normalizedUserId, normalizedFriendId, socket.id);
      
      // notify the other user to join the room too
      const friendSocketId = userSockets.get(normalizedFriendId);
      if (friendSocketId) {
        io.to(friendSocketId).emit('joinFriendRoom', { roomId });
      }
    });
    
    // handle room joining
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });

    // handle room leaving
    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
    });

    // ========================================
    // messaging system
    // ========================================

    // handle messaging
    socket.on('sendMessage', async (data) => {
      const { roomId, message, receiverId } = data;
      
      // validate receiver id
      if (!receiverId) {
        socket.emit('error', { message: 'No receiver ID provided' });
        return;
      }
      
      const normalizedReceiverId = normalizeUserId(receiverId);
      const normalizedSenderId = normalizeUserId(socket.userId);
      
      // store message in database with encryption
      let storedMessage = null;
      try {
        const messageModel = require('../models/message');
        storedMessage = await messageModel.sendMessage({
          sender_id: socket.userId,
          receiver_id: receiverId,
          content: message
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to store message' });
        return;
      }
      
      // Create message object with database ID
      const messageObj = {
        id: storedMessage.id, // Include database ID for read status
        sender: socket.username,
        message: message,
        timestamp: new Date(),
        isRead: false
      };
      
      // Multi-strategy message delivery for friend chat
      let messageDelivered = false;
      
      // Strategy 1: Direct socket delivery
      const receiverSocketId = userSockets.get(normalizedReceiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', {
          ...messageObj,
          isReceived: true
        });
        messageDelivered = true;
      }
      
      // Strategy 2: Friend room delivery
      if (!messageDelivered) {
        const friendRoomId = generateFriendRoomId(normalizedSenderId, normalizedReceiverId);
        const roomMembers = await socketManager.getRoomMembers(normalizedSenderId, normalizedReceiverId);
        
        if (roomMembers.length > 0) {
          roomMembers.forEach(socketId => {
            if (socketId !== socket.id) { // Don't send to sender
              io.to(socketId).emit('newMessage', {
                ...messageObj,
                isReceived: true
              });
            }
          });
          messageDelivered = true;
        }
      }
      
      // Strategy 3: Redis fallback
      if (!messageDelivered) {
        try {
          const receiverSockets = await socketManager.getUserSockets(normalizedReceiverId);
          if (receiverSockets.length > 0) {
            receiverSockets.forEach(socketId => {
              io.to(socketId).emit('newMessage', {
                ...messageObj,
                isReceived: true
              });
            });
            messageDelivered = true;
          }
        } catch (error) {
          // error sending message via redis
        }
      }
      
      // Strategy 4: Personal room fallback
      if (!messageDelivered) {
        io.to(`user:${normalizedReceiverId}`).emit('newMessage', {
          ...messageObj,
          isReceived: true
        });
        messageDelivered = true;
      }
      
      // Strategy 5: Broadcast fallback (last resort)
      if (!messageDelivered) {
        io.emit('newMessage', {
          ...messageObj,
          isReceived: true
        });
      }
      
      // Send confirmation to sender
      socket.emit('newMessage', {
        ...messageObj,
        isReceived: false
      });
    });

    // Handle typing indicators
    socket.on('typingStart', (data) => {
      const { receiverId } = data;
      const normalizedReceiverId = normalizeUserId(receiverId);
      const normalizedSenderId = normalizeUserId(socket.userId);
      
      // send to specific recipient only
      const receiverSocketId = userSockets.get(normalizedReceiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', {
          fromUserId: normalizedSenderId,
          fromUsername: socket.username
        });
      } else {
        // fallback to redis
        socketManager.getUserSockets(normalizedReceiverId).then(sockets => {
          sockets.forEach(socketId => {
            io.to(socketId).emit('userTyping', {
              fromUserId: normalizedSenderId,
              fromUsername: socket.username
            });
          });
        });
      }
    });

    socket.on('typingStop', (data) => {
      const { receiverId } = data;
      const normalizedReceiverId = normalizeUserId(receiverId);
      const normalizedSenderId = normalizeUserId(socket.userId);
      
      // send to specific recipient only
      const receiverSocketId = userSockets.get(normalizedReceiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userStopTyping', {
          fromUserId: normalizedSenderId,
          fromUsername: socket.username
        });
      } else {
        // fallback to redis
        socketManager.getUserSockets(normalizedReceiverId).then(sockets => {
          sockets.forEach(socketId => {
            io.to(socketId).emit('userStopTyping', {
              fromUserId: normalizedSenderId,
              fromUsername: socket.username
            });
          });
        });
      }
    });

    // handle marking messages as read
    socket.on('markMessagesAsRead', async (data) => {
      const { withUserId } = data;
      const normalizedReceiverId = normalizeUserId(socket.userId);
      const normalizedSenderId = normalizeUserId(withUserId);
      
      try {
        // mark messages as read in database
        const messageModel = require('../models/message');
        const messages = await messageModel.markMessagesAsRead(normalizedReceiverId, normalizedSenderId);
        
        if (messages.length > 0) {
          // notify sender that messages were read
          const senderSocketId = userSockets.get(normalizedSenderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messagesRead', {
              messageIds: messages.map(m => m.id),
              readBy: normalizedReceiverId,
              readByUsername: socket.username,
              readAt: new Date()
            });
          } else {
            // fallback to redis
            const senderSockets = await socketManager.getUserSockets(normalizedSenderId);
            senderSockets.forEach(socketId => {
              io.to(socketId).emit('messagesRead', {
                messageIds: messages.map(m => m.id),
                readBy: normalizedReceiverId,
                readByUsername: socket.username,
                readAt: new Date()
              });
            });
          }
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // add chat_seen event handler after markMessagesAsRead
    socket.on('chat_seen', async ({ chatId, friendId }) => {
      try {
        // Mark all messages from friendId to this user as read
        const messageModel = require('../models/message');
        const messages = await messageModel.markMessagesAsRead(socket.userId, friendId);
        
        if (messages.length > 0) {
          // Notify the sender (friendId) that their messages were seen
          const senderSocketId = userSockets.get(normalizeUserId(friendId));
          
          if (senderSocketId) {
            io.to(senderSocketId).emit('messages_seen_by_other', {
              chatId: null, // If you have a chatId, use it here
              friendId: socket.userId,
              friendUsername: socket.username, // Add the username
            });
          } else {
            // fallback to redis
            const senderSockets = await socketManager.getUserSockets(normalizeUserId(friendId));
            senderSockets.forEach(socketId => {
              io.to(socketId).emit('messages_seen_by_other', {
                chatId: null,
                friendId: socket.userId,
                friendUsername: socket.username, // Add the username
              });
            });
          }
        }
      } catch (error) {
        // error in chat_seen
      }
    });

    // Handle random chat seen event
    socket.on('randomChatSeen', ({ sessionId, matchedUser }) => {
      const userId = socket.userId;
      const username = socket.username;
      
      // Find the matched user's socket
      const matchedUserSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.userId && s.userId !== userId && s.username === matchedUser
      );
      
      if (matchedUserSocket) {
        // Notify the matched user that their messages were seen
        matchedUserSocket.emit('randomMessagesSeenByOther', {
          matchedUser: username
        });
      }
    });

    // Handle status updates
    socket.on('updateStatus', async (data) => {
      const { status } = data;
      const normalizedUserId = normalizeUserId(socket.userId);
      
      try {
        // Get previous status for analytics
        const previousStatus = await socketManager.getUserStatus(normalizedUserId);
        
        // Log status change to Kafka
        await sendAnalyticsEvent({
          type: MESSAGE_TYPES.USER_STATUS_CHANGED,
          userId: socket.userId,
          username: socket.username,
          metadata: {
            previousStatus: previousStatus || 'unknown',
            newStatus: status,
            statusChangeTime: new Date().toISOString()
          }
        });
        
        // update all status sources atomically to prevent race conditions
        await Promise.all([
          socketManager.updateUserStatus(normalizedUserId, status),
          socketManager.setLastKnownStatus(normalizedUserId, status), // Ensure last known status is updated
          updateUserStatus(socket.userId, status, true),
          query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [socket.userId])
        ]);
        
        // Broadcast status change to friends with debounce to prevent flicker
        await broadcastUserStatus(socket.userId, status);
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // handle force disconnect (for page unload)
    socket.on('forceDisconnect', async () => {
      try {
        const normalizedUserId = normalizeUserId(socket.userId);
        
        // get and preserve the current non-offline status as last known status
        const currentStatus = await socketManager.getUserStatus(normalizedUserId);
        if (currentStatus && currentStatus !== 'offline') {
          await socketManager.setLastKnownStatus(normalizedUserId, currentStatus);
        }
        
        // mark user as offline immediately for friends
        await Promise.all([
          updateUserStatus(socket.userId, 'offline', false),
          socketManager.setUserStatus(normalizedUserId, 'offline')
        ]);
        
        // Broadcast offline status to friends
        await broadcastUserStatus(socket.userId, 'offline');
        
      } catch (error) {
        // error in force disconnect
      }
    });

    // handle force connect (for page visibility change)
    socket.on('forceConnect', async () => {
      try {
        const normalizedUserId = normalizeUserId(socket.userId);
        
        // get the user's current status from database first (most authoritative)
        let effectiveStatus;
        try {
          const userResult = await query('SELECT status FROM users WHERE id = $1', [socket.userId]);
          const dbStatus = userResult.rows[0]?.status;
          
          // if database has a non-offline status, use it; otherwise fall back to redis
          if (dbStatus && dbStatus !== 'offline') {
            effectiveStatus = dbStatus;
          } else {
            const lastKnownStatus = await socketManager.getLastKnownStatus(normalizedUserId);
            effectiveStatus = lastKnownStatus || 'online';
          }
        } catch (dbError) {
          const lastKnownStatus = await socketManager.getLastKnownStatus(normalizedUserId);
          effectiveStatus = lastKnownStatus || 'online';
        }
        
        // update all status sources atomically
        await Promise.all([
          updateUserStatus(socket.userId, effectiveStatus, true),
          socketManager.setUserStatus(normalizedUserId, effectiveStatus)
        ]);
        
        // broadcast status to friends
        await broadcastUserStatus(socket.userId, effectiveStatus);
        
      } catch (error) {
        // error in force connect
      }
    });

    // ========================================
    // random chat system
    // ========================================

    // handle random chat events
    socket.on('enqueueForRandom', async (data) => {
      const { interests } = data;
      
      if (!Array.isArray(interests)) {
        socket.emit('queueJoinFailed', { reason: 'invalid_interests' });
        return;
      }
      
      try {
        const success = await enqueueUserForRandom(socket.userId, socket.id, interests, socket.username);
        
        if (success) {
          socket.emit('queueJoined');
          printQueueStatus();
        } else {
          socket.emit('queueJoinFailed', { reason: 'already_in_queue_or_match' });
        }
      } catch (error) {
        socket.emit('queueJoinFailed', { reason: 'server_error' });
      }
    });

    socket.on('cancelMatchmaking', async () => {
      await dequeueUser(socket.userId);
      socket.emit('matchCancelled');
    });

    socket.on('skipMatch', async (data) => {
      const { sessionId } = data;
      
      const match = activeMatches.get(sessionId);
      if (!match) {
        return;
      }
      
      // Verify this user is actually in this match
      if (match.user1 !== socket.userId && match.user2 !== socket.userId) {
        return;
      }
      
      // Determine which user is being skipped
      const otherUserId = match.user1 === socket.userId ? match.user2 : match.user1;
      const otherSocketId = userSockets.get(otherUserId);
      
      if (otherSocketId) {
        // End the current match (no cooldown - allow immediate re-matching)
        await endMatch(sessionId);
        
        // Notify the other user
        io.to(otherSocketId).emit('randomUserSkipped', {
          skippedBy: socket.username
        });
        
        // Re-enqueue both users with their original interests
        const currentUserInterests = match.user1 === socket.userId ? match.user1Interests : match.user2Interests;
        const otherUserInterests = match.user1 === socket.userId ? match.user2Interests : match.user1Interests;
        
        // Get the other user's socket to find their username
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        const otherUsername = otherSocket ? otherSocket.username : 'unknown';
        
        // Clear active status for both users so they can re-queue
        await matchmakingService.redis.del(`active:${socket.userId}`);
        await matchmakingService.redis.del(`active:${otherUserId}`);
        
        // Re-enqueue both users so they can match with others
        await enqueueUserForRandom(socket.userId, socket.id, currentUserInterests, socket.username);
        await enqueueUserForRandom(otherUserId, otherSocketId, otherUserInterests, otherUsername);
        
        printQueueStatus();
      }
    });

    socket.on('endMatch', async (data) => {
      const { sessionId } = data;
      
      const match = activeMatches.get(sessionId);
      if (!match) {
        return;
      }
      
      // Verify this user is actually in this match
      if (match.user1 !== socket.userId && match.user2 !== socket.userId) {
        return;
      }
      
      // End the match (remove from activeMatches)
      await endMatch(sessionId);
      
      // Determine which user is ending the match
      const otherUserId = match.user1 === socket.userId ? match.user2 : match.user1;
      const otherSocketId = userSockets.get(otherUserId);
      
      if (otherSocketId) {
        // Notify the other user
        io.to(otherSocketId).emit('randomChatEnded', {
          endedBy: socket.username
        });
        
        // Re-enqueue only the other user with their original interests
        const otherUserInterests = match.user1 === socket.userId ? match.user2Interests : match.user1Interests;
        
        // Get the other user's socket to find their username
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        const otherUsername = otherSocket ? otherSocket.username : 'unknown';
        
        // Clear active status for the other user so they can re-queue
        await matchmakingService.redis.del(`active:${otherUserId}`);
        
        await enqueueUserForRandom(otherUserId, otherSocketId, otherUserInterests, otherUsername);
        
        printQueueStatus();
      }
    });

    socket.on('joinRandomChat', (data) => {
      const { sessionId, matchedUser } = data;
      const randomRoomId = `random:${sessionId}`;
      
      socket.join(randomRoomId);
      
      // Get room members after joining
      const room = io.sockets.adapter.rooms.get(randomRoomId);
      const roomMembers = room ? Array.from(room) : [];
    });

    socket.on('sendRandomMessage', (data) => {
      const { message, receiverId, sessionId, isEncrypted, encryptedData } = data;
      
      // Create message object for random chat (no persistence)
      const messageObj = {
        sender: socket.username,
        message: isEncrypted ? null : message, // Don't send plaintext if encrypted
        encryptedData: isEncrypted ? encryptedData : null, // Send encrypted data
        isEncrypted: isEncrypted || false,
        sessionId: sessionId, // Include session ID for E2EE context
        timestamp: new Date(),
        isReceived: false
      };
      
      // Send to random chat room
      const randomRoomId = `random:${sessionId || socket.userId}`;
      
      // Get room members for debugging
      const room = io.sockets.adapter.rooms.get(randomRoomId);
      const roomMembers = room ? Array.from(room) : [];
      
      // Send to all users in the room (including sender)
      io.in(randomRoomId).emit('randomMessage', {
        ...messageObj,
        isReceived: true
      });
      // also send a copy to the sender with isReceived: false for ui update
      socket.emit('randomMessage', {
        ...messageObj,
        isReceived: false
      });
    });

    // Handle random chat typing indicators
    socket.on('randomTypingStart', (data) => {
      const { sessionId } = data;
      const randomRoomId = `random:${sessionId}`;
      socket.to(randomRoomId).emit('randomTypingStart', {
        username: socket.username
      });
    });

    socket.on('randomTypingStop', (data) => {
      const { sessionId } = data;
      const randomRoomId = `random:${sessionId}`;
      socket.to(randomRoomId).emit('randomTypingStop', {
        username: socket.username
      });
    });

    // Handle E2EE key exchange for random chat (no persistence)
    socket.on('e2ee_key_exchange', (data) => {
      const { sessionId, targetUser, message, type } = data;
      
      // Validate session exists
      const match = activeMatches.get(sessionId);
      if (!match) {
        return;
      }
      
      // Forward key exchange to the target user in the random chat room
      const randomRoomId = `random:${sessionId}`;
      socket.to(randomRoomId).emit('e2ee_key_exchange', {
        sessionId,
        senderId: socket.userId,
        senderUsername: socket.username,
        message,
        type
      });
    });

    // Handle E2EE key rotation for random chat
    socket.on('e2ee_key_rotation', (data) => {
      const { sessionId, newRatchetPublicKey, type } = data;
      
      // Validate session exists
      const match = activeMatches.get(sessionId);
      if (!match) {
        return;
      }
      
      // Forward key rotation to the partner in the random chat room
      const randomRoomId = `random:${sessionId}`;
      socket.to(randomRoomId).emit('e2ee_key_rotation', {
        sessionId,
        senderId: socket.userId,
        senderUsername: socket.username,
        newRatchetPublicKey,
        type
      });
    });

    // Handle E2EE session ready notification
    socket.on('e2ee_session_ready', (data) => {
      const { sessionId } = data;
      
      // Validate session exists
      const match = activeMatches.get(sessionId);
      if (!match) {
        return;
      }
      
      // Create secure connection established message as proper system message
      const secureConnectionMessage = {
        sender: 'system',
        message: '🔒 Secure connection established! Your messages are now end-to-end encrypted.',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        isSystem: true,
        isRead: true,
        isEncrypted: false // System message is not encrypted
      };
      
      // Send to the random chat room as a system message (same format as other system messages)
      const randomRoomId = `random:${sessionId}`;
      io.in(randomRoomId).emit('randomMessage', {
        ...secureConnectionMessage,
        isReceived: true
      });
    });

    // Handle partner tab switching notifications
    socket.on('partnerTabSwitch', (data) => {
      const { sessionId, isVisible } = data;
      
      // Validate that this user is actually in this session
      const match = activeMatches.get(sessionId);
      if (!match || (match.user1 !== normalizeUserId(socket.userId) && match.user2 !== normalizeUserId(socket.userId))) {
        return;
      }
      
      // Notify the partner about the tab switch
      const randomRoomId = `random:${sessionId}`;
      socket.to(randomRoomId).emit('partnerTabSwitch', {
        partnerName: socket.username,
        isVisible: isVisible
      });
    });

    socket.on('skipRandomUser', async (data) => {
      const { currentMatchedUser, interests } = data;
      
      // Get the skipped user's ID from the database
      const { query } = require('../utils/db');
      const skippedUserResult = await query('SELECT id FROM users WHERE username = $1', [currentMatchedUser]);
      const skippedUserId = skippedUserResult.rows[0]?.id;
      
      if (skippedUserId) {
        // Notify the skipped user that they were skipped
        const io = getSocketIO();
        const roomName = `user:${skippedUserId}`;
        
        io.to(roomName).emit('randomUserSkipped', {
          skippedBy: socket.username
        });
      }
    });

    socket.on('endRandomChat', async (data) => {
      const { otherUser, interests } = data;
      
      // Get the other user's ID from the database
      const { query } = require('../utils/db');
      const otherUserResult = await query('SELECT id FROM users WHERE username = $1', [otherUser]);
      const otherUserId = otherUserResult.rows[0]?.id;
      
      if (otherUserId) {
        // Notify the other user that the chat has ended
        const io = getSocketIO();
        const roomName = `user:${otherUserId}`;
        
        io.to(roomName).emit('randomChatEnded', {
          endedBy: socket.username
        });
      }
    });

    socket.on('leaveRandomChat', (data) => {
      const { sessionId } = data;
      const randomRoomId = `random:${sessionId || socket.userId}`;
      socket.leave(randomRoomId);
    });

    // ========================================
    // disconnection handling
    // ========================================

    // handle disconnection
    socket.on('disconnect', async () => {
      try {
        // Log user disconnection to Kafka for analytics
        await sendAnalyticsEvent({
          type: MESSAGE_TYPES.USER_DISCONNECTED,
          userId: socket.userId,
          username: socket.username,
          metadata: {
            socketId: socket.id,
            disconnectionTime: new Date().toISOString(),
            sessionDuration: socket.handshake.time ? 
              (new Date() - new Date(socket.handshake.time)) / 1000 : null // Duration in seconds
          }
        });
        
        // Handle matchmaking cleanup first
        const disconnectedUserId = normalizeUserId(socket.userId);
        let partnerUserId = null;
        let sessionId = null;
        
        // Check if user is in an active match
        for (const [activeSessionId, match] of activeMatches) {
          if (match.user1 === disconnectedUserId || match.user2 === disconnectedUserId) {
            sessionId = activeSessionId;
            partnerUserId = match.user1 === disconnectedUserId ? match.user2 : match.user1;
            break;
          }
        }
        
        // If user was in a match, handle partner
        if (partnerUserId && sessionId) {
          // Get the match before ending it to retrieve partner's interests
          const match = activeMatches.get(sessionId);
          const partnerInterests = match ? (match.user1 === disconnectedUserId ? match.user2Interests : match.user1Interests) : [];
          
          // End the match
          await endMatch(sessionId);
          
          // Get partner's socket and username
          const partnerSocketId = userSockets.get(partnerUserId);
          const partnerSocket = io.sockets.sockets.get(partnerSocketId);
          const partnerUsername = partnerSocket ? partnerSocket.username : 'Unknown';
          
          // Notify partner they were skipped due to disconnect
          if (partnerSocket) {
            io.to(partnerSocketId).emit('randomUserSkipped', { 
              skippedBy: socket.username,
              reason: 'disconnect'
            });
            
            // Re-enqueue the partner for a new match with their original interests
            try {
              await enqueueUserForRandom(partnerUserId, partnerSocketId, partnerInterests, partnerUsername);
            } catch (error) {
              // failed to re-enqueue partner
            }
          }
        }
        
        // Remove disconnected user from matchmaking queue
        dequeueUser(disconnectedUserId, socket.username);
        
        // Remove from active users
        activeUsers.delete(socket.id);
        const normalizedUserId = normalizeUserId(socket.userId);
        
        // Get last known status before disconnecting - but keep it for reconnection
        const lastKnownStatus = await socketManager.getLastKnownStatus(normalizedUserId);
        
        // Update user's offline status in database but preserve last known status in Redis
        await updateUserStatus(socket.userId, 'offline', false);
        
        // Keep the last known status in Redis for when they reconnect
        if (lastKnownStatus && lastKnownStatus !== 'offline') {
          await socketManager.setLastKnownStatus(normalizedUserId, lastKnownStatus);
        }
        
        // Only remove from userSockets if this is the current socket for this user
        const currentSocketId = userSockets.get(normalizedUserId);
        if (currentSocketId === socket.id) {
          userSockets.delete(normalizedUserId);
        }
        
        // Remove from Redis
        try {
          await socketManager.removeUserSocket(normalizedUserId, socket.id);
          
          // Check if user has any remaining sockets
          const remainingSockets = await socketManager.getUserSockets(normalizedUserId);
          if (remainingSockets.length === 0) {
            await socketManager.setUserStatus(normalizedUserId, 'offline');
            
            // Broadcast offline status to friends
            await broadcastUserStatus(socket.userId, 'offline');
            
            // Notify users in random chat if this user was in a random chat
            const io = getSocketIO();
            io.to(`random:${socket.userId}`).emit('randomUserDisconnected', {
              disconnectedUser: socket.username
            });
          }
          
          // Remove from friend rooms (both directions)
          const friendsResult = await query(
            'SELECT friend_id FROM friends WHERE user_id = $1 UNION SELECT user_id FROM friends WHERE friend_id = $1',
            [socket.userId]
          );
          
          for (const friend of friendsResult.rows) {
            const friendId = friend.friend_id || friend.user_id;
            await socketManager.removeFromFriendRoom(normalizedUserId, normalizeUserId(friendId), socket.id);
          }
        } catch (error) {
          // Even if Redis cleanup fails, still broadcast offline status
          await broadcastUserStatus(socket.userId, 'offline');
        }
        
      } catch (error) {
        // Try to broadcast offline status even if there's an error
        try {
          await broadcastUserStatus(socket.userId, 'offline');
        } catch (broadcastError) {
          // error broadcasting offline status
        }
      }
    });
  });

  // Start heartbeat system to detect disconnected users
  startHeartbeatSystem(io);
  
  // Start periodic Redis socket cleanup
  startRedisSocketCleanup(io);
  
  return io;
}

// Helper function to update user status in database
async function updateUserStatus(userId, status, isOnline) {
  try {
    await query(
      'UPDATE users SET status = $1, is_online = $2, last_active_at = CURRENT_TIMESTAMP WHERE id = $3',
      [status, isOnline, userId]
    );
  } catch (error) {
    // error updating user status
  }
}

// Helper function to broadcast user status to friends with debounce to prevent flicker
async function broadcastUserStatus(userId, status) {
  try {
    const normalizedUserId = normalizeUserId(userId);
    
    // Clear existing timer to debounce rapid status changes
    if (statusBroadcastTimers.has(normalizedUserId)) {
      clearTimeout(statusBroadcastTimers.get(normalizedUserId));
    }
    
    // Debounce status broadcasts by 100ms to prevent flicker
    const timerId = setTimeout(async () => {
      try {
        
        // Get the username of the user whose status changed
        const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
        const username = userResult.rows[0]?.username;
        
        if (!username) {
          return;
        }
        
        // Create the status update event data
        const statusEvent = {
          userId: normalizedUserId,
          username: username,
          status,
          timestamp: new Date()
        };
        
        // Send status update to the user themselves (for their own profile icon)
        const userSocketId = userSockets.get(normalizedUserId);
        if (userSocketId) {
          io.to(userSocketId).emit('userStatusChanged', statusEvent);
        } else {
          // fallback to redis for the user themselves
          try {
            const userSocketsFromRedis = await socketManager.getUserSockets(normalizedUserId);
            if (userSocketsFromRedis.length > 0) {
              userSocketsFromRedis.forEach(socketId => {
                io.to(socketId).emit('userStatusChanged', statusEvent);
              });
            }
          } catch (error) {
            // error broadcasting status to user via redis
          }
        }
        
        // Get user's friends (both directions - where user is user_id OR friend_id)
        const friendsResult = await query(
          'SELECT friend_id FROM friends WHERE user_id = $1 UNION SELECT user_id FROM friends WHERE friend_id = $1',
          [userId]
        );

        const friends = friendsResult.rows.map(row => normalizeUserId(row.friend_id || row.user_id));
        
        // Broadcast to all online friends
        for (const friendId of friends) {
          // Try direct socket ID first
          const friendSocketId = userSockets.get(friendId);
          if (friendSocketId) {
            io.to(friendSocketId).emit('userStatusChanged', statusEvent);
          } else {
            // fallback to redis
            try {
              const friendSockets = await socketManager.getUserSockets(friendId);
              if (friendSockets.length > 0) {
                friendSockets.forEach(socketId => {
                  io.to(socketId).emit('userStatusChanged', statusEvent);
                });
              }
            } catch (error) {
              // error broadcasting status to friend via redis
            }
          }
        }
        
        
        // Clean up the timer
        statusBroadcastTimers.delete(normalizedUserId);
      } catch (error) {
        // error in debounced status broadcast
        statusBroadcastTimers.delete(normalizedUserId);
      }
    }, 100); // 100ms debounce
    
    // Store the timer
    statusBroadcastTimers.set(normalizedUserId, timerId);
  } catch (error) {
    // error setting up status broadcast debounce
  }
}

// Helper function to get online friends
async function getOnlineFriends(userId) {
  try {
    const result = await query(
      `SELECT f.friend_id, u.username, u.status 
       FROM friends f 
       JOIN users u ON f.friend_id = u.id 
       WHERE f.user_id = $1 AND u.is_online = true`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    return [];
  }
}

// Periodic Redis socket cleanup to remove stale sockets
function startRedisSocketCleanup(io) {
  // Run every 30 seconds
  setInterval(async () => {
    try {
      // Get all Redis socket keys
      const pattern = 'user_socket:*';
      const { redis } = require('../utils/redis');
      const keys = await redis.keys(pattern);
      
      let totalCleaned = 0;
      
      for (const key of keys) {
        const userId = key.replace('user_socket:', '');
        const sockets = await redis.hgetall(key);
        const socketIds = Object.keys(sockets);
        
        if (socketIds.length === 0) continue;
        
        let staleSockets = 0;
        for (const socketId of socketIds) {
          const socketInstance = io.sockets.sockets.get(socketId);
          if (!socketInstance || !socketInstance.connected) {
            await redis.hdel(key, socketId);
            staleSockets++;
            totalCleaned++;
          }
        }
      }
      
    } catch (error) {
      // error in periodic socket cleanup
    }
  }, 30000); // Every 30 seconds
}

// Heartbeat system to detect disconnected users
function startHeartbeatSystem(io) {
  // Run every 15 seconds (more frequent)
  setInterval(async () => {
    try {
      // Get all users marked as online in database
      const onlineUsersResult = await query(
        'SELECT id, username, last_active_at FROM users WHERE is_online = true',
        []
      );
      
      const now = new Date();
      const timeoutThreshold = 60 * 1000; // 1 minute (more aggressive)
      
      for (const user of onlineUsersResult.rows) {
        const lastActive = new Date(user.last_active_at);
        const timeSinceLastActive = now - lastActive;
        
        // Check if user has been inactive for too long
        if (timeSinceLastActive > timeoutThreshold) {
          // Check if user actually has active sockets
          const normalizedUserId = normalizeUserId(user.id);
          const isActuallyOnline = await socketManager.isUserOnline(normalizedUserId);
          
          if (!isActuallyOnline) {
            // Clean up any remaining Redis socket entries for this user
            const redisKey = `user_socket:${normalizedUserId}`;
            try {
              const { redis } = require('../utils/redis');
              await redis.del(redisKey);
            } catch (error) {
              // error clearing redis socket key
            }
            
            // Update database
            await updateUserStatus(user.id, 'offline', false);
            
            // Update Redis
            await socketManager.setUserStatus(normalizedUserId, 'offline');
            
            // Broadcast offline status to friends
            await broadcastUserStatus(user.id, 'offline');
            
          } else {
            // Update last_active_at to prevent false positives
            await query(
              'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
              [user.id]
            );
          }
        }
      }
      
    } catch (error) {
      // error in heartbeat system
    }
  }, 15000); // Check every 15 seconds
}

// ========================================
// utility functions
// ========================================

// helper function to send notifications
function sendNotification(userId, notification) {
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', notification);
  }
}

// export the io instance for use in controllers
function getSocketIO() {
  return io;
}

module.exports = {
  initializeSocket,
  getSocketIO,
  broadcastUserStatus,
  updateUserStatus,
  getOnlineFriends,
  sendNotification
};