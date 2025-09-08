const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmakingController');
const authenticateJWT = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Matchmaking
 *   description: Interest-based matchmaking
 */

/**
 * @swagger
 * /api/matchmaking/request:
 *   post:
 *     summary: Request a match based on interests
 *     tags: [Matchmaking]
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
 *               - interests
 *             properties:
 *               user_id:
 *                 type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Match result
 */
router.post('/request', authenticateJWT, matchmakingController.requestMatch);

/**
 * @swagger
 * /api/matchmaking/cancel:
 *   post:
 *     summary: Cancel matchmaking and remove user from queues
 *     tags: [Matchmaking]
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
 *               - interests
 *             properties:
 *               user_id:
 *                 type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cancelled
 */
router.post('/cancel', authenticateJWT, matchmakingController.cancelMatch);

/**
 * @swagger
 * /api/matchmaking/skip:
 *   post:
 *     summary: Skip current match and find new match
 *     tags: [Matchmaking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - interests
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: New match result
 */
router.post('/skip', authenticateJWT, matchmakingController.skipMatch);
router.post('/end', authenticateJWT, matchmakingController.endMatch);

module.exports = router; 