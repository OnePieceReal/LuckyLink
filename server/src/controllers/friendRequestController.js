const friendRequestModel = require('../models/friendRequest');
const { sendFriendRequestEvent, MESSAGE_TYPES } = require('../services/kafka');
const { getSocketIO } = require('../socket/socket');

// validate uuid format for security
function isValidUUID(uuid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
}

// send friend request between two users
async function sendFriendRequest(req, res) {
  const { sender_id, receiver_id } = req.body;
  if (!isValidUUID(sender_id) || !isValidUUID(receiver_id)) {
    return res.status(400).json({ error: 'Invalid sender_id or receiver_id format' });
  }
  
  // ensure users can only send requests from their own account
  if (req.user.userId !== sender_id) {
    return res.status(403).json({ error: 'You can only send friend requests from your own account' });
  }
  
  if (sender_id === receiver_id) {
    return res.status(400).json({ error: 'Cannot send friend request to yourself' });
  }
  try {
    const request = await friendRequestModel.sendFriendRequest(sender_id, receiver_id);
    
    // get usernames for real-time notifications
    const senderResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [sender_id]);
    const receiverResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [receiver_id]);
    
    const senderUsername = senderResult.rows[0]?.username;
    const receiverUsername = receiverResult.rows[0]?.username;
    
    // send real-time notification via socket.io
    const io = getSocketIO();
    if (io) {
      // notify receiver of new friend request
      io.to(`user:${receiver_id}`).emit('friendRequestReceived', {
        id: request.id,
        sender_id: sender_id,
        sender_username: senderUsername,
        receiver_id: receiver_id,
        receiver_username: receiverUsername,
        status: request.status,
        created_at: request.created_at,
        timestamp: new Date()
      });
      
      // notify sender that request was sent
      io.to(`user:${sender_id}`).emit('friendRequestSent', {
        id: request.id,
        sender_id: sender_id,
        sender_username: senderUsername,
        receiver_id: receiver_id,
        receiver_username: receiverUsername,
        status: request.status,
        created_at: request.created_at,
        timestamp: new Date()
      });
    }
    
    // send kafka notification for logging and analytics
    await sendFriendRequestEvent({ 
      type: MESSAGE_TYPES.FRIEND_REQUEST_SENT,
      fromUserId: sender_id,
      toUserId: receiver_id,
      request,
      status: 'pending'
    });
    
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all friend requests for a specific user
async function getFriendRequestsForUser(req, res) {
  const { user_id } = req.params;
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // ensure users can only view their own friend requests
  if (req.user.userId !== user_id) {
    return res.status(403).json({ error: 'You can only view your own friend requests' });
  }
  
  try {
    const requests = await friendRequestModel.getFriendRequestsForUser(user_id);
    
    // add usernames to response for better readability
    const requestsWithUsernames = await Promise.all(requests.map(async (request) => {
      const senderResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [request.sender_id]);
      const receiverResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [request.receiver_id]);
      
      return {
        ...request,
        sender_username: senderResult.rows[0]?.username,
        receiver_username: receiverResult.rows[0]?.username
      };
    }));
    
    res.json(requestsWithUsernames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// respond to a friend request (accept or reject)
async function respondToFriendRequest(req, res) {
  const { request_id, status, receiver_id } = req.body;
  if (typeof request_id !== 'number' || isNaN(request_id)) {
    return res.status(400).json({ error: 'Invalid request_id' });
  }
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!isValidUUID(receiver_id)) {
    return res.status(400).json({ error: 'Invalid receiver_id format' });
  }
  
  // ensure only the receiver can respond to friend requests
  if (req.user.userId !== receiver_id) {
    return res.status(403).json({ error: 'Only the receiver can respond to a friend request' });
  }
  
  try {
    const request = await friendRequestModel.respondToFriendRequest(request_id, status, receiver_id);
    
    // get sender id from the request
    const sender_id = request.sender_id;
    
    // get usernames for real-time notifications
    const senderResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [sender_id]);
    const receiverResult = await require('../utils/db').query('SELECT username FROM users WHERE id = $1', [receiver_id]);
    
    const senderUsername = senderResult.rows[0]?.username;
    const receiverUsername = receiverResult.rows[0]?.username;
    
    // send real-time notification via socket.io
    const io = getSocketIO();
    if (io) {
      // notify sender of response
      io.to(`user:${sender_id}`).emit('friendRequestResponded', {
        id: request_id,
        sender_id: sender_id,
        sender_username: senderUsername,
        receiver_id: receiver_id,
        receiver_username: receiverUsername,
        status: status,
        responded_by: receiver_id,
        responded_by_username: receiverUsername,
        updated_at: request.updated_at,
        timestamp: new Date()
      });
      
      // notify receiver of update
      io.to(`user:${receiver_id}`).emit('friendRequestUpdated', {
        id: request_id,
        sender_id: sender_id,
        sender_username: senderUsername,
        receiver_id: receiver_id,
        receiver_username: receiverUsername,
        status: status,
        responded_by: receiver_id,
        responded_by_username: receiverUsername,
        updated_at: request.updated_at,
        timestamp: new Date()
      });
    }
    
    // send kafka notification for logging and analytics
    await sendFriendRequestEvent({ 
      type: status === 'accepted' ? MESSAGE_TYPES.FRIEND_REQUEST_ACCEPTED : MESSAGE_TYPES.FRIEND_REQUEST_REJECTED,
      fromUserId: receiver_id, // the responder
      toUserId: sender_id,     // the original sender
      request,
      requestId: request_id,
      status
    });
    
    // if friend request was accepted, broadcast status updates to both users
    if (status === 'accepted') {
      const { broadcastUserStatus } = require('../socket/socket');
      const { socketManager } = require('../utils/redis');
      
      // normalize user id for redis consistency
      const normalizeUserId = (userId) => {
        if (typeof userId === 'string') {
          return userId.toLowerCase();
        }
        return userId;
      };
      
      // delay to ensure socket.io events are processed first
      setTimeout(async () => {
        try {
          // normalize user ids for redis
          const normalizedSenderId = normalizeUserId(sender_id);
          const normalizedReceiverId = normalizeUserId(receiver_id);
          
          // get current status of both users from redis
          const senderStatus = await socketManager.getEffectiveUserStatus(normalizedSenderId);
          const receiverStatus = await socketManager.getEffectiveUserStatus(normalizedReceiverId);
          
          // broadcast status updates to all friends including new friend
          await broadcastUserStatus(receiver_id, receiverStatus);
          await broadcastUserStatus(sender_id, senderStatus);
        } catch (error) {
          // error broadcasting status after friend acceptance
        }
      }, 500); // 500ms delay to ensure all socket events are processed
    }
    
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// delete a friend request
async function deleteFriendRequest(req, res) {
  const { request_id } = req.body;
  if (typeof request_id !== 'number' || isNaN(request_id)) {
    return res.status(400).json({ error: 'Invalid request_id' });
  }
  try {
    // fetch request to check ownership before deletion
    const { query } = require('../utils/db');
    const result = await query('SELECT sender_id, receiver_id FROM friend_requests WHERE id = $1', [request_id]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    // ensure only sender or receiver can delete the request
    const { sender_id, receiver_id } = result.rows[0];
    if (req.user.userId !== sender_id && req.user.userId !== receiver_id) {
      return res.status(403).json({ error: 'You can only delete your own friend requests' });
    }
    
    const request = await friendRequestModel.deleteFriendRequest(request_id);
    if (!request) return res.status(404).json({ error: 'Friend request not found' });
    
    // send real-time notification via socket.io
    const io = getSocketIO();
    if (io) {
      // notify both sender and receiver of deletion
      io.to(`user:${request.sender_id}`).emit('friendRequestDeleted', {
        id: request_id,
        sender_id: request.sender_id,
        receiver_id: request.receiver_id,
        timestamp: new Date()
      });
      
      io.to(`user:${request.receiver_id}`).emit('friendRequestDeleted', {
        id: request_id,
        sender_id: request.sender_id,
        receiver_id: request.receiver_id,
        timestamp: new Date()
      });
    }
    
    res.json({ message: 'Friend request deleted', request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  sendFriendRequest,
  getFriendRequestsForUser,
  respondToFriendRequest,
  deleteFriendRequest,
}; 