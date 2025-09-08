const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateJWT = require('../middleware/auth');
const OpenAIImageService = require('../services/openaiImageService');
const S3Service = require('../services/s3Service');
const userModel = require('../models/user');

// Rate limiting: 5 requests per 10 minutes per user for startup environment
// Image generation is expensive, so we're more conservative here
const imageGenerationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // limit each user to 5 requests per 10 minutes
    message: {
        error: 'Too many image generation requests. Please try again later.',
        retryAfter: 600 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID for rate limiting instead of IP
        return req.user ? req.user.userId : 'anonymous';
    },
    // Don't skip successful requests since image generation is expensive
    skipSuccessfulRequests: false
});

// Initialize services
const imageService = new OpenAIImageService();
const s3Service = new S3Service();

/**
 * @swagger
 * /api/images/generate-profile:
 *   post:
 *     summary: Generate a profile image based on user description
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customDescription:
 *                 type: string
 *                 description: Optional custom description to override user profile description
 *                 example: "A creative artist who loves nature"
 *               quality:
 *                 type: string
 *                 enum: [standard, hd]
 *                 default: standard
 *                 description: Image quality
 *               size:
 *                 type: string
 *                 enum: ['1024x1024', '1024x1792', '1792x1024']
 *                 default: '1024x1024'
 *                 description: Image size
 *     responses:
 *       200:
 *         description: Successfully generated profile image
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 imageUrl:
 *                   type: string
 *                   description: URL of the generated image
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                     size:
 *                       type: string
 *                     quality:
 *                       type: string
 *       400:
 *         description: Bad request - missing or invalid description
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       403:
 *         description: Content violates moderation policy
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post('/generate-profile', 
    authenticateJWT, 
    imageGenerationLimiter,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { customDescription, quality, size } = req.body;

            // Check if services are configured
            if (!imageService.isConfigured()) {
                return res.status(503).json({
                    error: 'Image generation service is not configured. Please check API keys.'
                });
            }


            if (!s3Service.isConfigured()) {
                return res.status(503).json({
                    error: 'S3 service is not configured. Please check AWS credentials.'
                });
            }

            // Get user profile
            const user = await userModel.getUserById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            // Determine which description to use
            let description = customDescription || user.description;

            // Check if description exists
            if (!description || description.trim().length === 0) {
                return res.status(400).json({
                    error: 'No description available. Please add a profile description or provide a custom description.'
                });
            }

            // Validate description length
            if (description.length > 500) {
                return res.status(400).json({
                    error: 'Description is too long. Maximum 500 characters allowed.'
                });
            }

            console.log(`Generating profile image for user ${userId}`);

            // Validate optional parameters
            const validatedParams = imageService.validateParameters({
                quality: quality || 'standard',
                size: size || '1024x1024',
                response_format: 'url'
            });

            // Generate 3 images
            const imageResult = await imageService.generateProfileImage(
                description,
                { n: 3, ...validatedParams } // Generate 3 images for selection
            );

            // Log successful generation
            console.log(`Profile images generated successfully for user ${userId}`);

            // Return the generated images for user selection (don't save to S3 yet)
            res.json({
                success: true,
                images: imageResult.images || [{ url: imageResult.url, revised_prompt: imageResult.revised_prompt }], // Support both single and multiple image responses
                metadata: {
                    ...imageResult.metadata,
                    userId: userId,
                    username: user.username,
                    description: description.substring(0, 200)
                },
                cost: imageService.getCostEstimate(validatedParams.quality, validatedParams.size)
            });

        } catch (error) {
            console.error('Error in image generation endpoint:', error);

            // Handle specific errors
            if (error.message.includes('violates policy') || error.message.includes('Content may violate policy')) {
                return res.status(403).json({
                    error: 'Content violates OpenAI policy',
                    details: 'The provided description contains content that violates OpenAI usage policies'
                });
            }

            if (error.message.includes('Rate limit')) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: 60
                });
            }

            if (error.message.includes('Invalid API key')) {
                return res.status(503).json({
                    error: 'Service configuration error'
                });
            }

            // Generic error response
            res.status(500).json({
                error: 'Failed to generate image',
                message: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/images/save-selected:
 *   post:
 *     summary: Save selected image from generated options to S3 and update user profile
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 description: URL of the selected image to save
 *                 example: "https://oaidalleapiprodscus.blob.core.windows.net/..."
 *               revisedPrompt:
 *                 type: string
 *                 description: The revised prompt from OpenAI (optional)
 *     responses:
 *       200:
 *         description: Image successfully saved and profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 imageUrl:
 *                   type: string
 *                   description: Pre-signed URL for immediate display
 *                 s3Key:
 *                   type: string
 *                   description: S3 object key
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Bad request - missing imageUrl
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/save-selected',
    authenticateJWT,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { imageUrl, revisedPrompt } = req.body;

            // Validate required fields
            if (!imageUrl) {
                return res.status(400).json({
                    error: 'Image URL is required'
                });
            }

            console.log(`Saving selected profile image for user ${userId}`);

            // Check if services are configured
            if (!s3Service.isConfigured()) {
                return res.status(503).json({
                    error: 'S3 service is not configured. Please check AWS credentials.'
                });
            }

            // Get user profile
            const user = await userModel.getUserById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            // Upload selected image to S3
            const s3Key = `users/${userId}/profile/current.png`;
            console.log(`Uploading selected profile image to S3 with key: ${s3Key}`);
            
            const s3Result = await s3Service.uploadImageFromUrl(
                imageUrl,
                s3Key,
                {
                    userId: userId,
                    username: user.username,
                    generatedAt: new Date().toISOString(),
                    revisedPrompt: revisedPrompt || '',
                    selectedImage: true
                }
            );

            // Update user's profile_picture_url in database
            const s3Url = s3Result.location;
            await userModel.updateUser(userId, {
                profile_picture_url: s3Url
            });

            console.log(`Profile picture URL updated in database for user ${userId}`);

            // Generate a pre-signed URL for immediate display (expires in 1 hour)
            const presignedUrl = await s3Service.getPresignedUrl(s3Key, 3600);
            console.log(`Generated pre-signed URL for immediate display`);

            // Return the result
            res.json({
                success: true,
                imageUrl: presignedUrl,
                s3Key: s3Key,
                metadata: {
                    s3Location: s3Result.location,
                    bucket: s3Result.bucket,
                    userId: userId,
                    username: user.username,
                    savedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error saving selected image:', error);

            // Handle specific errors
            if (error.message.includes('S3')) {
                return res.status(503).json({
                    error: 'Failed to save image to storage',
                    details: error.message
                });
            }

            // Generic error response
            res.status(500).json({
                error: 'Failed to save selected image',
                message: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/images/generate-from-text:
 *   post:
 *     summary: Generate an image from provided text (requires authentication)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: Text description for image generation
 *                 example: "A peaceful mountain landscape at sunset"
 *               quality:
 *                 type: string
 *                 enum: [standard, hd]
 *                 default: standard
 *               size:
 *                 type: string
 *                 enum: ['1024x1024', '1024x1792', '1792x1024']
 *                 default: '1024x1024'
 *     responses:
 *       200:
 *         description: Successfully generated image
 *       400:
 *         description: Bad request - missing or invalid description
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Content violates policy
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/generate-from-text',
    authenticateJWT,
    imageGenerationLimiter,
    async (req, res) => {
        try {
            const { description, quality, size } = req.body;

            // Validate description
            if (!description || typeof description !== 'string') {
                return res.status(400).json({
                    error: 'Description is required and must be a string'
                });
            }

            if (description.trim().length === 0) {
                return res.status(400).json({
                    error: 'Description cannot be empty'
                });
            }

            if (description.length > 500) {
                return res.status(400).json({
                    error: 'Description is too long. Maximum 500 characters allowed.'
                });
            }

            // Check if service is configured
            if (!imageService.isConfigured()) {
                return res.status(503).json({
                    error: 'Image generation service is not properly configured'
                });
            }

            // Validate optional parameters
            const validatedParams = imageService.validateParameters({
                quality: quality || 'standard',
                size: size || '1024x1024',
                response_format: 'url'
            });

            console.log(`Generating image from text for user ${req.user.userId}`);

            // Generate image
            const imageResult = await imageService.generateProfileImage(
                description
            );

            res.json({
                success: true,
                imageUrl: imageResult.url,
                revisedPrompt: imageResult.revised_prompt,
                metadata: {
                    ...imageResult.metadata,
                    userId: req.user.userId,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error generating image from text:', error);

            if (error.message.includes('violates policy') || error.message.includes('Content may violate policy')) {
                return res.status(403).json({
                    error: 'Content violates OpenAI policy',
                    details: 'The provided description contains content that violates OpenAI usage policies'
                });
            }

            res.status(500).json({
                error: 'Failed to generate image',
                message: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/images/test-connection:
 *   get:
 *     summary: Test OpenAI Image API connection (admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 services:
 *                   type: object
 *                   properties:
 *                     imageService:
 *                       type: boolean
 *                     moderationService:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/test-connection',
    authenticateJWT,
    async (req, res) => {
        try {
            const imageServiceConnected = await imageService.testConnection();

            res.json({
                connected: imageServiceConnected,
                services: {
                    imageService: imageServiceConnected
                }
            });
        } catch (error) {
            console.error('Error testing connection:', error);
            res.status(500).json({
                error: 'Connection test failed',
                message: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/images/profile-picture/{userId}:
 *   get:
 *     summary: Get user's profile picture with pre-signed S3 URL
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Profile picture URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   description: Pre-signed S3 URL or OAuth URL
 *                 source:
 *                   type: string
 *                   enum: [s3, oauth, none]
 *                   description: Source of the image
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found or no profile picture
 */
