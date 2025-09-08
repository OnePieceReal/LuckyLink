const db = require('../utils/db');

// set server key (insert if not exists)
async function setServerKey({ public_key, private_key }) {
  const result = await db.query(
    `INSERT INTO server_keys (id, public_key, private_key)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key
     RETURNING *`,
    [public_key, private_key]
  );
  return result.rows[0];
}

// get server key
async function getServerKey() {
  const result = await db.query('SELECT * FROM server_keys WHERE id = 1');
  return result.rows[0];
}

// update server key
async function updateServerKey({ public_key, private_key }) {
  const result = await db.query(
    `UPDATE server_keys SET public_key = $1, private_key = $2 WHERE id = 1 RETURNING *`,
    [public_key, private_key]
  );
  return result.rows[0];
}

module.exports = {
  setServerKey,
  getServerKey,
  updateServerKey,
}; 