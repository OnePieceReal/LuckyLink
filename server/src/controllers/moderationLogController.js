const moderationLogModel = require('../models/moderationLog');

// add moderation log for chat history reporting
async function addModerationLog(req, res) {
  try {
    // extract user from jwt token
    const reportingUser = req.user?.username || req.body.reporting_user;
    
    // validate required fields
    if (!req.body.reported_user) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reported user is required' 
      });
    }
    
    if (!req.body.chat_history || !req.body.moderation_data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chat history and moderation data are required' 
      });
    }
    
    // generate unique session id if not provided
    const chatSessionId = req.body.chat_session_id || 
      `${req.body.chat_history.timestamp || Date.now()}`;
    
    // check for duplicate report to prevent spam
    const isDuplicate = await moderationLogModel.checkDuplicateReport(
      req.body.reported_user,
      reportingUser,
      chatSessionId
    );
    
    if (isDuplicate) {
      return res.status(409).json({ 
        success: false, 
        error: 'This chat session has already been reported' 
      });
    }
    
    // create log data with proper structure
    const logData = {
      reported_user: req.body.reported_user,
      reporting_user: reportingUser,
      chat_history: req.body.chat_history,
      moderation_data: req.body.moderation_data,
      chat_session_id: chatSessionId,
      reason: req.body.reason
    };
    
    const log = await moderationLogModel.addModerationLog(logData);
    res.status(201).json({ 
      success: true, 
      log,
      message: `Successfully reported ${req.body.reported_user}` 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create moderation report' 
    });
  }
}

// get moderation logs for specific reported user
async function getLogsForUser(req, res) {
  try {
    const { username } = req.params;
    const logs = await moderationLogModel.getLogsForUser(username);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// get all moderation logs
async function getAllLogs(req, res) {
  try {
    const logs = await moderationLogModel.getAllLogs();
    res.json({ success: true, logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// get logs by reporting user
async function getLogsByReporter(req, res) {
  try {
    const { username } = req.params;
    const logs = await moderationLogModel.getLogsByReporter(username);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// update moderation log status
async function updateLogStatus(req, res) {
  try {
    const { id, status, action_taken } = req.body;
    const reviewedBy = req.user?.username || 'system';
    
    if (!['pending', 'reviewed', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status' 
      });
    }
    
    const log = await moderationLogModel.updateLogStatus(
      id, 
      status, 
      reviewedBy, 
      action_taken
    );
    
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        error: 'Moderation log not found' 
      });
    }
    
    res.json({ success: true, log, message: 'Log status updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// delete moderation log
async function deleteModerationLog(req, res) {
  try {
    const { id } = req.body;
    const log = await moderationLogModel.deleteModerationLog(id);
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        error: 'Moderation log not found' 
      });
    }
    res.json({ success: true, message: 'Moderation log deleted', log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  addModerationLog,
  getLogsForUser,
  getAllLogs,
  getLogsByReporter,
  updateLogStatus,
  deleteModerationLog,
}; 