const express = require('express');
const router = express.Router();
const moderationLogController = require('../controllers/moderationLogController');
const authenticateJWT = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');

/**
 * @swagger
 * tags:
 *   name: ModerationLogs
 *   description: Chat history moderation log management
 */

/**
 * @swagger
 * /api/moderation-logs:
 *   post:
 *     summary: Add a moderation log for chat history
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reported_user
 *               - chat_history
 *               - moderation_data
 *             properties:
 *               reported_user:
 *                 type: string
 *               chat_history:
 *                 type: object
 *               moderation_data:
 *                 type: object
 *               chat_session_id:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Moderation log added
 *       409:
 *         description: Duplicate report
 */
router.post('/', authenticateJWT, moderationLogController.addModerationLog);

/**
 * @swagger
 * /api/moderation-logs/user/{username}:
 *   get:
 *     summary: Get all logs for a reported user
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of logs for user
 */
// Admin-only endpoint - blocked for now
router.get('/user/:username', requireAdmin, moderationLogController.getLogsForUser);

/**
 * @swagger
 * /api/moderation-logs/reporter/{username}:
 *   get:
 *     summary: Get all logs by reporting user
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of logs by reporter
 */
// Admin-only endpoint - blocked for now
router.get('/reporter/:username', requireAdmin, moderationLogController.getLogsByReporter);

/**
 * @swagger
 * /api/moderation-logs:
 *   get:
 *     summary: Get all moderation logs
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all logs
 */
// Admin-only endpoint - blocked for now
router.get('/', requireAdmin, moderationLogController.getAllLogs);

/**
 * @swagger
 * /api/moderation-logs/status:
 *   put:
 *     summary: Update moderation log status
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - status
 *             properties:
 *               id:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, actioned, dismissed]
 *               action_taken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Log status updated
 */
// Admin-only endpoint - blocked for now
router.put('/status', requireAdmin, moderationLogController.updateLogStatus);

/**
 * @swagger
 * /api/moderation-logs:
 *   delete:
 *     summary: Delete a moderation log
 *     tags: [ModerationLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Moderation log deleted
 */
// Admin-only endpoint - blocked for now
router.delete('/', requireAdmin, moderationLogController.deleteModerationLog);

module.exports = router; 