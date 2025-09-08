const axios = require('axios');

// openai moderation service using omni-moderation-latest model
class OpenAIModerationService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1/moderations';
        this.model = 'omni-moderation-latest';
        
        if (!this.apiKey) {
            console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
        }
    }

    // check if service is properly configured
    isConfigured() {
        return !!this.apiKey;
    }

    // moderate text content using openai's moderation api
    async moderateContent(input, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const requestBody = {
                input: input,
                model: this.model,
                ...options
            };

            const response = await axios.post(this.baseURL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                data: response.data,
                results: response.data.results
            };
        } catch (error) {
            console.error('OpenAI moderation error:', error.message);
            
            if (error.response) {
                throw new Error(`OpenAI API error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error('OpenAI API request failed - no response received');
            } else {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        }
    }

    // check if content is flagged as inappropriate
    async isContentFlagged(text) {
        try {
            const result = await this.moderateContent(text);
            const moderation = result.results[0];
            
            return {
                flagged: moderation.flagged,
                categories: moderation.categories,
                categoryScores: moderation.category_scores,
                severity: this.calculateSeverity(moderation.category_scores)
            };
        } catch (error) {
            console.error('Error checking content flag:', error.message);
            throw error;
        }
    }

    // calculate severity score based on category scores
    calculateSeverity(categoryScores) {
        if (!categoryScores) return 0;
        
        const scores = Object.values(categoryScores);
        if (scores.length === 0) return 0;
        
        // return the highest score as severity
        return Math.max(...scores);
    }

    // get detailed moderation analysis
    async getDetailedAnalysis(text) {
        try {
            const result = await this.moderateContent(text);
            const moderation = result.results[0];
            
            const flaggedCategories = Object.entries(moderation.categories)
                .filter(([_, flagged]) => flagged)
                .map(([category, _]) => category);
            
            const highScoreCategories = Object.entries(moderation.category_scores)
                .filter(([_, score]) => score > 0.7)
                .map(([category, score]) => ({
                    category,
                    score: (score * 100).toFixed(1) + '%'
                }));

            return {
                flagged: moderation.flagged,
                categories: moderation.categories,
                categoryScores: moderation.category_scores,
                flaggedCategories,
                highScoreCategories,
                allScores: moderation.category_scores,
                severity: this.calculateSeverity(moderation.category_scores),
                recommendation: this.getRecommendation(moderation.flagged, this.calculateSeverity(moderation.category_scores))
            };
        } catch (error) {
            console.error('Error getting detailed analysis:', error.message);
            throw error;
        }
    }

    // get moderation recommendation based on results
    getRecommendation(flagged, severity) {
        if (!flagged && severity < 0.5) return 'APPROVE';
        if (flagged || severity > 0.9) return 'REJECT';
        if (severity > 0.7) return 'REVIEW';
        return 'FLAG_FOR_REVIEW';
    }

    // batch moderate multiple texts
    async batchModerate(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('Input must be an array of strings');
        }

        try {
            const result = await this.moderateContent(texts);
            return result.results.map((moderation, index) => ({
                text: texts[index],
                flagged: moderation.flagged,
                categories: moderation.categories,
                categoryScores: moderation.category_scores,
                severity: this.calculateSeverity(moderation.category_scores)
            }));
        } catch (error) {
            console.error('Error in batch moderation:', error.message);
            throw error;
        }
    }

    // test api connection
    async testConnection() {
        try {
            const testText = "This is a test message.";
            await this.moderateContent(testText);
            return true;
        } catch (error) {
            console.error('OpenAI API connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = OpenAIModerationService;
