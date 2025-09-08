const friendModel = require('../models/friend');

const exampleUserId = '11111111-1111-1111-1111-111111111111'; // Replace with a real user ID if needed

async function testFriends() {
  try {
    const friends = await friendModel.getFriendsForUser(exampleUserId);
    console.log('Friends for user', exampleUserId, ':', friends);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testFriends(); 