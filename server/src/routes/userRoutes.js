const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateJWT = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password_hash
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password_hash:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Invalid input
 */
router.post('/', requireAdmin, userController.createUser); // Admin only - regular users should use /api/auth/register

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 */
// Admin-only endpoint - disabled for security
router.get('/', requireAdmin, userController.getAllUsers);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/me', authenticateJWT, userController.getCurrentUser);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username to search for (partial match)
 *     responses:
 *       200:
 *         description: List of matching users
 *       400:
 *         description: Invalid username parameter
 *       401:
 *         description: Unauthorized
 */
router.get('/search', authenticateJWT, userController.searchUsers);

/**
 * @swagger
 * /api/users/profile/{username}:
 *   get:
 *     summary: Get user profile by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username
 *     responses:
 *       200:
 *         description: User profile found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile/:username', authenticateJWT, userController.getUserProfileByUsername);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticateJWT, userController.getUserById);

// Update user
router.put('/:id', authenticateJWT, userController.updateUser);

// Delete user - removed duplicate route, using the one below

// Update user status
router.patch('/:id/status', authenticateJWT, userController.updateUserStatus);

/**
 * @swagger
 * /api/users/{id}/status:
 *   get:
 *     summary: Get user status (Redis-based)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: User status (online/offline/away/dnd/invisible)
 *       400:
 *         description: Invalid user ID format
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id/status', authenticateJWT, userController.getUserStatus);

// Update user description
router.patch('/:id/description', authenticateJWT, userController.updateUserDescription);

// Update user last_active_at
router.patch('/:id/last-active', authenticateJWT, userController.updateUserLastActive);

// Heartbeat endpoint to keep user active
router.post('/heartbeat', authenticateJWT, userController.heartbeat);

// Mark user as offline (for page unload)
router.post('/offline', authenticateJWT, userController.markOffline);

// Mark user as online (for page visibility change)
router.post('/online', authenticateJWT, userController.markOnline);

// Get public key of user by id
// Admin-only endpoint - public/private keys not currently in use
router.get('/:id/public-key', requireAdmin, userController.getUserPublicKey);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user account and all associated data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Invalid user ID format
 *       403:
 *         description: Can only delete own account
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticateJWT, userController.deleteUser);

module.exports = router; 