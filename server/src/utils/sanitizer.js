const validator = require('validator');

/**
 * simple sanitization utilities to prevent XSS attacks
 * designed to be non-breaking - returns original value if valid
 */

/**
 * escape html entities to prevent XSS
 * this is safe and won't break functionality
 * @param {string} input - the input string to escape
 * @returns {string} - escaped string
 */
function escapeHtml(input) {
  if (!input || typeof input !== 'string') {
    return input || '';
  }
  
  // only escape html entities - this won't break any functionality
  return validator.escape(input);
}

/**
 * validate uuid format
 * @param {string} uuid - uuid string
 * @returns {boolean} - true if valid uuid
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return validator.isUUID(uuid);
}

/**
 * simple email validation
 * @param {string} email - email address
 * @returns {boolean} - true if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return validator.isEmail(email);
}

/**
 * remove sql injection characters from search queries
 * @param {string} query - search query
 * @returns {string} - cleaned query
 */
function cleanSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // only remove dangerous sql characters
  // keep letters, numbers, spaces, and common punctuation
  return query.replace(/[;'"\\]/g, '').trim();
}

module.exports = {
  escapeHtml,
  isValidUUID,
  isValidEmail,
  cleanSearchQuery
};