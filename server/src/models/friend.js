const db = require('../utils/db');

// add friend relationship between two users
async function addFriend(user_id, friend_id) {
  // check if friendship already exists in either direction
  const existingResult = await db.query(
    'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
    [user_id, friend_id]
  );
  
  if (existingResult.rows.length > 0) {
    throw new Error('Friendship already exists');
  }
  
  const result = await db.query(
    'INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) RETURNING *',
    [user_id, friend_id]
  );
  return result.rows[0];
}

// get all friends for a specific user
async function getFriendsForUser(user_id) {
  const result = await db.query(
    `SELECT u.* FROM users u
     JOIN friends f ON (u.id = f.friend_id AND f.user_id = $1) OR (u.id = f.user_id AND f.friend_id = $1)`,
    [user_id]
  );
  return result.rows;
}

// remove friend relationship between two users
async function removeFriend(user_id, friend_id) {
  const result = await db.query(
    'DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1) RETURNING *',
    [user_id, friend_id]
  );
  return result.rows[0];
}

// remove friend and all associated data including messages and requests
async function deleteFriendCompletely(user_id, friend_id) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const deletedItems = {
      messages: 0,
      friendRequests: 0,
      friendships: 0
    };

    // delete all messages between the two users in both directions
    const messagesResult = await client.query(
      `DELETE FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)`,
      [user_id, friend_id]
    );
    deletedItems.messages = messagesResult.rowCount;

    // delete all friend requests between the two users in both directions
    const friendRequestsResult = await client.query(
      `DELETE FROM friend_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)`,
      [user_id, friend_id]
    );
    deletedItems.friendRequests = friendRequestsResult.rowCount;

    // delete the friendship in both directions
    const friendshipResult = await client.query(
      `DELETE FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) 
          OR (user_id = $2 AND friend_id = $1)`,
      [user_id, friend_id]
    );
    deletedItems.friendships = friendshipResult.rowCount;

    await client.query('COMMIT');
    
    return deletedItems;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  addFriend,
  getFriendsForUser,
  removeFriend,
  deleteFriendCompletely,
}; 