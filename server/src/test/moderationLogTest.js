const moderationLogModel = require('../models/moderationLog');

const exampleMessageId = 1; // Replace with a real message ID if needed

async function testModerationLogs() {
  try {
    const allLogs = await moderationLogModel.getAllLogs();
    console.log('All moderation logs:', allLogs);
    const messageLogs = await moderationLogModel.getLogsForMessage(exampleMessageId);
    console.log('Moderation logs for message', exampleMessageId, ':', messageLogs);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testModerationLogs(); 