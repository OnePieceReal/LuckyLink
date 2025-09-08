const messageModel = require('../models/message');

const exampleUser1Id = '11111111-1111-1111-1111-111111111111'; // Replace with a real user ID if needed
const exampleUser2Id = '22222222-2222-2222-2222-222222222222'; // Replace with a real user ID if needed

async function testMessages() {
  try {
    const messages = await messageModel.getMessagesBetweenUsers(exampleUser1Id, exampleUser2Id);
    console.log(`Messages between ${exampleUser1Id} and ${exampleUser2Id}:`, messages);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testMessages(); 