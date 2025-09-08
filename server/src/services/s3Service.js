const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');

// aws s3 service for image storage and management
class S3Service {
    constructor() {
        this.bucketName = process.env.AWS_S3_BUCKET || 'luckylink-private-test';
        this.region = process.env.AWS_REGION || 'us-east-2';
        
        // initialize s3 client
        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.warn('⚠️ AWS credentials not found in environment variables');
        }
    }

    // check if service is properly configured
    isConfigured() {
        return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && this.bucketName);
    }

    // upload image from url to s3
    async uploadImageFromUrl(imageUrl, key, metadata = {}) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            console.log(`Downloading image from URL: ${imageUrl.substring(0, 50)}...`);
            
            // download image from url with proper header handling
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'LuckyLink/1.0'
                },
                // don't transform headers automatically
                transformResponse: [],
                // validate status codes
                validateStatus: function (status) {
                    return status >= 200 && status < 300;
                }
            });

            // convert to buffer
            const imageBuffer = Buffer.from(response.data);
            
            // safely determine content type
            let contentType = 'image/png'; // default fallback
            try {
                if (response.headers && response.headers['content-type']) {
                    const headerValue = response.headers['content-type'];
                    // handle cases where content-type might not be a string
                    contentType = typeof headerValue === 'string' ? headerValue : String(headerValue);
                }
            } catch (headerError) {
                console.warn('Warning: Could not parse content-type header, using default:', headerError.message);
            }
            
            console.log(`Uploading to S3 with key: ${key}`);
            
            // upload to s3
            // ensure all metadata values are strings (aws s3 requirement)
            const stringifiedMetadata = {};
            for (const [key, value] of Object.entries(metadata)) {
                stringifiedMetadata[key] = String(value);
            }

            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: imageBuffer,
                ContentType: contentType,
                Metadata: {
                    ...stringifiedMetadata,
                    originalUrl: imageUrl.substring(0, 500), // store truncated url in metadata
                    uploadedAt: new Date().toISOString()
                }
            };

            const command = new PutObjectCommand(uploadParams);
            const uploadResult = await this.s3Client.send(command);
            
            console.log(`✅ Successfully uploaded to S3: ${key}`);
            
            return {
                success: true,
                bucket: this.bucketName,
                key: key,
                region: this.region,
                etag: uploadResult.ETag,
                location: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
                metadata: uploadParams.Metadata
            };
            
        } catch (error) {
            console.error('Error uploading image to S3:', error.message);
            throw new Error(`Failed to upload image to S3: ${error.message}`);
        }
    }

    // generate pre-signed url for accessing private objects
    async getPresignedUrl(key, expiresIn = 3600) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            console.log(`Generated pre-signed URL for ${key} (expires in ${expiresIn}s)`);
            
            return url;
        } catch (error) {
            console.error('Error generating pre-signed URL:', error.message);
            throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
        }
    }

    // get object metadata
    async getObjectMetadata(key) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const response = await this.s3Client.send(command);
            
            return {
                contentType: response.ContentType,
                contentLength: response.ContentLength,
                lastModified: response.LastModified,
                etag: response.ETag,
                metadata: response.Metadata
            };
        } catch (error) {
            if (error.name === 'NotFound') {
                throw new Error(`Object not found: ${key}`);
            }
            console.error('Error getting object metadata:', error.message);
            throw new Error(`Failed to get object metadata: ${error.message}`);
        }
    }

    // download image from s3
    async downloadImage(key) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const response = await this.s3Client.send(command);
            
            // convert stream to buffer
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            console.log(`✅ Successfully downloaded from S3: ${key} (${buffer.length} bytes)`);
            
            return buffer;
        } catch (error) {
            if (error.name === 'NoSuchKey') {
                throw new Error(`Object not found in S3: ${key}`);
            }
            console.error('Error downloading from S3:', error.message);
            throw new Error(`Failed to download from S3: ${error.message}`);
        }
    }

    // delete object from s3
    async deleteObject(key) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.s3Client.send(command);
            console.log(`✅ Successfully deleted from S3: ${key}`);
            
            return true;
        } catch (error) {
            console.error('Error deleting from S3:', error.message);
            throw new Error(`Failed to delete from S3: ${error.message}`);
        }
    }

    // generate unique s3 key for storing images
    generateImageKey(userId, type = 'generated', extension = 'png') {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 10);
        return `users/${userId}/${type}/${timestamp}-${randomId}.${extension}`;
    }

    // delete all objects under specific prefix (folder)
    async deleteFolder(prefix) {
        if (!this.isConfigured()) {
            throw new Error('S3 service not configured properly');
        }

        try {
            console.log(`Deleting all objects under prefix: ${prefix}`);
            
            // list all objects under the prefix
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix
            });

            const listResponse = await this.s3Client.send(listCommand);
            
            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                console.log(`No objects found under prefix: ${prefix}`);
                return 0;
            }

            // prepare objects for deletion
            const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
            
            console.log(`Found ${objectsToDelete.length} objects to delete`);

            // delete all objects
            const deleteCommand = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: objectsToDelete,
                    Quiet: false
                }
            });

            const deleteResponse = await this.s3Client.send(deleteCommand);
            
            const deletedCount = deleteResponse.Deleted ? deleteResponse.Deleted.length : 0;
            console.log(`✅ Successfully deleted ${deletedCount} objects from S3 under prefix: ${prefix}`);
            
            // log any errors
            if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
                console.error('Some objects failed to delete:', deleteResponse.Errors);
            }
            
            return deletedCount;
        } catch (error) {
            console.error('Error deleting folder from S3:', error.message);
            throw new Error(`Failed to delete folder from S3: ${error.message}`);
        }
    }

    // test s3 connection by attempting to check bucket access
    async testConnection() {
        if (!this.isConfigured()) {
            console.log('S3 service not configured');
            return false;
        }

        try {
            // try to check if we can access the bucket by attempting to get metadata for a non-existent key
            const testKey = `test-connection-${Date.now()}.txt`;
            
            try {
                await this.getObjectMetadata(testKey);
            } catch (error) {
                // we expect this to fail with notfound/nosuchkey, which means we have access
                if (error.message.includes('not found')) {
                    console.log('✅ S3 connection test successful');
                    return true;
                }
                // if it's an access error, we don't have proper permissions
                if (error.message.includes('Access Denied') || error.message.includes('Forbidden')) {
                    console.error('❌ S3 access denied - check your AWS credentials and bucket permissions');
                    return false;
                }
                throw error;
            }
            
            return true;
        } catch (error) {
            console.error('S3 connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = S3Service;