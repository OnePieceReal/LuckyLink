const db = require('../utils/db');

// add user encryption key pair
async function addUserKey({ user_id, public_key, private_key }) {
  const result = await db.query(
    `INSERT INTO user_keys (user_id, public_key, private_key)
     VALUES ($1, $2, $3) RETURNING *`,
    [user_id, public_key, private_key]
  );
  return result.rows[0];
}

// get user encryption key pair
async function getUserKey(user_id) {
  const result = await db.query(
    'SELECT * FROM user_keys WHERE user_id = $1',
    [user_id]
  );
  return result.rows[0];
}

// update user encryption key pair
async function updateUserKey(user_id, { public_key, private_key }) {
  const result = await db.query(
    `UPDATE user_keys SET public_key = $1, private_key = $2 WHERE user_id = $3 RETURNING *`,
    [public_key, private_key, user_id]
  );
  return result.rows[0];
}

// delete user encryption key pair
async function deleteUserKey(user_id) {
  const result = await db.query(
    'DELETE FROM user_keys WHERE user_id = $1 RETURNING *',
    [user_id]
  );
  return result.rows[0];
}

// get user by public key for verification
async function getUserByPublicKey(public_key) {
  const result = await db.query(
    'SELECT * FROM user_keys WHERE public_key = $1',
    [public_key]
  );
  return result.rows[0];
}

module.exports = {
  addUserKey,
  getUserKey,
  updateUserKey,
  deleteUserKey,
  getUserByPublicKey,
}; 