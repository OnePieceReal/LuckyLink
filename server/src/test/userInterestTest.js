const userInterestModel = require('../models/userInterest');

const exampleUserId = '11111111-1111-1111-1111-111111111111'; // Replace with a real user ID if needed
const exampleInterestId = 15; // Replace with a real interest ID if needed

async function testUserInterest() {
  try {
    const interests = await userInterestModel.getUserInterests(exampleUserId);
    console.log('Interests for user', exampleUserId, ':', interests);
    const users = await userInterestModel.getUsersByInterest(exampleInterestId);
    console.log('Users for interest', exampleInterestId, ':', users);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testUserInterest(); 