const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateJWT = require('../middleware/auth');
const OpenAIModerationService = require('../services/openaiModeration');

// Rate limiting: 30 requests per 5 minutes for startup environment
// This allows reasonable usage while preventing abuse
const moderationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // limit each IP to 30 requests per 5 minutes
    message: {
        error: 'Too many moderation requests, please try again later.',
        retryAfter: 300 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests to be more lenient for legitimate users
    skipSuccessfulRequests: false
});

// Initialize OpenAI moderation service
const moderationService = new OpenAIModerationService();

/**
 * @swagger
 * /api/moderation/check:
 *   post:
 *     summary: Check content moderation using OpenAI
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text content to moderate
 *                 example: "Hello, how are you today?"
 *     responses:
 *       200:
 *         description: Moderation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 text:
 *                   type: string
 *                 flagged:
 *                   type: boolean
 *                 categories:
 *                   type: object
 *                 categoryScores:
 *                   type: object
 *                 severity:
 *                   type: number
 *                 recommendation:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Bad request - missing or invalid text
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       429:
 *         description: Too many requests - rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/check', 
    authenticateJWT, 
    moderationLimiter, 
    async (req, res) => {
        try {
            const { text } = req.body;

            // Validate input
            if (!text || typeof text !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Text content is required and must be a string'
                });
            }

            if (text.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Text content cannot be empty'
                });
            }

            // Check text length (OpenAI has ~4096 token limit)
            if (text.length > 32000) {
                return res.status(400).json({
                    success: false,
                    error: 'Text is too long. Maximum length is 32,000 characters.'
                });
            }

            // Check if moderation service is configured
            if (!moderationService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    error: 'Moderation service is not configured'
                });
            }

            // Get detailed moderation analysis
            const result = await moderationService.getDetailedAnalysis(text);

            // Return moderation result
            
            res.json({
                success: true,
                text: text,
                ...result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Moderation endpoint error:', error.message);
            
            // Handle OpenAI API errors
            if (error.message.includes('OpenAI API error')) {
                return res.status(500).json({
                    success: false,
                    error: 'Moderation service temporarily unavailable',
                    details: error.message
                });
            }

            // Handle other errors
            res.status(500).json({
                success: false,
                error: 'Internal server error during moderation'
            });
        }
    }
);

/**
 * @swagger
 * /api/moderation/batch:
 *   post:
 *     summary: Batch moderate multiple texts using OpenAI
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               texts
 *             properties:
 *               texts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of texts to moderate
 *                 example: ["Hello", "How are you?", "Good morning"]
 *     responses:
 *       200:
 *         description: Batch moderation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       flagged:
 *                         type: boolean
 *                       categories:
 *                         type: object
 *                       categoryScores:
 *                         type: object
 *                       severity:
 *                         type: number
 *                       recommendation:
 *                         type: string
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Bad request - missing or invalid texts array
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       429:
 *         description: Too many requests - rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/batch', 
    authenticateJWT, 
    moderationLimiter, 
    async (req, res) => {
        try {
            const { texts } = req.body;

            // Validate input
            if (!Array.isArray(texts) || texts.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Texts array is required and must contain at least one text'
                });
            }

            if (texts.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 100 texts allowed per batch request'
                });
            }

            // Validate each text
            for (let i = 0; i < texts.length; i++) {
                if (typeof texts[i] !== 'string' || texts[i].trim().length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid text at index ${i}: must be a non-empty string`
                    });
                }
                
                // Check individual text length (OpenAI has ~4096 token limit)
                if (texts[i].length > 32000) {
                    return res.status(400).json({
                        success: false,
                        error: `Text at index ${i} is too long. Maximum length is 32,000 characters.`
                    });
                }
            }

            // Check if moderation service is configured
            if (!moderationService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    error: 'Moderation service is not configured'
                });
            }

            // Batch moderate texts
            const results = await moderationService.batchModerate(texts);

            // Format results
            const formattedResults = results;

            // Return batch results
            res.json({
                success: true,
                results: formattedResults,
                totalTexts: texts.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Batch moderation endpoint error:', error.message);
            
            // Handle OpenAI API errors
            if (error.message.includes('OpenAI API error')) {
                return res.status(500).json({
                    success: false,
                    error: 'Moderation service temporarily unavailable',
                    details: error.message
                });
            }

            // Handle other errors
            res.status(500).json({
                success: false,
                error: 'Internal server error during batch moderation'
            });
        }
    }
);

/**
 * @swagger
 * /api/moderation/health:
 *   get:
 *     summary: Check moderation service health
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 configured:
 *                   type: boolean
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 */
router.get('/health', 
    authenticateJWT, 
    async (req, res) => {
        try {
            const isConfigured = moderationService.isConfigured();
            let isHealthy = false;

            if (isConfigured) {
                try {
                    isHealthy = await moderationService.testConnection();
                } catch (error) {
                    console.error('Health check connection test failed:', error.message);
                }
            }

            res.json({
                success: true,
                status: isHealthy ? 'healthy' : 'unhealthy',
                configured: isConfigured,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Health check endpoint error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Internal server error during health check'
            });
        }
    }
);

module.exports = router;
