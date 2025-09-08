# Moderation API Testing Suite

This directory contains comprehensive testing files for the OpenAI moderation API used in the LuckyLink project.

## Overview

The moderation system uses:
- **OpenAI Moderation API** (`omni-moderation-latest`) - For content policy violations and moderation

## Test Files

### 1. `apiEndpointTest.js`
Basic endpoint testing for OpenAI API. Tests connectivity and basic functionality.

**Usage:**
```bash
cd server/src/test
node apiEndpointTest.js
```

**What it tests:**
- Environment variable presence
- API endpoint connectivity
- Basic API responses
- Simple moderation scenarios

### 2. `moderationEndpointTest.js`
Comprehensive testing of the moderation endpoint with JWT authentication and rate limiting.

**Usage:**
```bash
cd server/src/test
node moderationEndpointTest.js
```

**What it tests:**
- JWT authentication
- Single text moderation
- Batch moderation
- Health endpoint
- Rate limiting (10 requests per minute)

## Services

### 1. `openaiModeration.js`
OpenAI moderation service using the `omni-moderation-latest` model.

**Features:**
- Content flagging detection
- Category-based analysis
- Severity scoring
- Batch moderation
- Connection testing

## API Endpoints

### 1. `POST /api/moderation/check`
Moderate a single text using OpenAI.

**Request:**
```json
{
  "text": "Text content to moderate"
}
```

**Response:**
```json
{
  "success": true,
  "text": "Text content to moderate",
  "flagged": false,
  "categories": {...},
  "categoryScores": {...},
  "severity": 0.1,
  "recommendation": "APPROVE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. `POST /api/moderation/batch`
Moderate multiple texts in a single request (max 100).

**Request:**
```json
{
  "texts": ["Text 1", "Text 2", "Text 3"]
}
```

### 3. `GET /api/moderation/health`
Check the health status of the moderation service.

## Security Features

- **JWT Authentication**: All endpoints require valid JWT token
- **Rate Limiting**: 10 requests per minute per IP address
- **Input Validation**: Comprehensive validation of all inputs
- **Error Handling**: Secure error messages without exposing internals

## Environment Variables

Create a `.env` file in the server root directory with:

```env
# OpenAI API for content moderation
OPEN_API_KEY=your_openai_api_key_here
```

## Getting API Keys

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key to your `.env` file

## Running Tests

### Quick API Test
```bash
cd server/src/test
node apiEndpointTest.js
```

### Endpoint Test (Requires JWT Token)
```bash
cd server/src/test
node moderationEndpointTest.js
```

### Individual Service Tests
```bash
# Test OpenAI only
node -e "
const OpenAIModerationService = require('./services/openaiModeration');
const service = new OpenAIModerationService();
service.testConnection().then(result => console.log('OpenAI:', result));
"
```

## Expected Output

### Successful Test
```
🚀 Starting OpenAI API Endpoint Tests...

Environment Variables Status:
OPEN_API_KEY: ✅ Found

🔍 Testing OpenAI API endpoint...
✅ OpenAI API endpoint test successful!
📊 Moderation results: {...}

🧪 Testing moderation scenarios...
📝 Testing: "Hello, how are you today?"
Expected: Should pass moderation
OpenAI Result: ✅ PASSED

📊 Test Summary:
================
✅ OpenAI API: Working correctly

🎉 OpenAI API is working correctly! You can now use it for content moderation.
```

### Failed Test
```
🚀 Starting OpenAI API Endpoint Tests...

Environment Variables Status:
OPEN_API_KEY: ❌ Not found

❌ OPEN_API_KEY not found in environment variables

📊 Test Summary:
================
❌ OpenAI API: Failed
   Error: OPEN_API_KEY environment variable not found

💡 Recommendations:
- Add OPEN_API_KEY to your .env file
```

## Integration with Existing Code

The moderation service can be integrated into your existing moderation system:

```javascript
const OpenAIModerationService = require('./services/openaiModeration');

const moderationService = new OpenAIModerationService();

// Check if content should be flagged
const result = await moderationService.getDetailedAnalysis(userMessage);

// Use the result
if (result.flagged) {
    console.log('Content flagged:', result.flaggedCategories);
    console.log('Recommendation:', result.recommendation);
}
```

## Using the API Endpoints

### With JWT Token
```javascript
const response = await fetch('/api/moderation/check', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        text: 'Content to moderate'
    })
});

const result = await response.json();
```

## Troubleshooting

### Common Issues

1. **API Key Not Found**
   - Ensure `.env` file exists in server root
   - Check variable names match exactly
   - Restart Node.js process after adding `.env`

2. **API Connection Failed**
   - Verify API key is valid
   - Check internet connectivity
   - Ensure you have sufficient quota/credits

3. **Rate Limiting**
   - Check usage limits in OpenAI dashboard
   - Add payment method if using free tier

4. **JWT Authentication**
   - Ensure valid JWT token in Authorization header
   - Check token expiration
   - Verify token format: `Bearer <token>`

5. **Timeout Errors**
   - Increase timeout values in service files
   - Check network latency

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
DEBUG_MODERATION=true node moderationEndpointTest.js
```

## Performance Notes

- **OpenAI API**: ~200-500ms response time
- **Batch Processing**: Recommended for multiple texts (max 100 per request)
- **Rate Limiting**: 10 requests per minute
- **Caching**: Consider implementing result caching for repeated content

## Security Considerations

- Never commit API keys to version control
- Use environment variables for sensitive data
- JWT tokens required for all endpoints
- Rate limiting prevents abuse
- Input validation prevents injection attacks
- Monitor API usage and costs
- Consider implementing content filtering before API calls

## Support

For issues with:
- **OpenAI API**: Check [OpenAI Documentation](https://platform.openai.com/docs/api-reference/moderations)
- **Integration Issues**: Check service logs and error messages
- **JWT Issues**: Verify your authentication system
- **Rate Limiting**: Check request frequency and limits
