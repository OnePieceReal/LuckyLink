const interestModel = require('../models/interest');

async function testFetchAllInterests() {
  try {
    const interests = await interestModel.getAllInterests();
    console.log('All interests:', interests);
  } catch (err) {
    console.error('Error fetching interests:', err);
  } finally {
    process.exit();
  }
}

testFetchAllInterests(); 