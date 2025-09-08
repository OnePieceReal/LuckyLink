const interestQueueModel = require('../models/interestQueue');

// add user to interest queue (admin only)
async function addToQueue(req, res) {
  try {
    const { user_id, interest_id } = req.body;
    
    // admin-only endpoint for queue management
    const queueEntry = await interestQueueModel.addToQueue(user_id, interest_id);
    res.status(201).json(queueEntry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all users in queue for specific interest (admin only)
async function getQueueForInterest(req, res) {
  try {
    const { interest_id } = req.params;
    
    // admin-only endpoint for viewing queue status
    const queue = await interestQueueModel.getQueueForInterest(interest_id);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// remove user from interest queue (admin only)
async function removeFromQueue(req, res) {
  try {
    const { user_id, interest_id } = req.body;
    
    // admin-only endpoint for queue management
    const result = await interestQueueModel.removeFromQueue(user_id, interest_id);
    if (!result) return res.status(404).json({ error: 'Queue entry not found' });
    res.json({ message: 'Removed from queue', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// get all queues user is in (admin only)
async function getUserQueues(req, res) {
  try {
    const { user_id } = req.params;
    
    // admin-only endpoint for viewing user queue status
    const queues = await interestQueueModel.getUserQueues(user_id);
    res.json(queues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  addToQueue,
  getQueueForInterest,
  removeFromQueue,
  getUserQueues,
}; 