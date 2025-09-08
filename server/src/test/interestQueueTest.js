const interestQueueModel = require('../models/interestQueue');

const exampleUserId = '11111111-1111-1111-1111-111111111111'; // Replace with a real user ID if needed
const exampleInterestId = 15; // Replace with a real interest ID if needed

async function testInterestQueues() {
  try {
    const queue = await interestQueueModel.getQueueForInterest(exampleInterestId);
    console.log('Queue for interest', exampleInterestId, ':', queue);
    const userQueues = await interestQueueModel.getUserQueues(exampleUserId);
    console.log('Queues for user', exampleUserId, ':', userQueues);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testInterestQueues(); 