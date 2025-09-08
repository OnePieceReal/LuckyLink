const userModel = require('../models/user');
const userKeyModel = require('../models/userKey');
const bcrypt = require('bcryptjs');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { verifyRecaptchaToken } = require('../services/recaptcha');
const { escapeHtml, isValidEmail } = require('../utils/sanitizer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// local user registration with validation and recaptcha
async function register(req, res) {
  let { username, email, password, recaptchaToken } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email, or password' });
  }

  // sanitize and validate input data
  username = escapeHtml(username.trim());
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token is required' });
  }

  const recaptchaValid = await verifyRecaptchaToken(recaptchaToken, req.ip);
  if (!recaptchaValid) {
    return res.status(400).json({ error: 'reCAPTCHA verification failed' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ username, email, password_hash: hash });
    
    // generate jwt token for authentication
    const token = jwt.sign({ 
      userId: user.id, 
      username: user.username 
    }, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' });
    
    res.status(201).json({ 
      message: 'User registered successfully', 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// local user login with credential validation
async function login(req, res) {
  let { email, password, recaptchaToken } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  // sanitize input and verify recaptcha
  email = email.trim();
  
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token is required' });
  }

  const recaptchaValid = await verifyRecaptchaToken(recaptchaToken, req.ip);
  if (!recaptchaValid) {
    return res.status(400).json({ error: 'reCAPTCHA verification failed' });
  }

  try {
    const user = await userModel.getUserByUsername(email) || await userModel.getUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ 
      userId: user.id, 
      username: user.username 
    }, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' });
    
    res.json({ 
      token, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        lastActiveAt: user.last_active_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// google oauth authentication handlers
const googleAuthStart = passport.authenticate('google', { scope: ['profile', 'email'] });
const googleAuthCallback = [
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // generate jwt token for authenticated user
    const token = jwt.sign({ 
      userId: req.user.id, 
      username: req.user.username 
    }, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' });
    
    // redirect to frontend with token and user data
    const userData = encodeURIComponent(JSON.stringify({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      status: req.user.status,
      lastActiveAt: req.user.last_active_at
    }));
    
    const redirectUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}?token=${token}&user=${userData}`;
    res.redirect(redirectUrl);
  }
];

// github oauth authentication handlers
const githubAuthStart = passport.authenticate('github', { scope: ['user:email'] });
const githubAuthCallback = [
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ 
      userId: req.user.id, 
      username: req.user.username 
    }, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' });
    
    // redirect to frontend with token and user data
    const userData = encodeURIComponent(JSON.stringify({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      status: req.user.status,
      lastActiveAt: req.user.last_active_at
    }));
    
    const redirectUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}?token=${token}&user=${userData}`;
    res.redirect(redirectUrl);
  }
];

// user logout with server-side cleanup
async function logout(req, res) {
  try {
    const userId = req.userId; // from jwt auth middleware
    
    // status update handled via socket.io disconnect event
    // no need to update status here as client will disconnect websocket
    
    res.json({ 
      message: 'Logged out successfully',
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Logout failed', 
      success: false 
    });
  }
}

module.exports = {
  register,
  login,
  googleAuthStart,
  googleAuthCallback,
  githubAuthStart,
  githubAuthCallback,
  logout,
}; 