const db = require('../utils/db');

// create new user account
async function createUser({ username, email, password_hash, google_id, github_id, profile_picture_url, description, status }) {
  const result = await db.query(
    `INSERT INTO users (username, email, password_hash, google_id, github_id, profile_picture_url, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [username, email, password_hash, google_id, github_id, profile_picture_url, description, status]
  );
  return result.rows[0];
}

// get user by id
async function getUserById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// get user by username
async function getUserByUsername(username) {
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0];
}

// get user by email
async function getUserByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

// search users by username with partial match
async function searchUsersByUsername(username) {
  const result = await db.query(
    'SELECT * FROM users WHERE username ILIKE $1 ORDER BY username LIMIT 10',
    [`%${username}%`]
  );
  return result.rows;
}

// get all users
async function getAllUsers() {
  const result = await db.query('SELECT * FROM users');
  return result.rows;
}

// update user fields dynamically
async function updateUser(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  if (keys.length === 0) {
    return null;
  }
  const setString = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
  
  try {
    const result = await db.query(
      `UPDATE users SET ${setString} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

// delete user and all associated data
async function deleteUser(id) {
  const client = await db.getClient();
  
  try {
    // verify user exists before deletion
    const userCheck = await client.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const username = userCheck.rows[0].username;
    
    await client.query('BEGIN');
    
    const deletedItems = {
      messages: 0,
      friendRequests: 0,
      friendships: 0,
      userInterests: 0,
      userKeys: 0,
      user: 0
    };

    // delete all messages sent or received by user
    const messagesResult = await client.query(
      'DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1',
      [id]
    );
    deletedItems.messages = messagesResult.rowCount;

    // delete all friend requests sent or received by user
    const friendRequestsResult = await client.query(
      'DELETE FROM friend_requests WHERE sender_id = $1 OR receiver_id = $1',
      [id]
    );
    deletedItems.friendRequests = friendRequestsResult.rowCount;

    // delete all friendships involving user
    const friendshipsResult = await client.query(
      'DELETE FROM friends WHERE user_id = $1 OR friend_id = $1',
      [id]
    );
    deletedItems.friendships = friendshipsResult.rowCount;

    // delete all user interests
    const userInterestsResult = await client.query(
      'DELETE FROM user_interests WHERE user_id = $1',
      [id]
    );
    deletedItems.userInterests = userInterestsResult.rowCount;

    // delete user keys
    const userKeysResult = await client.query(
      'DELETE FROM user_keys WHERE user_id = $1',
      [id]
    );
    deletedItems.userKeys = userKeysResult.rowCount;

    // delete user record
    const userResult = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    deletedItems.user = userResult.rows.length;

    await client.query('COMMIT');
    
    return {
      deletedUser: userResult.rows[0],
      deletedItems
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createUser,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  searchUsersByUsername,
  getAllUsers,
  updateUser,
  deleteUser,
}; 