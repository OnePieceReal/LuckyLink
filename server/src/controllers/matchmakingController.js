const matchmaking = require('../services/matchmaking');
const { getSocketIO } = require('../socket/socket');

// request random match based on interests
async function requestMatch(req, res) {
  const { interests } = req.body;
  const userId = req.user.userId; // from jwt token
  const username = req.user.username; // from jwt token
  
  if (!Array.isArray(interests)) {
    return res.status(400).json({ error: 'interests[] required' });
  }
  
  try {
    // use username as identifier for matchmaking
    const result = await matchmaking.matchUser(username, interests);
    
    // if match found, emit socket events to both users
    if (result.matched && result.with) {
      const io = getSocketIO();
      const sessionId = `random_${Date.now()}`;
      
      // get matched user's id from database
      const { query } = require('../utils/db');
      const matchedUserResult = await query('SELECT id FROM users WHERE username = $1', [result.with]);
      const matchedUserId = matchedUserResult.rows[0]?.id;
      
      if (matchedUserId) {
        // notify requesting user of match
        io.to(`user:${userId}`).emit('randomMatchFound', {
          matchedUser: result.with,
          sessionId: sessionId
        });
        
        // notify matched user of match
        io.to(`user:${matchedUserId}`).emit('randomMatchFound', {
          matchedUser: username,
          sessionId: sessionId
        });
      }
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// cancel matchmaking request
async function cancelMatch(req, res) {
  const { interests } = req.body;
  const username = req.user.username; // from jwt token
  
  if (!Array.isArray(interests)) {
    return res.status(400).json({ error: 'interests[] required' });
  }
  
  try {
    await matchmaking.removeUserFromQueues(username, interests);
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// skip current match and find new one
async function skipMatch(req, res) {
  const { interests, skippedUser } = req.body;
  const userId = req.user.userId; // from jwt token
  const username = req.user.username; // from jwt token
  
  if (!Array.isArray(interests)) {
    return res.status(400).json({ error: 'interests[] required' });
  }
  
  try {
    // remove skipping user from current queues and mark as skipped
    await matchmaking.removeUserFromQueues(username, interests, 'skipped');
    
    // re-queue the other user who was skipped
    if (skippedUser) {
      await matchmaking.matchUser(skippedUser, interests);
    }
    
    // try to find new match for skipping user
    const result = await matchmaking.matchUser(username, interests);
    
    // if match found, emit socket events to both users
    if (result.matched && result.with) {
      const io = getSocketIO();
      const sessionId = `random_${Date.now()}`;
      
      // get matched user's id from database
      const { query } = require('../utils/db');
      const matchedUserResult = await query('SELECT id FROM users WHERE username = $1', [result.with]);
      const matchedUserId = matchedUserResult.rows[0]?.id;
      
      if (matchedUserId) {
        // notify requesting user of new match
        io.to(`user:${userId}`).emit('randomMatchFound', {
          matchedUser: result.with,
          sessionId: sessionId
        });
        
        // notify matched user of new match
        io.to(`user:${matchedUserId}`).emit('randomMatchFound', {
          matchedUser: username,
          sessionId: sessionId
        });
      }
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// end current match and handle re-queuing
async function endMatch(req, res) {
  const { interests, otherUser } = req.body;
  const userId = req.user.userId; // from jwt token
  const username = req.user.username; // from jwt token
  
  if (!Array.isArray(interests)) {
    return res.status(400).json({ error: 'interests[] required' });
  }
  
  try {
    // remove ending user from queues without re-queuing
    await matchmaking.removeUserFromQueues(username, interests, 'ended');
    
    // re-queue the other user for new match
    if (otherUser) {
      const result = await matchmaking.matchUser(otherUser, interests);
      
      // if other user gets new match, emit socket event
      if (result.matched && result.with) {
        const io = getSocketIO();
        const sessionId = `random_${Date.now()}`;
        
        // get matched user's id from database
        const { query } = require('../utils/db');
        const matchedUserResult = await query('SELECT id FROM users WHERE username = $1', [result.with]);
        const matchedUserId = matchedUserResult.rows[0]?.id;
        
        if (matchedUserId) {
          // get other user's id from database
          const otherUserResult = await query('SELECT id FROM users WHERE username = $1', [otherUser]);
          const otherUserId = otherUserResult.rows[0]?.id;
          
          if (otherUserId) {
            // notify other user of new match
            io.to(`user:${otherUserId}`).emit('randomMatchFound', {
              matchedUser: result.with,
              sessionId: sessionId
            });
            
            // notify new matched user
            io.to(`user:${matchedUserId}`).emit('randomMatchFound', {
              matchedUser: otherUser,
              sessionId: sessionId
            });
          }
        }
      }
    }
    
    res.json({ ended: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  requestMatch,
  cancelMatch,
  skipMatch,
  endMatch,
}; 