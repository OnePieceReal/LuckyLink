const messageModel = require('../models/message');
const friendModel = require('../models/friend');
const { escapeHtml } = require('../utils/sanitizer');

// send message between two users
async function sendMessage(req, res) {
  try {
    let { sender_id, receiver_id, content } = req.body;
    if (!sender_id || !receiver_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // ensure users can only send messages from their own account
    if (req.user.userId !== sender_id) {
      return res.status(403).json({ error: 'You can only send messages from your own account' });
    }
    
    // sanitize message content to prevent xss
    content = escapeHtml(content);
    
    const message = await messageModel.sendMessage({ sender_id, receiver_id, content });
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all messages between two users
async function getMessagesBetweenUsers(req, res) {
  try {
    const { user1_id, user2_id } = req.params;
    
    // ensure users can only view messages they're part of
    if (req.user.userId !== user1_id && req.user.userId !== user2_id) {
      return res.status(403).json({ error: 'You can only view your own messages' });
    }
    
    const messages = await messageModel.getMessagesBetweenUsers(user1_id, user2_id);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// mark single message as read
async function markMessageAsRead(req, res) {
  try {
    const { message_id } = req.body;
    
    // fetch message to check ownership before marking as read
    const { query } = require('../utils/db');
    const result = await query('SELECT receiver_id FROM messages WHERE id = $1', [message_id]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // ensure only receiver can mark message as read
    if (req.user.userId !== result.rows[0].receiver_id) {
      return res.status(403).json({ error: 'Only the message receiver can mark it as read' });
    }
    
    const message = await messageModel.markMessageAsRead(message_id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// mark all messages as read between two users
async function markMessagesAsRead(req, res) {
  try {
    const { receiver_id, sender_id } = req.body;
    
    // ensure only receiver can mark messages as read
    if (req.user.userId !== receiver_id) {
      return res.status(403).json({ error: 'Only the message receiver can mark messages as read' });
    }
    
    const messages = await messageModel.markMessagesAsRead(receiver_id, sender_id);
    res.json({ 
      message: 'Messages marked as read', 
      count: messages.length,
      messageIds: messages.map(m => m.id)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// delete message by id
async function deleteMessage(req, res) {
  try {
    const { message_id } = req.body;
    
    // fetch message to check ownership before deletion
    const { query } = require('../utils/db');
    const result = await query('SELECT sender_id, receiver_id FROM messages WHERE id = $1', [message_id]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // ensure only sender or receiver can delete message
    const { sender_id, receiver_id } = result.rows[0];
    if (req.user.userId !== sender_id && req.user.userId !== receiver_id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    
    const message = await messageModel.deleteMessage(message_id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted', message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// update message content by id
async function updateMessageById(req, res) {
  let { sender_id, receiver_id, message_id, updated_message } = req.body;
  if (!sender_id || !receiver_id || typeof message_id !== 'number' || !updated_message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(sender_id) || !/^[0-9a-fA-F-]{36}$/.test(receiver_id)) {
    return res.status(400).json({ error: 'Invalid sender_id or receiver_id format' });
  }
  if (typeof updated_message !== 'string' || updated_message.length === 0) {
    return res.status(400).json({ error: 'Invalid updated_message' });
  }
  
  // ensure only sender can update their own message
  if (req.user.userId !== sender_id) {
    return res.status(403).json({ error: 'You can only update your own messages' });
  }
  
  // sanitize updated message content
  updated_message = escapeHtml(updated_message);
  
  try {
    const message = await messageModel.updateMessageById(sender_id, receiver_id, message_id, updated_message);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get messages between friended users only
async function getMessagesBetweenFriendedUsers(req, res) {
  const { user1_id, user2_id } = req.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(user1_id) || !/^[0-9a-fA-F-]{36}$/.test(user2_id)) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }
  
  // ensure users can only view messages they're part of
  if (req.user.userId !== user1_id && req.user.userId !== user2_id) {
    return res.status(403).json({ error: 'You can only view your own messages' });
  }
  
  try {
    // verify friendship before allowing message access
    const friends = await friendModel.getFriendsForUser(user1_id);
    const isFriend = friends.some(f => f.id === user2_id);
    if (!isFriend) {
      return res.status(403).json({ error: 'Users are not friends' });
    }
    // get messages between friends
    const messages = await messageModel.getMessagesBetweenUsers(user1_id, user2_id);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  sendMessage,
  getMessagesBetweenUsers,
  markMessageAsRead,
  markMessagesAsRead,
  deleteMessage,
  updateMessageById,
  getMessagesBetweenFriendedUsers,
}; 