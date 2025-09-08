const db = require('../utils/db');

// create new interest category
async function createInterest(name) {
  const result = await db.query(
    'INSERT INTO interests (name) VALUES ($1) RETURNING *',
    [name]
  );
  return result.rows[0];
}

// get interest by id
async function getInterestById(id) {
  const result = await db.query('SELECT * FROM interests WHERE id = $1', [id]);
  return result.rows[0];
}

// get all interests
async function getAllInterests() {
  const result = await db.query('SELECT * FROM interests');
  return result.rows;
}

// update interest name
async function updateInterest(id, name) {
  const result = await db.query(
    'UPDATE interests SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  return result.rows[0];
}

// delete interest by id
async function deleteInterest(id) {
  const result = await db.query('DELETE FROM interests WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = {
  createInterest,
  getInterestById,
  getAllInterests,
  updateInterest,
  deleteInterest,
}; 