const userInterestModel = require('../models/userInterest');

// validate uuid format for security
function isValidUUID(uuid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
}

const ALLOWED_INTERESTS = (process.env.ALLOWED_INTERESTS || '').split('|').map(s => s.trim());
const FALLBACK_INTEREST = 'fallback';

// validate and filter user interests
function validateInterests(interests) {
  if (!Array.isArray(interests) || interests.length === 0) return [FALLBACK_INTEREST];
  const filtered = interests.filter(i => ALLOWED_INTERESTS.includes(i));
  if (filtered.length === 0) return [FALLBACK_INTEREST];
  return filtered.slice(0, 3);
}

// add interest to user profile
async function addUserInterest(req, res) {
  let { user_id, interest_id, interests } = req.body;
  if (interests) {
    interests = validateInterests(interests);
    if (interests.includes(FALLBACK_INTEREST)) {
      return res.status(400).json({ error: 'No valid interests selected. User placed in fallback queue.' });
    }
    if (interests.length > 3) {
      return res.status(400).json({ error: 'You can select up to 3 interests.' });
    }
  }
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // ensure users can only add interests to their own profile
  if (req.user.userId !== user_id) {
    return res.status(403).json({ error: 'You can only add interests to your own profile' });
  }
  
  if (typeof interest_id !== 'number' || isNaN(interest_id)) {
    return res.status(400).json({ error: 'Invalid interest_id' });
  }
  try {
    const userInterest = await userInterestModel.addUserInterest(user_id, interest_id);
    res.status(201).json(userInterest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all interests for a user
async function getUserInterests(req, res) {
  const { user_id } = req.params;
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // allow viewing any user's interests for profiles and matching
  try {
    const interests = await userInterestModel.getUserInterests(user_id);
    res.json(interests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get all users for an interest - blocked for privacy
async function getUsersByInterest(req, res) {
  const { interest_id } = req.params;
  const id = parseInt(interest_id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest_id' });
  }
  
  // endpoint blocked for privacy reasons
  return res.status(403).json({ 
    error: 'Access denied. User interest information is private.' 
  });
}

// remove interest from user profile
async function removeUserInterest(req, res) {
  const { user_id, interest_id } = req.body;
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // ensure users can only remove interests from their own profile
  if (req.user.userId !== user_id) {
    return res.status(403).json({ error: 'You can only remove interests from your own profile' });
  }
  
  if (typeof interest_id !== 'number' || isNaN(interest_id)) {
    return res.status(400).json({ error: 'Invalid interest_id' });
  }
  try {
    const result = await userInterestModel.removeUserInterest(user_id, interest_id);
    if (!result) return res.status(404).json({ error: 'User interest not found' });
    res.json({ message: 'User interest removed', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// add interest to user by user_id and interest_id in params
async function addUserInterestById(req, res) {
  const { user_id, interest_id } = req.params;
  
  // validate user_id format
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // ensure users can only add interests to their own profile
  if (req.user.userId !== user_id) {
    return res.status(403).json({ error: 'You can only add interests to your own profile' });
  }
  
  // validate interest_id format
  const id = parseInt(interest_id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest_id' });
  }
  
  // check if user already has 3 interests
  try {
    const existingInterests = await userInterestModel.getUserInterests(user_id);
    if (existingInterests.length >= 3) {
      return res.status(400).json({ error: 'You can select up to 3 interests.' });
    }
    
    // add the interest
    const userInterest = await userInterestModel.addUserInterest(user_id, id);
    res.status(201).json(userInterest);
  } catch (err) {
    // handle duplicate key error
    if (err.code === '23505') { // postgresql unique violation
      return res.status(400).json({ error: 'Interest already added to user' });
    }
    res.status(400).json({ error: err.message });
  }
}

// remove interest from user by user_id and interest_id in params
async function removeUserInterestById(req, res) {
  const { user_id, interest_id } = req.params;
  
  // validate user_id format
  if (!isValidUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format' });
  }
  
  // ensure users can only remove interests from their own profile
  if (req.user.userId !== user_id) {
    return res.status(403).json({ error: 'You can only remove interests from your own profile' });
  }
  
  // validate interest_id format
  const id = parseInt(interest_id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interest_id' });
  }
  
  try {
    const result = await userInterestModel.removeUserInterest(user_id, id);
    if (!result) return res.status(404).json({ error: 'User interest not found' });
    res.json({ message: 'User interest removed', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  addUserInterest,
  getUserInterests,
  getUsersByInterest,
  removeUserInterest,
  addUserInterestById,
  removeUserInterestById,
}; 