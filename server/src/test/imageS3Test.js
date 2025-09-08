const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const OpenAIImageService = require('../services/openaiImageService');
const OpenAIModerationService = require('../services/openaiModeration');
const S3Service = require('../services/s3Service');

/**
 * OpenAI Image Generation + S3 Storage Test Suite
 * 
 * This test:
 * 1. Generates images using OpenAI DALL-E 3
 * 2. Saves them to AWS S3 bucket
 * 3. Retrieves them from S3 to verify storage
 * 
 * Prerequisites:
 * - OPENAI_API_KEY configured in environment
 * - AWS_ACCESS_KEY_ID configured in environment
 * - AWS_SECRET_ACCESS_KEY configured in environment
 * - AWS_REGION configured in environment
 * - AWS_S3_BUCKET configured in environment
 * 
 * Usage:
 * - node imageS3Test.js                    # Run full test suite
 * - node imageS3Test.js --generate          # Generate and upload an image
 * - node imageS3Test.js --test-connection   # Test connections only
 * - node imageS3Test.js --interactive       # Interactive mode
 */

// Initialize services
const imageService = new OpenAIImageService();
const moderationService = new OpenAIModerationService();
const s3Service = new S3Service();

// Test configuration
const testConfig = {
    testUserId: 'test-user-123',
    testDescriptions: [
        'A serene mountain landscape with snow-capped peaks',
        'A friendly cartoon robot assistant',
        'Abstract geometric patterns in vibrant colors',
        'A cozy coffee shop interior with warm lighting'
    ]
};

// Helper functions
function printHeader(title) {
    console.log('\n' + '='.repeat(70));
    console.log(`  ${title}`);
    console.log('='.repeat(70));
}

function printStatus(emoji, message, details = null) {
    console.log(`${emoji} ${message}`);
    if (details) {
        console.log('  Details:', JSON.stringify(details, null, 2));
    }
}

// Test Functions

/**
 * Test service connections
 */
