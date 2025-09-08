const express = require('express');
const router = express.Router();
const interestController = require('../controllers/interestController');
const authenticateJWT = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: Interests
 *   description: Interest management
 */

/**
 * @swagger
 * /api/interests:
 *   post:
 *     summary: Create a new interest
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Interest created
 *       400:
 *         description: Invalid input
 */
// Admin-only: Create new interests
router.post('/', requireAdmin, interestController.createInterest);

/**
 * @swagger
 * /api/interests:
 *   get:
 *     summary: Get all interests
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of interests
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateJWT, interestController.getAllInterests);

/**
 * @swagger
 * /api/interests/{id}:
 *   get:
 *     summary: Get interest by ID
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     responses:
 *       200:
 *         description: Interest found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Interest not found
 */
router.get('/:id', authenticateJWT, interestController.getInterestById);

/**
 * @swagger
 * /api/interests/{id}:
 *   put:
 *     summary: Update interest
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interest updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Interest not found
 */
// Admin-only: Update interests
router.put('/:id', requireAdmin, interestController.updateInterest);

/**
 * @swagger
 * /api/interests/{id}:
 *   delete:
 *     summary: Delete interest
 *     tags: [Interests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Interest ID
 *     responses:
 *       200:
 *         description: Interest deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Interest not found
 */
// Admin-only: Delete interests
router.delete('/:id', requireAdmin, interestController.deleteInterest);

module.exports = router; 