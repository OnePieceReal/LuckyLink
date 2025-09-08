const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication
 */

// Rate limiting for registration: 5 attempts per 15 minutes per IP
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: {
        error: 'Too many registration attempts from this IP, please try again after 15 minutes',
        retryAfter: 900 // seconds
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false // Count all requests, not just errors
});

// Rate limiting for login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs
    message: {
        error: 'Too many login attempts from this IP, please try again after 15 minutes',
        retryAfter: 900 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Rate limiting for OAuth attempts: 20 per 15 minutes (more lenient for OAuth)
const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per windowMs
    message: {
        error: 'Too many OAuth attempts from this IP, please try again after 15 minutes',
        retryAfter: 900 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - recaptchaToken
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username for the user
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *                 minLength: 6
 *               recaptchaToken:
 *                 type: string
 *                 description: reCAPTCHA token from frontend
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Bad request - missing fields or reCAPTCHA verification failed
 *       409:
 *         description: Username or email already exists
 */
router.post('/register', registerLimiter, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email/username and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - recaptchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 description: User's email or username
 *               password:
 *                 type: string
 *                 description: User's password
 *               recaptchaToken:
 *                 type: string
 *                 description: reCAPTCHA token from frontend
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [online, away, dnd, invisible, offline]
 *                     lastActiveAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - missing fields or reCAPTCHA verification failed
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Start Google OAuth flow
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google
 */
router.get('/google', oauthLimiter, authController.googleAuthStart);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Google OAuth successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *                     lastActiveAt:
 *                       type: string
 *                       format: date-time
 */
router.get('/google/callback', oauthLimiter, authController.googleAuthCallback);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Start GitHub OAuth flow
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to GitHub
 */
router.get('/github', oauthLimiter, authController.githubAuthStart);

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: GitHub OAuth successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *                     lastActiveAt:
 *                       type: string
 *                       format: date-time
 */
router.get('/github/callback', oauthLimiter, authController.githubAuthCallback);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/logout', require('../middleware/auth'), authController.logout);

module.exports = router; 