const axios = require('axios');

// verify recaptcha token with google's verification service
async function verifyRecaptchaToken(token, remoteip = null) {
  try {
    const secretKey = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error('GOOGLE_RECAPTCHA_SECRET_KEY not found in environment variables');
      return false;
    }

    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: secretKey,
      response: token
    });

    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await axios.post(verificationUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000 // 5 second timeout for recaptcha verification
    });

    const result = response.data;
    
    if (result.success) {
      console.log('✅ reCAPTCHA verification successful');
      return true;
    } else {
      console.error('❌ reCAPTCHA verification failed:', result['error-codes']);
      return false;
    }
  } catch (error) {
    console.error('Error verifying reCAPTCHA token:', error.message);
    return false;
  }
}

// middleware to verify recaptcha token in requests
function recaptchaMiddleware(tokenField = 'recaptchaToken') {
  return async (req, res, next) => {
    try {
      const token = req.body[tokenField] || req.query[tokenField];
      
      if (!token) {
        return res.status(400).json({
          error: 'reCAPTCHA token is required',
          code: 'RECAPTCHA_MISSING'
        });
      }

      const remoteip = req.ip || req.connection.remoteAddress;
      const isValid = await verifyRecaptchaToken(token, remoteip);

      if (!isValid) {
        return res.status(400).json({
          error: 'reCAPTCHA verification failed',
          code: 'RECAPTCHA_INVALID'
        });
      }

      next();
    } catch (error) {
      console.error('reCAPTCHA middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error during reCAPTCHA verification',
        code: 'RECAPTCHA_ERROR'
      });
    }
  };
}

module.exports = {
  verifyRecaptchaToken,
  recaptchaMiddleware
}; 