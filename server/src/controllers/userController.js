const userModel = require('../models/user');
const userKeyModel = require('../models/userKey');
const friendModel = require('../models/friend');
const crypto = require('crypto');
const { query } = require('../utils/db');
const { socketManager } = require('../utils/redis');
const { broadcastUserStatus } = require('../socket/socket');
const S3Service = require('../services/s3Service');
const { escapeHtml, cleanSearchQuery } = require('../utils/sanitizer');

const s3Service = new S3Service();

// validate uuid format for security
function isValidUUID(uuid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
}

// get profile picture url from s3 or oauth provider
async function getProfilePictureUrl(userId, existingUrl) {
  try {
    // check s3 for uploaded profile picture
    if (s3Service.isConfigured()) {
      const s3Key = `users/${userId}/profile/current.png`;
      try {
        await s3Service.getObjectMetadata(s3Key);
        // generate pre-signed url (expires in 1 hour)
        return await s3Service.getPresignedUrl(s3Key, 3600);
      } catch (error) {
        // s3 object doesn't exist, continue
      }
    }
    
    // check for oauth provider profile picture
    if (existingUrl) {
      if (existingUrl.includes('googleusercontent.com') || 
          existingUrl.includes('avatars.githubusercontent.com')) {
        return existingUrl;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// create a new user account
async function createUser(req, res) {
  const { username, email, password_hash, google_id, github_id, profile_picture_url, description, status } = req.body;
  if (!username || typeof username !== 'string' || username.length > 50) {
    return res.status(400).json({ error: 'Invalid or missing username' });
  }
  if (!email || typeof email !== 'string' || email.length > 100) {
    return res.status(400).json({ error: 'Invalid or missing email' });
  }
  if (!((google_id || github_id) || password_hash)) {
    return res.status(400).json({ error: 'Must provide password_hash or OAuth id' });
  }
  try {
    const user = await userModel.createUser(req.body);
    // generate rsa key pair for user encryption
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    // store keys in user_keys table
    await userKeyModel.addUserKey({
      user_id: user.id,
      public_key: publicKey,
      private_key: privateKey, // in production, encrypt this!
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// search users by username
async function searchUsers(req, res) {
  let { username } = req.query;
  
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username query parameter is required' });
  }

  // clean search query to prevent sql injection
  username = cleanSearchQuery(username.trim());

  try {
    const users = await userModel.searchUsersByUsername(username);
    
    // filter out current user and format response
    const filteredUsers = users
      .filter(user => user.id !== req.user.userId)
      .map(user => ({
        id: user.id,
        username: user.username,
        status: user.status,
        last_active_at: user.last_active_at
      }));
    
    res.json(filteredUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get current user from jwt token
async function getCurrentUser(req, res) {
  try {
    const user = await userModel.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // get profile picture url
    const profilePictureUrl = await getProfilePictureUrl(user.id, user.profile_picture_url);
    
    // return user data without sensitive information
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      description: user.description,
      profile_picture_url: profilePictureUrl,
      last_active_at: user.last_active_at,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get user by id
async function getUserById(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // ensure users can only get full details of their own profile
  try {
    const user = await userModel.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // if requesting own profile, return full details
    if (req.user.userId === req.params.id) {
      res.json(user);
    } else {
      // for other users, return only public information
      res.json({
        id: user.id,
        username: user.username,
        status: user.status,
        description: user.description,
        last_active_at: user.last_active_at
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get user profile by username for matched users
async function getUserProfileByUsername(req, res) {
  const { username } = req.params;
  
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }

  try {
    const user = await userModel.getUserByUsername(username.trim());
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // get profile picture url
    const profilePictureUrl = await getProfilePictureUrl(user.id, user.profile_picture_url);
    
    // return only public profile information
    res.json({
      id: user.id,
      username: user.username,
      description: user.description,
      profile_picture_url: profilePictureUrl,
      status: user.status,
      last_active_at: user.last_active_at,
      created_at: user.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get all users - restricted for security
async function getAllUsers(req, res) {
  // endpoint blocked for security reasons
  return res.status(403).json({ 
    error: 'Access denied. This endpoint is not available for security reasons.' 
  });
}

// update user profile
async function updateUser(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // ensure users can only update their own profile
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }
  
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  try {
    const user = await userModel.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found or no fields to update' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Delete user - removed duplicate function, using the one below

// update user status
async function updateUserStatus(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // ensure users can only update their own status
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ error: 'You can only update your own status' });
  }
  
  const { status } = req.body;
  if (!status || typeof status !== 'string' || status.length > 20) {
    return res.status(400).json({ error: 'Invalid or missing status' });
  }
  try {
    const user = await userModel.updateUser(req.params.id, { status });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// update user description
async function updateUserDescription(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // ensure users can only update their own description
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ error: 'You can only update your own description' });
  }
  
  let { description } = req.body;
  if (!description || typeof description !== 'string' || description.length > 255) {
    return res.status(400).json({ error: 'Invalid or missing description' });
  }
  
  // sanitize description to prevent xss
  description = escapeHtml(description);
  
  try {
    const user = await userModel.updateUser(req.params.id, { description });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get public key of user by id for e2e encryption
async function getUserPublicKey(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // public keys needed for e2e encryption between users
  try {
    // allow users to get their own public key
    if (req.user.userId === req.params.id) {
      const key = await userKeyModel.getUserKey(req.params.id);
      if (!key) return res.status(404).json({ error: 'User key not found' });
      return res.json({ public_key: key.public_key });
    }
    
    // for other users, check if they're friends
    const friends = await friendModel.getFriendsForUser(req.user.userId);
    const isFriend = friends.some(f => f.id === req.params.id);
    
    if (!isFriend) {
      return res.status(403).json({ 
        error: 'You can only access public keys of your friends for secure messaging' 
      });
    }
    
    const key = await userKeyModel.getUserKey(req.params.id);
    if (!key) return res.status(404).json({ error: 'User key not found' });
    res.json({ public_key: key.public_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get user status from redis
async function getUserStatus(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  try {
    const effectiveStatus = await socketManager.getEffectiveUserStatus(req.params.id);
    res.json({ status: effectiveStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// update user last active timestamp
async function updateUserLastActive(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  // ensure users can only update their own activity
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ error: 'You can only update your own activity status' });
  }
  
  try {
    const user = await userModel.updateUser(req.params.id, { last_active_at: new Date() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// heartbeat endpoint to keep user active
async function heartbeat(req, res) {
  try {
    // update current user's last active timestamp
    const user = await userModel.updateUser(req.user.userId, { last_active_at: new Date() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// mark user as offline for page unload
async function markOffline(req, res) {
  try {
    // update database
    await userModel.updateUser(req.user.userId, { 
      status: 'offline', 
      is_online: false, 
      last_active_at: new Date() 
    });
    
    // update redis
    const normalizedUserId = req.user.userId.replace(/-/g, '');
    await socketManager.setUserStatus(normalizedUserId, 'offline');
    
    // broadcast offline status to friends
    await broadcastUserStatus(req.user.userId, 'offline');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// mark user as online for page visibility change
async function markOnline(req, res) {
  try {
    // update database
    await userModel.updateUser(req.user.userId, { 
      status: 'online', 
      is_online: true, 
      last_active_at: new Date() 
    });
    
    // update redis
    const normalizedUserId = req.user.userId.replace(/-/g, '');
    await socketManager.setUserStatus(normalizedUserId, 'online');
    
    // broadcast online status to friends
    await broadcastUserStatus(req.user.userId, 'online');
    
    res.json({ success: true, message: 'User marked as online' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// delete user account and all associated data
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    
    // validate user id
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // ensure user can only delete their own account
    if (req.user.userId !== id) {
      return res.status(403).json({ error: 'You can only delete your own account' });
    }

    // delete s3 assets for the user
    if (s3Service.isConfigured()) {
      try {
        // delete all objects under the user's folder
        const userPrefix = `users/${id}/`;
        await s3Service.deleteFolder(userPrefix);
      } catch (s3Error) {
        // continue with user deletion even if s3 deletion fails
      }
    }
    
    // delete user and all associated data from database
    const result = await userModel.deleteUser(id);
    
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Account deleted successfully',
      deletedData: result 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createUser,
  getUserById,
  getUserProfileByUsername,
  getAllUsers,
  updateUser,
  deleteUser,
  updateUserStatus,
  updateUserDescription,
  getUserPublicKey,
  updateUserLastActive,
  getCurrentUser,
  searchUsers,
  getUserStatus,
  heartbeat,
  markOffline,
  markOnline,
}; 