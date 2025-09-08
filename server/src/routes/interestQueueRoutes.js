const express = require('express');
const router = express.Router();
const interestQueueController = require('../controllers/interestQueueController');
const authenticateJWT = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: InterestQueues
 *   description: Interest queue management
 */

/**
 * @swagger
 * /api/interest-queues:
 *   post:
 *     summary: Add a user to an interest queue
 *     tags: [InterestQueues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Added to queue
 */
router.post('/', authenticateJWT, adminAuth, interestQueueController.addToQueue);

/**
 * @swagger
 * /api/interest-queues/interest/{interest_id}:
 *   get:
 *     summary: Get all users in a queue for a specific interest
 *     tags: [InterestQueues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users in queue
 */
router.get('/interest/:interest_id', authenticateJWT, adminAuth, interestQueueController.getQueueForInterest);

/**
 * @swagger
 * /api/interest-queues:
 *   delete:
 *     summary: Remove a user from an interest queue
 *     tags: [InterestQueues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Removed from queue
 */
router.delete('/', authenticateJWT, adminAuth, interestQueueController.removeFromQueue);

/**
 * @swagger
 * /api/interest-queues/user/{user_id}:
 *   get:
 *     summary: Get all queues a user is in
 *     tags: [InterestQueues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of queues
 */
router.get('/user/:user_id', authenticateJWT, adminAuth, interestQueueController.getUserQueues);

module.exports = router; 