const db = require('../utils/db');

// add interest to user profile
async function addUserInterest(user_id, interest_id) {
  const result = await db.query(
    'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) RETURNING *',
    [user_id, interest_id]
  );
  return result.rows[0];
}

// get all interests for specific user
async function getUserInterests(user_id) {
  const result = await db.query(
    `SELECT i.* FROM interests i
     JOIN user_interests ui ON i.id = ui.interest_id
     WHERE ui.user_id = $1`,
    [user_id]
  );
  return result.rows;
}

// get all users with specific interest
async function getUsersByInterest(interest_id) {
  const result = await db.query(
    `SELECT u.* FROM users u
     JOIN user_interests ui ON u.id = ui.user_id
     WHERE ui.interest_id = $1`,
    [interest_id]
  );
  return result.rows;
}

// remove interest from user profile
async function removeUserInterest(user_id, interest_id) {
  const result = await db.query(
    'DELETE FROM user_interests WHERE user_id = $1 AND interest_id = $2 RETURNING *',
    [user_id, interest_id]
  );
  return result.rows[0];
}

module.exports = {
  addUserInterest,
  getUserInterests,
  getUsersByInterest,
  removeUserInterest,
}; 