router.get('/profile-picture/:userId',
    authenticateJWT,
    async (req, res) => {
        try {
            const { userId } = req.params;
            
            // Get user from database
            const user = await userModel.getUserById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            // Check S3 for profile picture first
            if (s3Service.isConfigured()) {
                const s3Key = `users/${userId}/profile/current.png`;
                try {
                    // Check if object exists in S3
                    await s3Service.getObjectMetadata(s3Key);
                    
                    // Generate pre-signed URL (expires in 1 hour)
                    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 3600);
                    
                    return res.json({
                        imageUrl: presignedUrl,
                        source: 's3'
                    });
                } catch (error) {
                    // Object doesn't exist in S3, continue to check OAuth
                    console.log(`No S3 profile picture for user ${userId}`);
                }
            }

            // Check for OAuth profile picture
            if (user.profile_picture_url) {
                // If it's an OAuth URL (Google/GitHub), return it directly
                if (user.profile_picture_url.includes('googleusercontent.com') || 
                    user.profile_picture_url.includes('avatars.githubusercontent.com')) {
                    return res.json({
                        imageUrl: user.profile_picture_url,
                        source: 'oauth'
                    });
                }
            }

            // No profile picture found
            res.json({
                imageUrl: null,
                source: 'none'
            });

        } catch (error) {
            console.error('Error getting profile picture:', error);
            res.status(500).json({
                error: 'Failed to get profile picture',
                message: error.message
            });
        }
    }
);

/**
 * @swagger
 * /api/images/cost-estimate:
 *   get:
 *     summary: Get cost estimate for image generation
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: quality
 *         schema:
 *           type: string
 *           enum: [standard, hd]
 *           default: standard
 *       - in: query
 *         name: size
 *         schema:
 *           type: string
 *           enum: ['1024x1024', '1024x1792', '1792x1024']
 *           default: '1024x1024'
 *     responses:
 *       200:
 *         description: Cost estimate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 estimated_cost:
 *                   type: number
 *                   example: 0.04
 *                 currency:
 *                   type: string
 *                   example: USD
 *                 model:
 *                   type: string
 *                   example: dall-e-3
 *       401:
 *         description: Unauthorized
 */
router.get('/cost-estimate',
    authenticateJWT,
    (req, res) => {
        const { quality = 'standard', size = '1024x1024' } = req.query;
        
        const estimate = imageService.getCostEstimate(quality, size);
        
        res.json(estimate);
    }
);

module.exports = router;