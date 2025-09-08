const express = require('express');
const router = express.Router();
const friendRequestController = require('../controllers/friendRequestController');
const authenticateJWT = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: FriendRequests
 *   description: Friend request management
 */

/**
 * @swagger
 * /api/friend-requests:
 *   post:
 *     summary: Send a friend request
 *     tags: [FriendRequests]
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
 *             properties:
 *               sender_id:
 *                 type: string
 *               receiver_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Friend request sent
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateJWT, friendRequestController.sendFriendRequest);

/**
 * @swagger
 * /api/friend-requests/{user_id}:
 *   get:
 *     summary: Get all friend requests for a user
 *     tags: [FriendRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of friend requests
 *       400:
 *         description: Invalid input
 */
router.get('/:user_id', authenticateJWT, friendRequestController.getFriendRequestsForUser);

/**
 * @swagger
 * /api/friend-requests:
 *   put:
 *     summary: Respond to a friend request (accept/reject)
 *     tags: [FriendRequests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - status
 *               - receiver_id
 *             properties:
 *               request_id:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *               receiver_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Friend request responded
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Friend request not found
 */
router.put('/', authenticateJWT, friendRequestController.respondToFriendRequest);

/**
 * @swagger
 * /api/friend-requests:
 *   delete:
 *     summary: Delete a friend request
 *     tags: [FriendRequests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *             properties:
 *               request_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Friend request deleted
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Friend request not found
 */
router.delete('/', authenticateJWT, friendRequestController.deleteFriendRequest);

module.exports = router; 