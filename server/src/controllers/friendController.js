const friendModel = require('../models/friend');

// add friend relationship between two users
async function addFriend(req, res) {
  try {
    const { user_id, friend_id } = req.body;
    
    // ensure users can only add friends for themselves
    if (req.user.userId !== user_id) {
      return res.status(403).json({ error: 'You can only add friends for your own account' });
    }
    
    const friendship = await friendModel.addFriend(user_id, friend_id);
    res.status(201).json(friendship);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all friends for a specific user
async function getFriendsForUser(req, res) {
  try {
    const { user_id } = req.params;
    
    // prevent users from viewing other users' friends lists
    if (req.user.userId !== user_id) {
      return res.status(403).json({ error: 'You can only view your own friends list' });
    }
    
    const friends = await friendModel.getFriendsForUser(user_id);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// remove friend relationship between two users
async function removeFriend(req, res) {
  try {
    const { user_id, friend_id } = req.body;
    
    // ensure users can only remove friends from their own account
    if (req.user.userId !== user_id) {
      return res.status(403).json({ error: 'You can only remove friends from your own account' });
    }
    
    const result = await friendModel.removeFriend(user_id, friend_id);
    if (!result) return res.status(404).json({ error: 'Friend relationship not found' });
    res.json({ message: 'Friend removed', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// remove friend and all associated data including messages and requests
async function deleteFriendCompletely(req, res) {
  try {
    const { user_id, friend_id } = req.params;
    
    // validate required parameters
    if (!user_id || !friend_id) {
      return res.status(400).json({ error: 'Missing user_id or friend_id' });
    }

    // validate uuid format for security
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id) || !uuidRegex.test(friend_id)) {
      return res.status(400).json({ error: 'Invalid user_id or friend_id format' });
    }
    
    // ensure users can only delete friendships from their own account
    if (req.user.userId !== user_id) {
      return res.status(403).json({ error: 'You can only delete friendships from your own account' });
    }

    const result = await friendModel.deleteFriendCompletely(user_id, friend_id);
    
    res.json({ 
      message: 'Friend and all associated data removed successfully', 
      deletedItems: result 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  addFriend,
  getFriendsForUser,
  removeFriend,
  deleteFriendCompletely,
}; 