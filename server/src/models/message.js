const db = require('../utils/db');
const messageEncryption = require('../utils/encryption');

// send encrypted message between users
async function sendMessage({ sender_id, receiver_id, content }) {
  // encrypt message content before storing
  const encryptedData = await messageEncryption.encrypt(content);
  
  const result = await db.query(
    `INSERT INTO messages (sender_id, receiver_id, encrypted_message, iv, signature, sent_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
    [sender_id, receiver_id, encryptedData.encrypted_message, encryptedData.iv, encryptedData.signature]
  );
  return result.rows[0];
}

// get all messages between two users with decryption
async function getMessagesBetweenUsers(user1_id, user2_id) {
  const result = await db.query(
    `SELECT m.*, u.username as sender_username
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE (m.sender_id = $1 AND m.receiver_id = $2)
        OR (m.sender_id = $2 AND m.receiver_id = $1)
     ORDER BY m.sent_at ASC`,
    [user1_id, user2_id]
  );
  
  // decrypt messages before returning
  const decryptedMessages = await Promise.all(
    result.rows.map(async (message) => {
      try {
        // check if message is encrypted
        if (messageEncryption.isEncrypted(message.encrypted_message, message.iv)) {
          const decryptedContent = await messageEncryption.decrypt(
            message.encrypted_message,
            message.iv,
            message.signature
          );
          return { ...message, encrypted_message: decryptedContent };
        } else {
          // legacy plaintext message for backwards compatibility
          return message;
        }
      } catch (error) {
        // return message with error indicator instead of failing
        return { ...message, encrypted_message: '[Message could not be decrypted]' };
      }
    })
  );
  
  return decryptedMessages;
}

// mark single message as read
async function markMessageAsRead(message_id) {
  const result = await db.query(
    `UPDATE messages SET is_read = TRUE WHERE id = $1 RETURNING *`,
    [message_id]
  );
  return result.rows[0];
}

// mark all messages as read between two users
async function markMessagesAsRead(receiver_id, sender_id) {
  const result = await db.query(
    `UPDATE messages 
     SET is_read = TRUE 
     WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE 
     RETURNING id`,
    [receiver_id, sender_id]
  );
  return result.rows;
}

// get unread message count for user
async function getUnreadMessageCount(user_id) {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = FALSE`,
    [user_id]
  );
  return parseInt(result.rows[0].count);
}

// delete message by id
async function deleteMessage(message_id) {
  const result = await db.query(
    `DELETE FROM messages WHERE id = $1 RETURNING *`,
    [message_id]
  );
  return result.rows[0];
}

// update message with encryption
async function updateMessageById(sender_id, receiver_id, message_id, updated_content) {
  // encrypt updated content before storing
  const encryptedData = await messageEncryption.encrypt(updated_content);
  
  const result = await db.query(
    `UPDATE messages SET encrypted_message = $1, iv = $2, signature = $3 
     WHERE id = $4 AND sender_id = $5 AND receiver_id = $6 RETURNING *`,
    [encryptedData.encrypted_message, encryptedData.iv, encryptedData.signature, message_id, sender_id, receiver_id]
  );
  return result.rows[0];
}

module.exports = {
  sendMessage,
  getMessagesBetweenUsers,
  markMessageAsRead,
  markMessagesAsRead,
  getUnreadMessageCount,
  deleteMessage,
  updateMessageById,
}; 