const express = require('express');
const router = express.Router();
const userKeyController = require('../controllers/userKeyController');
const authenticateJWT = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: UserKeys
 *   description: User key management
 */

/**
 * @swagger
 * /api/user-keys/validate:
 *   post:
 *     summary: Validate another user's public key
 *     tags: [UserKeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Public key validated
 */
// Admin-only endpoint - blocked for now
router.post('/validate', requireAdmin, userKeyController.validateUserPublicKey);

/**
 * @swagger
 * /api/user-keys/{id}:
 *   get:
 *     summary: Get public key of user by id
 *     tags: [UserKeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Public key returned
 */
// Admin-only endpoint - blocked for now
router.get('/:id', requireAdmin, userKeyController.getUserPublicKey);

module.exports = router; 