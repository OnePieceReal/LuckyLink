const db = require('../utils/db');

// add moderation log for chat history report
async function addModerationLog(logData) {
  // extract data from moderation analysis
  const severity_score = logData.moderation_data?.otherUserAnalysis?.severity || 0;
  const totalMessages = logData.moderation_data?.otherUserAnalysis?.totalMessages || 0;
  const flaggedMessages = logData.moderation_data?.otherUserAnalysis?.flaggedCount || 0;
  
  // generate session id from timestamp and users
  const chatSessionId = logData.chat_session_id || 
    `${logData.reported_user}_${logData.reporting_user}_${Date.now()}`;
  
  // create reason based on analysis
  const reason = logData.reason || 
    `Chat history report: ${flaggedMessages} of ${totalMessages} messages flagged. Severity: ${(severity_score * 100).toFixed(1)}%`;
  
  try {
    const result = await db.query(
      `INSERT INTO moderation_logs (
        reported_user,
        reporting_user,
        reason,
        severity_score,
        chat_session_id,
        total_messages,
        flagged_messages,
        chat_history,
        moderation_data,
        status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        logData.reported_user,
        logData.reporting_user,
        reason,
        severity_score,
        chatSessionId,
        totalMessages,
        flaggedMessages,
        JSON.stringify(logData.chat_history),
        JSON.stringify(logData.moderation_data),
        'pending'
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

// get logs for specific user (reported)
async function getLogsForUser(username) {
  const result = await db.query(
    `SELECT * FROM moderation_logs 
     WHERE reported_user = $1 
     ORDER BY flagged_at DESC`,
    [username]
  );
  return result.rows;
}

// get all moderation logs
async function getAllLogs() {
  const result = await db.query(
    `SELECT * FROM moderation_logs 
     ORDER BY flagged_at DESC`
  );
  return result.rows;
}

// get logs by reporting user
async function getLogsByReporter(username) {
  const result = await db.query(
    `SELECT * FROM moderation_logs 
     WHERE reporting_user = $1 
     ORDER BY flagged_at DESC`,
    [username]
  );
  return result.rows;
}

// update log status for moderation review
async function updateLogStatus(id, status, reviewedBy, actionTaken) {
  const result = await db.query(
    `UPDATE moderation_logs 
     SET status = $2, 
         reviewed_at = CURRENT_TIMESTAMP,
         reviewed_by = $3,
         action_taken = $4
     WHERE id = $1 
     RETURNING *`,
    [id, status, reviewedBy, actionTaken]
  );
  return result.rows[0];
}

// delete moderation log by id
async function deleteModerationLog(id) {
  const result = await db.query(
    'DELETE FROM moderation_logs WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

// check if user already reported this chat session
async function checkDuplicateReport(reportedUser, reportingUser, chatSessionId) {
  const result = await db.query(
    `SELECT id FROM moderation_logs 
     WHERE reported_user = $1 
     AND reporting_user = $2 
     AND chat_session_id = $3
     LIMIT 1`,
    [reportedUser, reportingUser, chatSessionId]
  );
  return result.rows.length > 0;
}

module.exports = {
  addModerationLog,
  getLogsForUser,
  getAllLogs,
  getLogsByReporter,
  updateLogStatus,
  deleteModerationLog,
  checkDuplicateReport,
}; 