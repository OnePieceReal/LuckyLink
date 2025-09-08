const fs = require('fs');
const path = require('path');

// ============================================================================
// TLS CONFIGURATION
// ============================================================================

// check if running in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

const tlsConfig = {
  // load ssl certificates
  key: fs.readFileSync(path.join(__dirname, '../certificates/localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../certificates/localhost+2.pem')),
  
  // disable insecure ssl/tls versions
  secureOptions: require('constants').SSL_OP_NO_SSLv2 | 
                 require('constants').SSL_OP_NO_SSLv3 | 
                 require('constants').SSL_OP_NO_TLSv1 |
                 (isDevelopment ? 0 : require('constants').SSL_OP_NO_TLSv1_1),
  
  // configure cipher suites for security
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    // additional production ciphers
    ...(isDevelopment ? [] : [
      'DHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-GCM-SHA384'
    ])
  ].join(':'),
  
  honorCipherOrder: true,
  
  // certificate validation based on environment
  rejectUnauthorized: !isDevelopment,
  
  // development-specific settings
  ...(isDevelopment && {
    // allow self-signed certificates in development
    requestCert: false,
    rejectUnauthorized: false,
    // enable tls debugging if requested
    debug: process.env.DEBUG_TLS === 'true'
  }),
  
  // production-specific settings
  ...(!isDevelopment && {
    // strict certificate validation in production
    requestCert: true,
    rejectUnauthorized: true,
    // enable ocsp stapling
    requestOCSP: true,
    // perfect forward secrecy with dh parameters
    dhparam: process.env.DH_PARAMS_PATH ? 
      fs.readFileSync(process.env.DH_PARAMS_PATH) : undefined
  })
};

module.exports = tlsConfig;