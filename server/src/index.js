require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const https = require('https');
const tlsConfig = require('./config/tls');
const app = express();
const server = https.createServer(tlsConfig, app);
const userRoutes = require('./routes/userRoutes');
const interestRoutes = require('./routes/interestRoutes');
const userInterestRoutes = require('./routes/userInterestRoutes');
const friendRequestRoutes = require('./routes/friendRequestRoutes');
const friendRoutes = require('./routes/friendRoutes');
const messageRoutes = require('./routes/messageRoutes');
const moderationLogRoutes = require('./routes/moderationLogRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const imageRoutes = require('./routes/imageRoutes');
const interestQueueRoutes = require('./routes/interestQueueRoutes');
const userKeyRoutes = require('./routes/userKeyRoutes');
const serverKeyRoutes = require('./routes/serverKeyRoutes');
const authRoutes = require('./routes/authRoutes');
const matchmakingRoutes = require('./routes/matchmakingRoutes');
const session = require('express-session');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');
const kafkaService = require('./services/kafka');
const { initializeSocket } = require('./socket/socket');
const { securityHeaders, enforceHTTPS, logTLSConnection } = require('./middleware/security');

// Security middleware
app.use(enforceHTTPS);
app.use(securityHeaders);
app.use(logTLSConnection);

// CORS configuration - Allow both HTTP and HTTPS origins for development
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'https://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// User CRUD API
app.use('/api/users', userRoutes);
// Interest CRUD API
app.use('/api/interests', interestRoutes);
// User-Interest CRUD API
app.use('/api/user-interests', userInterestRoutes);
// Friend Request CRUD API
app.use('/api/friend-requests', friendRequestRoutes);
// Friend CRUD API
app.use('/api/friends', friendRoutes);
// Message CRUD API
app.use('/api/messages', messageRoutes);
// Moderation Log CRUD API
app.use('/api/moderation-logs', moderationLogRoutes);
// OpenAI Moderation API
app.use('/api/moderation', moderationRoutes);
// OpenAI Image Generation API
app.use('/api/images', imageRoutes);
// Interest Queue CRUD API
app.use('/api/interest-queues', interestQueueRoutes);
app.use('/api/user-keys', userKeyRoutes);
app.use('/api/server-keys', serverKeyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'LuckyLink API',
    version: '1.0.0',
    description: 'API documentation for LuckyLink real-time chat platform',
  },
  servers: [
    { url: 'https://localhost:5000', description: 'Local HTTPS server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, 'routes/*.js'),
    path.join(__dirname, 'controllers/*.js'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(` HTTPS Server running on port ${PORT}`);
  console.log(` TLS enabled for secure communication`);
});

// Initialize Socket.IO
initializeSocket(server);

kafkaService.startProducer().then(() => console.log('Kafka producer started')).catch(console.error);
