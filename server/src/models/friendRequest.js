const db = require('../utils/db');

// send friend request between two users
async function sendFriendRequest(sender_id, receiver_id) {
  const result = await db.query(
    `INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2) RETURNING *`,
    [sender_id, receiver_id]
  );
  return result.rows[0];
}

// get all friend requests for a user (received and sent)
async function getFriendRequestsForUser(user_id) {
  const result = await db.query(
    `SELECT * FROM friend_requests WHERE sender_id = $1 OR receiver_id = $1`,
    [user_id]
  );
  return result.rows;
}

// respond to friend request (accept or reject)
async function respondToFriendRequest(request_id, status, receiver_id) {
  // start transaction for atomic operations
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // get the friend request with lock
    const frRes = await client.query('SELECT * FROM friend_requests WHERE id = $1 FOR UPDATE', [request_id]);
    const request = frRes.rows[0];
    if (!request) throw new Error('Friend request not found');
    if (request.receiver_id !== receiver_id) throw new Error('Only the receiver can respond');
    if (request.status !== 'pending') throw new Error('Request already responded to');
    // update request status
    const updateRes = await client.query(
      `UPDATE friend_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, request_id]
    );
    // if accepted, create mutual friendship
    if (status === 'accepted') {
      // check if already friends in both directions
      const checkRes = await client.query(
        `SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
        [request.sender_id, request.receiver_id]
      );
      if (checkRes.rows.length === 0) {
        // create friendship record
        await client.query(
          `INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)`,
          [request.sender_id, request.receiver_id]
        );
      }
    }
    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// delete friend request by id
async function deleteFriendRequest(request_id) {
  const result = await db.query(
    `DELETE FROM friend_requests WHERE id = $1 RETURNING *`,
    [request_id]
  );
  return result.rows[0];
}

module.exports = {
  sendFriendRequest,
  getFriendRequestsForUser,
  respondToFriendRequest,
  deleteFriendRequest,
}; 