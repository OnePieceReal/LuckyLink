const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authenticateJWT = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Friends
 *   description: Friend relationship management
 */

/**
 * @swagger
 * /api/friends:
 *   post:
 *     summary: Add a friend relationship
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - friend_id
 *             properties:
 *               user_id:
 *                 type: string
 *               friend_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Friend relationship added
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateJWT, friendController.addFriend);

/**
 * @swagger
 * /api/friends/{user_id}:
 *   get:
 *     summary: Get all friends for a user
 *     tags: [Friends]
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
 *         description: List of friends
 *       400:
 *         description: Invalid input
 */
router.get('/:user_id', authenticateJWT, friendController.getFriendsForUser);

/**
 * @swagger
 * /api/friends:
 *   delete:
 *     summary: Remove a friend relationship
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - friend_id
 *             properties:
 *               user_id:
 *                 type: string
 *               friend_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Friend removed
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Friend relationship not found
 */
router.delete('/', authenticateJWT, friendController.removeFriend);

/**
 * @swagger
 * /api/friends/{user_id}/{friend_id}:
 *   delete:
 *     summary: Remove friend and all associated data (messages, friend requests)
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *       - in: path
 *         name: friend_id
 *         schema:
 *           type: string
 *         required: true
 *         description: Friend ID
 *     responses:
 *       200:
 *         description: Friend and all associated data removed
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.delete('/:user_id/:friend_id', authenticateJWT, friendController.deleteFriendCompletely);

module.exports = router; 