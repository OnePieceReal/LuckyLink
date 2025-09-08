const axios = require('axios');

// openai image generation service using dall-e 3 model
class OpenAIImageService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1/images/generations';
        this.model = 'dall-e-3';
        
        // image generation constraints
        this.maxPromptLength = 1000; // conservative limit for faster generation
        this.imageSize = '1024x1024'; // square format for profile pictures
        this.quality = 'standard'; // use 'standard' for faster generation, 'hd' for higher quality
        
        if (!this.apiKey) {
            console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
        }
    }

    // check if service is properly configured
    isConfigured() {
        return !!this.apiKey;
    }

    // build optimized prompt for profile image generation
    buildProfilePrompt(userDescription) {
        // sanitize and truncate user description
        const sanitizedDescription = userDescription
            ? userDescription.trim().substring(0, 300)
            : 'A friendly person';

        // focused prompt for professional profile avatars
        const profilePrompt = `Professional profile avatar representing: ${sanitizedDescription}. Portrait style, centered composition, no text, single person, artistic representation, vibrant colors, friendly appearance.`;

        return profilePrompt;
    }

    // generate profile image based on user description
    async generateProfileImage(userDescription, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI API key not configured');
        }

        // validate user description
        if (!userDescription || typeof userDescription !== 'string') {
            throw new Error('Valid user description is required');
        }

        if (userDescription.trim().length === 0) {
            throw new Error('User description cannot be empty');
        }

        try {
            // handle multiple image generation for dall-e 3
            const numberOfImages = options.n || 1;
            
            if (numberOfImages > 1) {
                // dall-e 3 requires separate api calls for multiple images
                console.log(`Generating ${numberOfImages} images with separate API calls...`);
                const imagePromises = [];
                
                for (let i = 0; i < numberOfImages; i++) {
                    imagePromises.push(
                        this.generateProfileImage(userDescription, { ...options, n: 1 })
                    );
                }
                
                const imageResults = await Promise.all(imagePromises);
                
                // return combined results
                return {
                    success: true,
                    images: imageResults.map(result => ({
                        url: result.url,
                        revised_prompt: result.revised_prompt
                    })),
                    created: imageResults[0].created,
                    metadata: {
                        ...imageResults[0].metadata,
                        count: numberOfImages,
                        multipleGeneration: true
                    }
                };
            }
            
            // build profile prompt
            const profilePrompt = this.buildProfilePrompt(userDescription);

            // prepare request
            const requestBody = {
                model: this.model,
                prompt: profilePrompt,
                n: 1, // dall-e 3 only supports n=1
                size: options.size || this.imageSize,
                quality: options.quality || this.quality,
                response_format: options.response_format || 'url',
                style: 'vivid' // use vivid style for more vibrant images
            };

            console.log('Generating profile image with prompt length:', profilePrompt.length);

            // make api request
            const response = await axios.post(this.baseURL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout for image generation
            });

            // process response
            const imageDataArray = response.data.data;
            
            // return single image result
            const imageData = imageDataArray[0];
            return {
                success: true,
                url: imageData.url,
                revised_prompt: imageData.revised_prompt,
                created: response.data.created,
                metadata: {
                    model: this.model,
                    size: requestBody.size,
                    quality: requestBody.quality,
                    original_description: userDescription.substring(0, 100) + '...'
                }
            };

        } catch (error) {
            console.error('OpenAI image generation error:', error.message);
            
            // handle specific error cases
            if (error.response) {
                const status = error.response.status;
                const errorMessage = error.response.data?.error?.message || error.response.statusText;
                
                if (status === 400) {
                    // content policy violation or invalid request
                    throw new Error(`Image generation failed: Content may violate policy or invalid request - ${errorMessage}`);
                } else if (status === 401) {
                    throw new Error('Invalid API key');
                } else if (status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else if (status === 500) {
                    throw new Error('OpenAI service error. Please try again.');
                } else {
                    throw new Error(`OpenAI API error: ${status} - ${errorMessage}`);
                }
            } else if (error.request) {
                throw new Error('Image generation request failed - no response received');
            } else {
                throw new Error(`Image generation error: ${error.message}`);
            }
        }
    }

    // validate image generation parameters
    validateParameters(params) {
        const validSizes = ['1024x1024', '1024x1792', '1792x1024'];
        const validQualities = ['standard', 'hd'];
        const validFormats = ['url', 'b64_json'];

        const validated = {
            size: validSizes.includes(params.size) ? params.size : '1024x1024',
            quality: validQualities.includes(params.quality) ? params.quality : 'standard',
            response_format: validFormats.includes(params.response_format) ? params.response_format : 'url'
        };

        return validated;
    }

    // get generation cost estimate
    getCostEstimate(quality = 'standard', size = '1024x1024') {
        // dall-e 3 pricing (as of 2024)
        const pricing = {
            'standard': {
                '1024x1024': 0.040,
                '1024x1792': 0.080,
                '1792x1024': 0.080
            },
            'hd': {
                '1024x1024': 0.080,
                '1024x1792': 0.120,
                '1792x1024': 0.120
            }
        };

        const cost = pricing[quality]?.[size] || 0.040;

        return {
            estimated_cost: cost,
            currency: 'USD',
            model: this.model,
            quality,
            size
        };
    }

    // test api connection
    async testConnection() {
        try {
            // try to generate a simple test image
            const testPrompt = 'A simple geometric pattern, abstract art, safe for work';
            
            const response = await axios.post(this.baseURL, {
                model: this.model,
                prompt: testPrompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard'
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return response.status === 200;
        } catch (error) {
            console.error('OpenAI Image API connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = OpenAIImageService;