async function testConnections() {
    printHeader('Testing Service Connections');
    
    const results = {
        openai: { image: false, moderation: false },
        aws: { s3: false }
    };

    // Test OpenAI services
    try {
        console.log('\n📡 Testing OpenAI Image Service...');
        if (!imageService.isConfigured()) {
            printStatus('❌', 'OpenAI API key not configured');
        } else {
            results.openai.image = await imageService.testConnection();
            printStatus(results.openai.image ? '✅' : '❌', 
                `OpenAI Image Service: ${results.openai.image ? 'Connected' : 'Failed'}`);
        }

        console.log('\n🛡️ Testing OpenAI Moderation Service...');
        if (!moderationService.isConfigured()) {
            printStatus('❌', 'OpenAI API key not configured for moderation');
        } else {
            results.openai.moderation = await moderationService.testConnection();
            printStatus(results.openai.moderation ? '✅' : '❌', 
                `OpenAI Moderation Service: ${results.openai.moderation ? 'Connected' : 'Failed'}`);
        }
    } catch (error) {
        printStatus('❌', `OpenAI connection test failed: ${error.message}`);
    }

    // Test AWS S3
    try {
        console.log('\n☁️ Testing AWS S3 Service...');
        if (!s3Service.isConfigured()) {
            printStatus('❌', 'AWS credentials not configured');
            console.log('  Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
        } else {
            results.aws.s3 = await s3Service.testConnection();
            printStatus(results.aws.s3 ? '✅' : '❌', 
                `AWS S3 Service: ${results.aws.s3 ? 'Connected' : 'Failed'}`, {
                bucket: s3Service.bucketName,
                region: s3Service.region
            });
        }
    } catch (error) {
        printStatus('❌', `AWS S3 connection test failed: ${error.message}`);
    }

    // Summary
    console.log('\n' + '-'.repeat(70));
    const allConnected = results.openai.image && results.openai.moderation && results.aws.s3;
    printStatus(allConnected ? '✅' : '⚠️', 
        allConnected ? 'All services connected successfully!' : 'Some services are not connected');
    
    return results;
}

/**
 * Generate an image and save to S3
 */
async function generateAndSaveImage(description, userId = null) {
    const actualUserId = userId || testConfig.testUserId;
    
    printHeader('Generating Image and Saving to S3');
    console.log(`📝 Description: "${description}"`);
    console.log(`👤 User ID: ${actualUserId}`);
    
    try {
        // Step 1: Generate image with OpenAI
        console.log('\n🎨 Step 1: Generating image with OpenAI...');
        const imageResult = await imageService.generateWithModeration(description, moderationService);
        
        printStatus('✅', 'Image generated successfully!', {
            url: imageResult.url.substring(0, 100) + '...',
            revisedPrompt: imageResult.revised_prompt
        });

        // Step 2: Upload to S3
        console.log('\n☁️ Step 2: Uploading image to S3...');
        const s3Key = s3Service.generateImageKey(actualUserId, 'generated', 'png');
        
        const uploadResult = await s3Service.uploadImageFromUrl(imageResult.url, s3Key, {
            description: description,
            userId: actualUserId,
            model: imageResult.metadata.model,
            generatedAt: new Date().toISOString()
        });
        
        printStatus('✅', 'Image uploaded to S3!', {
            key: uploadResult.key,
            bucket: uploadResult.bucket,
            location: uploadResult.location
        });

        // Step 3: Generate pre-signed URL for verification
        console.log('\n🔗 Step 3: Generating pre-signed URL...');
        const presignedUrl = await s3Service.getPresignedUrl(s3Key, 3600); // 1 hour expiry
        
        printStatus('✅', 'Pre-signed URL generated!');
        console.log(`\n📋 Access your image at:\n${presignedUrl}\n`);

        // Step 4: Verify by downloading
        console.log('🔍 Step 4: Verifying image in S3...');
        const downloadedBuffer = await s3Service.downloadImage(s3Key);
        
        printStatus('✅', `Image verified in S3! Size: ${downloadedBuffer.length} bytes`);

        // Step 5: Get metadata
        console.log('\n📊 Step 5: Retrieving object metadata...');
        const metadata = await s3Service.getObjectMetadata(s3Key);
        
        printStatus('✅', 'Metadata retrieved:', metadata);

        // Return all results
        return {
            success: true,
            generation: {
                url: imageResult.url,
                revisedPrompt: imageResult.revised_prompt
            },
            s3: {
                key: s3Key,
                bucket: uploadResult.bucket,
                location: uploadResult.location,
                presignedUrl: presignedUrl,
                size: downloadedBuffer.length,
                metadata: metadata
            }
        };

    } catch (error) {
        printStatus('❌', `Error: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Run full test suite
 */
async function runFullTest() {
    printHeader('Full Image Generation + S3 Storage Test');
    
    // Test connections first
    const connections = await testConnections();
    
    if (!connections.openai.image || !connections.aws.s3) {
        printStatus('⚠️', 'Cannot proceed with full test - services not connected');
        return;
    }

    // Generate multiple test images
    console.log('\n' + '='.repeat(70));
    console.log('  Generating Test Images');
    console.log('='.repeat(70));

    const results = [];
    
    for (let i = 0; i < testConfig.testDescriptions.length; i++) {
        const description = testConfig.testDescriptions[i];
        console.log(`\n📸 Test ${i + 1}/${testConfig.testDescriptions.length}`);
        
        const result = await generateAndSaveImage(description);
        results.push(result);
        
        if (result.success) {
            console.log(`✅ Test ${i + 1} completed successfully!`);
            console.log(`   S3 Key: ${result.s3.key}`);
            console.log(`   View at: ${result.s3.presignedUrl.substring(0, 80)}...`);
        } else {
            console.log(`❌ Test ${i + 1} failed: ${result.error}`);
        }
        
        // Add delay between requests to avoid rate limiting
        if (i < testConfig.testDescriptions.length - 1) {
            console.log('\n⏳ Waiting 2 seconds before next generation...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    printHeader('Test Summary');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${(successful / results.length * 100).toFixed(1)}%`);
    
    if (successful > 0) {
        console.log('\n📦 S3 Objects Created:');
        results.filter(r => r.success).forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.s3.key}`);
        });
    }
    
    return results;
}

/**
 * Interactive mode
 */
async function interactiveMode() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (prompt) => new Promise((resolve) => readline.question(prompt, resolve));
    
    printHeader('Interactive Image Generation + S3 Storage');
    
    while (true) {
        console.log('\n📋 Options:');
        console.log('1. Test connections');
        console.log('2. Generate and save a custom image');
        console.log('3. Run full test suite');
        console.log('4. List recent S3 uploads');
        console.log('5. Exit');
        
        const choice = await question('\nEnter choice (1-5): ');
        
        switch (choice.trim()) {
            case '1':
                await testConnections();
                break;
                
            case '2':
                const description = await question('Enter image description: ');
                if (description.trim()) {
                    await generateAndSaveImage(description);
                } else {
                    console.log('❌ Description cannot be empty!');
                }
                break;
                
            case '3':
                await runFullTest();
                break;
                
            case '4':
                console.log('📂 Recent uploads would be listed here (feature to be implemented)');
                break;
                
            case '5':
                console.log('👋 Goodbye!');
                readline.close();
                return;
                
            default:
                console.log('❌ Invalid choice!');
        }
    }
}

/**
 * Cleanup test - delete test images from S3
 */
async function cleanupTestImages() {
    printHeader('Cleanup Test Images from S3');
    
    console.log('⚠️ This will delete all test images from S3');
    console.log('   Pattern: users/test-user-123/generated/*');
    
    // Note: For safety, this is commented out. Uncomment to enable cleanup
    // const testKeys = await s3Service.listObjects(`users/${testConfig.testUserId}/generated/`);
    // for (const key of testKeys) {
    //     await s3Service.deleteObject(key);
    //     console.log(`🗑️ Deleted: ${key}`);
    // }
    
    console.log('ℹ️ Cleanup function is disabled for safety. Uncomment code to enable.');
}

// Main CLI handler
async function main() {
    const args = process.argv.slice(2);
    
    // Check configuration
    console.log('\n🔧 Configuration Status:');
    console.log(`   OpenAI API Key: ${imageService.isConfigured() ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   AWS Credentials: ${s3Service.isConfigured() ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   S3 Bucket: ${s3Service.bucketName}`);
    console.log(`   AWS Region: ${s3Service.region}`);
    
    if (!imageService.isConfigured() || !s3Service.isConfigured()) {
        console.log('\n⚠️ Missing configuration! Please set:');
        if (!imageService.isConfigured()) {
            console.log('   export OPENAI_API_KEY="your-key"');
        }
        if (!s3Service.isConfigured()) {
            console.log('   export AWS_ACCESS_KEY_ID="your-key"');
            console.log('   export AWS_SECRET_ACCESS_KEY="your-secret"');
            console.log('   export AWS_S3_BUCKET="your-bucket"');
            console.log('   export AWS_REGION="your-region"');
        }
        return;
    }
    
    // Handle CLI arguments
    if (args.includes('--test-connection') || args.includes('-t')) {
        await testConnections();
    } else if (args.includes('--generate') || args.includes('-g')) {
        const descIndex = args.findIndex(arg => arg === '--generate' || arg === '-g');
        const description = args.slice(descIndex + 1).join(' ') || testConfig.testDescriptions[0];
        await generateAndSaveImage(description);
    } else if (args.includes('--interactive') || args.includes('-i')) {
        await interactiveMode();
    } else if (args.includes('--cleanup')) {
        await cleanupTestImages();
    } else if (args.includes('--help') || args.includes('-h')) {
        printHeader('Help');
        console.log('\nUsage:');
        console.log('  node imageS3Test.js                     # Run full test suite');
        console.log('  node imageS3Test.js --generate          # Generate and save one image');
        console.log('  node imageS3Test.js --generate "text"   # Generate with custom description');
        console.log('  node imageS3Test.js --test-connection   # Test service connections');
        console.log('  node imageS3Test.js --interactive       # Interactive mode');
        console.log('  node imageS3Test.js --cleanup           # Delete test images from S3');
        console.log('  node imageS3Test.js --help              # Show this help');
    } else {
        // Default: run full test
        await runFullTest();
    }
}

// Run the test
main().catch(error => {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
});