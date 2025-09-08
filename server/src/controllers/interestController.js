const interestModel = require('../models/interest');

// create a new interest category
async function createInterest(req, res) {
  if (!req.body.name || typeof req.body.name !== 'string' || req.body.name.length > 50) {
    return res.status(400).json({ error: 'Invalid or missing interest name' });
  }
  try {
    const interest = await interestModel.createInterest(req.body.name);
    res.status(201).json(interest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get interest by id
async function getInterestById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest ID' });
  }
  try {
    const interest = await interestModel.getInterestById(id);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    res.json(interest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get all available interests
async function getAllInterests(req, res) {
  try {
    const interests = await interestModel.getAllInterests();
    // filter out internal fallback interest
    const publicInterests = interests.filter(interest => 
      interest.name.toLowerCase() !== 'fallback'
    );
    res.json(publicInterests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// update existing interest
async function updateInterest(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest ID' });
  }
  if (!req.body.name || typeof req.body.name !== 'string' || req.body.name.length > 50) {
    return res.status(400).json({ error: 'Invalid or missing interest name' });
  }
  try {
    const interest = await interestModel.updateInterest(id, req.body.name);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    res.json(interest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// delete interest category
async function deleteInterest(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest ID' });
  }
  try {
    const interest = await interestModel.deleteInterest(id);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    res.json({ message: 'Interest deleted', interest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createInterest,
  getInterestById,
  getAllInterests,
  updateInterest,
  deleteInterest,
}; 