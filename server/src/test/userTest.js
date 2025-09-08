const userModel = require('../models/user');

async function testFetchAllUsers() {
  try {
    const users = await userModel.getAllUsers();
    console.log('All users:', users);
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    process.exit();
  }
}

testFetchAllUsers(); 