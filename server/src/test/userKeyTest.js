const userKeyModel = require('../models/userKey');

const exampleUserId = '11111111-1111-1111-1111-111111111111'; // Replace with a real user ID if needed

async function testUserKey() {
  try {
    const userKey = await userKeyModel.getUserKey(exampleUserId);
    console.log('User key for user', exampleUserId, ':', userKey);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testUserKey(); 