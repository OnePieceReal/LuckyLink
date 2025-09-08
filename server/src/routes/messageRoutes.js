const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authenticateJWT = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Messaging between users
 */

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sender_id
 *               - receiver_id
 *               - content
 *             properties:
 *               sender_id:
 *                 type: string
 *               receiver_id:
 *                 type: string
 *               content:
 *                 type: string
 *                 description: Message content (will be encrypted server-side)
 *     responses:
 *       201:
 *         description: Message sent
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateJWT, messageController.sendMessage);

/**
 * @swagger
 * /api/messages/{user1_id}/{user2_id}:
 *   get:
 *     summary: Get all messages between two users
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user1_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User 1 ID
 *       - in: path
 *         name: user2_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User 2 ID
 *     responses:
 *       200:
 *         description: List of messages
 *       400:
 *         description: Invalid input
 */
router.get('/:user1_id/:user2_id', authenticateJWT, messageController.getMessagesBetweenUsers);

/**
 * @swagger
 * /api/messages/between/{user1_id}/{user2_id}:
 *   get:
 *     summary: Get all messages between two friended users
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user1_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User 1 ID
 *       - in: path
 *         name: user2_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User 2 ID
 *     responses:
 *       200:
 *         description: List of messages
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Users are not friends
 */
router.get('/between/:user1_id/:user2_id', authenticateJWT, messageController.getMessagesBetweenFriendedUsers);

/**
 * @swagger
 * /api/messages/read:
 *   put:
 *     summary: Mark a message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message_id
 *             properties:
 *               message_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Message marked as read
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Message not found
 */
router.put('/read', authenticateJWT, messageController.markMessageAsRead);

/**
 * @swagger
 * /api/messages/read-all:
 *   put:
 *     summary: Mark all messages as read between two users
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiver_id
 *               - sender_id
 *             properties:
 *               receiver_id:
 *                 type: string
 *               sender_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Unauthorized
 */
router.put('/read-all', authenticateJWT, messageController.markMessagesAsRead);

/**
 * @swagger
 * /api/messages:
 *   delete:
 *     summary: Delete a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message_id
 *             properties:
 *               message_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Message deleted
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Message not found
 */
router.delete('/', authenticateJWT, messageController.deleteMessage);

/**
 * @swagger
 * /api/messages/update:
 *   put:
 *     summary: Update a message by id
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sender_id
 *               - receiver_id
 *               - message_id
 *               - updated_message
 *             properties:
 *               sender_id:
 *                 type: string
 *               receiver_id:
 *                 type: string
 *               message_id:
 *                 type: integer
 *               updated_message:
 *                 type: string
 *                 description: Updated message content (will be encrypted server-side)
 *     responses:
 *       200:
 *         description: Message updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Message not found
 */
router.put('/update', authenticateJWT, messageController.updateMessageById);

module.exports = router; 