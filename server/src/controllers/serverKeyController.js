const serverKeyModel = require('../models/serverKey');

// get server public key for encryption
async function getServerPublicKey(req, res) {
  try {
    const key = await serverKeyModel.getServerKey();
    if (!key) return res.status(404).json({ error: 'Server key not found' });
    res.json({ public_key: key.public_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getServerPublicKey,
}; 