const express = require('express');
const router = express.Router();
const userInterestController = require('../controllers/userInterestController');
const authenticateJWT = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: UserInterests
 *   description: User interest management
 */

/**
 * @swagger
 * /api/user-interests/{user_id}/{interest_id}:
 *   post:
 *     summary: Add an interest to a user
 *     tags: [UserInterests]
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
 *         name: interest_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     responses:
 *       201:
 *         description: User interest added
 *       400:
 *         description: Invalid input
 */
router.post('/:user_id/:interest_id', authenticateJWT, userInterestController.addUserInterestById);

/**
 * @swagger
 * /api/user-interests/{user_id}/{interest_id}:
 *   delete:
 *     summary: Remove an interest from a user
 *     tags: [UserInterests]
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
 *         name: interest_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     responses:
 *       200:
 *         description: User interest removed
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User interest not found
 */
router.delete('/:user_id/:interest_id', authenticateJWT, userInterestController.removeUserInterestById);

/**
 * @swagger
 * /api/user-interests/user/{user_id}:
 *   get:
 *     summary: Get all interests for a user
 *     tags: [UserInterests]
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
 *         description: List of interests
 *       400:
 *         description: Invalid input
 */
router.get('/user/:user_id', authenticateJWT, userInterestController.getUserInterests);

/**
 * @swagger
 * /api/user-interests/interest/{interest_id}:
 *   get:
 *     summary: Get all users for an interest
 *     tags: [UserInterests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interest_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     responses:
 *       200:
 *         description: List of users
 *       400:
 *         description: Invalid input
 */
router.get('/interest/:interest_id', authenticateJWT, userInterestController.getUsersByInterest);

/**
 * @swagger
 * /api/user-interests:
 *   post:
 *     summary: Add an interest to a user (legacy)
 *     tags: [UserInterests]
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
 *               - interest_id
 *             properties:
 *               user_id:
 *                 type: string
 *               interest_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: User interest added
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateJWT, userInterestController.addUserInterest);

/**
 * @swagger
 * /api/user-interests:
 *   delete:
 *     summary: Remove an interest from a user (legacy)
 *     tags: [UserInterests]
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
 *               - interest_id
 *             properties:
 *               user_id:
 *                 type: string
 *               interest_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: User interest removed
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User interest not found
 */
router.delete('/', authenticateJWT, userInterestController.removeUserInterest);

module.exports = router; 