const serverKeyModel = require('../models/serverKey');

async function testServerKey() {
  try {
    const serverKey = await serverKeyModel.getServerKey();
    console.log('Server key:', serverKey);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testServerKey(); 