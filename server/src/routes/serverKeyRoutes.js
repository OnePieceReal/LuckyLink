const express = require('express');
const router = express.Router();
const serverKeyController = require('../controllers/serverKeyController');
const authenticateJWT = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: ServerKeys
 *   description: Server key management
 */

/**
 * @swagger
 * /api/server-keys/public-key:
 *   get:
 *     summary: Get server public key
 *     tags: [ServerKeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server public key returned
 */
// Admin-only endpoint - blocked for now
router.get('/public-key', requireAdmin, serverKeyController.getServerPublicKey);

module.exports = router; 