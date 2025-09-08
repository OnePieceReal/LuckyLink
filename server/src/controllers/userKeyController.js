const userKeyModel = require('../models/userKey');
const serverKeyModel = require('../models/serverKey');
const crypto = require('crypto');

// validate uuid format for security
function isValidUUID(uuid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
}

// validate another user's public key for anti-mitm protection
async function validateUserPublicKey(req, res) {
  const { encrypted_message } = req.body;
  if (!encrypted_message || typeof encrypted_message !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid encrypted_message' });
  }
  try {
    // get server private key
    const serverKey = await serverKeyModel.getServerKey();
    if (!serverKey) return res.status(500).json({ error: 'Server key not found' });
    // decrypt message using rsa
    let decrypted;
    try {
      decrypted = crypto.privateDecrypt(
        {
          key: serverKey.private_key,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encrypted_message, 'base64')
      ).toString('utf8');
    } catch (e) {
      return res.status(400).json({ error: 'Failed to decrypt message' });
    }
    // decrypted message should contain the public key to validate
    const { public_key } = JSON.parse(decrypted);
    if (!public_key) return res.status(400).json({ error: 'No public_key in decrypted message' });
    // check if public key exists
    const userKey = await userKeyModel.getUserByPublicKey(public_key);
    if (!userKey) return res.status(404).json({ valid: false, error: 'Public key not found' });
    res.json({ valid: true, user_id: userKey.user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// get public key of user by id
async function getUserPublicKey(req, res) {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  try {
    const key = await userKeyModel.getUserKey(req.params.id);
    if (!key) return res.status(404).json({ error: 'User key not found' });
    res.json({ public_key: key.public_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  validateUserPublicKey,
  getUserPublicKey,
}; 