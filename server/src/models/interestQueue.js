const db = require('../utils/db');

// add user to interest queue
async function addToQueue(user_id, interest_id) {
  const result = await db.query(
    'INSERT INTO interest_queues (user_id, interest_id) VALUES ($1, $2) RETURNING *',
    [user_id, interest_id]
  );
  return result.rows[0];
}

// get all users in queue for specific interest
async function getQueueForInterest(interest_id) {
  const result = await db.query(
    `SELECT * FROM interest_queues WHERE interest_id = $1 ORDER BY joined_at ASC`,
    [interest_id]
  );
  return result.rows;
}

// remove user from interest queue
async function removeFromQueue(user_id, interest_id) {
  const result = await db.query(
    'DELETE FROM interest_queues WHERE user_id = $1 AND interest_id = $2 RETURNING *',
    [user_id, interest_id]
  );
  return result.rows[0];
}

// get all queues user is in
async function getUserQueues(user_id) {
  const result = await db.query(
    'SELECT * FROM interest_queues WHERE user_id = $1',
    [user_id]
  );
  return result.rows;
}

module.exports = {
  addToQueue,
  getQueueForInterest,
  removeFromQueue,
  getUserQueues,
}; 