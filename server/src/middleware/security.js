// security headers middleware for https and tls
const securityHeaders = (req, res, next) => {
  // hsts (http strict transport security)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // prevent mime type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // xss protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // frame options (prevent clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // content security policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: https:",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'"
  ].join('; '));
  
  // referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // permissions policy
  res.setHeader('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'fullscreen=(self)',
    'payment=()'
  ].join(', '));
  
  next();
};

// enforce https in production
const enforceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};

// log tls connection info for security monitoring
const logTLSConnection = (req, res, next) => {
  if (req.connection.encrypted) {
    // tls connection is encrypted
  } else {
    console.log('⚠️ Unencrypted connection detected'); // keep this warning for security
  }
  next();
};

module.exports = {
  securityHeaders,
  enforceHTTPS,
  logTLSConnection
};
