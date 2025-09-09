# LuckyLink - Interest-Based Social Chat Platform

## Table of Contents
1. [Project Overview](#project-overview)
2. [Demo](#demo)
   - [Friend Chat System](#1-friend-chat-system)
   - [Random Interest-Based Matching](#2-random-interest-based-matching--moderation)
   - [AI Profile Picture Generation](#3-ai-profile-picture-generation)
3. [Features](#features)
   - [Security & Privacy](#security--privacy)
   - [Chat Features](#chat-features)
   - [Media & Content](#media--content)
   - [System Features](#system-features)
   - [Safety Features](#safety-features)
4. [Preview](#preview)
   - [Figure 1: Login Screen](#figure-1-luckylink-login-screen)
   - [Figure 2: Base View](#figure-2-base-view-luckylink)
   - [Figure 3: Friend Chat](#figure-3-luckylink-opening-a-friend-chat)
   - [Figure 4: Random Chat](#figure-4-luckylink-random-chat-view)
   - [Figure 5: Chat History](#figure-5-luckylink-chat-history-view)
   - [Figure 6: Moderation Report](#figure-6-moderation-report-view)
   - [Figure 7: Profile Settings](#figure-7-profile-setting-view)
   - [Figure 8: Friend Settings](#figure-8-friend-setting-view)
   - [Figure 9: Profile Picture](#figure-9-profile-picture-view)
   - [Figure 10: GIFs Option](#figure-10-gifs-option-view)
5. [Setup Guide](#setup-guide)
   - [Prerequisites](#prerequisites)
   - [Environment Variables](#environment-variables)
   - [Installation](#installation)
6. [License](#license)
7. [Acknowledgements](#acknowledgements)
## Project Overview

LuckyLink is a modern real-time chat application that connects users based on shared interests, fostering meaningful connections and expanding social circles. Built with cutting-edge technologies, it combines the spontaneity of random matching with the depth of interest-based connections.

![login-screen](https://github.com/user-attachments/assets/7406f4a2-770d-4a2d-b963-4688be45204f)


### Technology Stack

- **Frontend**: React.js with Tailwind CSS for responsive, modern UI
- **Backend**: Node.js with Express for robust server-side operations
- **Database**: PostgreSQL for persistent data storage
- **Cache & Queue**: Redis for session management and real-time operations
- **Message Broker**: Apache Kafka for event streaming and analytics
- **Cloud Services**: AWS S3 for media storage / AWS EC2 for deployment
- **Real-time**: Socket.io with WebSocket/Polling transport
- **Security**: TLS encryption, JWT authentication, OAuth support (Google/GitHub)
- **AI Integration**: OpenAI DALL-E 3 for image generation, OpenAI Moderation API (omni-moderation-latest)
- **Media**: Giphy API for GIFs and stickers
- **Containerization**: Docker for deployment consistency

## Demo

<div align="center">

### 1. Friend Chat System

https://github.com/user-attachments/assets/174af95a-e91b-405d-8654-85a21ce4f546

### 2. Random Interest-Based Matching + Moderation

https://github.com/user-attachments/assets/4cdae9ba-6df0-46fa-bc4e-93097c8538b4

### 3. AI Profile Picture Generation

https://github.com/user-attachments/assets/9b4e3453-4f18-4911-9197-8551030f6014

</div>

## Features

### Security & Privacy
- **End-to-End Encryption**: Custom Signal Protocol implementation using Web Crypto API with X3DH key agreement and Double Ratchet Algorithm
- **Automatic Key Rotation**: Keys refresh every 100 messages or 5 minutes for enhanced security
- **Server-Side Encryption**: XChaCha20-Poly1305 AEAD encryption for all stored messages
- **Authentication**: JWT tokens with OAuth support (Google/GitHub), TLS enforcement, and rate limiting

### Chat Features
- **Real-Time Messaging**: Instant delivery with read receipts, typing indicators, and message queuing
- **Interest-Based Matching**: Lua script-powered atomic matching based on shared interests with fallback pool
- **Friend System**: Build persistent connections with dedicated chat rooms and encrypted message history. Send and accept friend requests by searching for users by username or connecting through random chat
- **Random Chat**: Enjoy all friend chat features except message persistence. Smart interest-based matching pairs you with compatible users, with a fallback queue to minimize wait times

### Media & Content
- **AI Integration**: DALL-E 3 for profile picture generation and OpenAI Moderation API for content filtering
- **Media Sharing**: Giphy integration for GIFs/stickers and AWS S3 for secure media storage
- **Emoji Support**: Native emoji picker with categorized selection and search functionality

### System Features
- **Real-Time Architecture**: Socket.io with WebSocket support and Redis-backed session management
- **Analytics**: Kafka event streaming for comprehensive user activity tracking
- **Safety**: User reporting, content filtering, skip cooldowns, and automatic session timeouts



## Preview

<div align="center">

### *Figure 1: LuckyLink login screen*  
![login-screen](https://github.com/user-attachments/assets/162a4b49-f11a-4cbe-a31b-3dc236084644)

---

### *Figure 2: Base view LuckyLink*  
![base-view](https://github.com/user-attachments/assets/aa11d8fe-670c-4709-9a64-2065bd615db9)

---

### *Figure 3: LuckyLink opening a friend chat*  
![friend-chat-screen](https://github.com/user-attachments/assets/3f9093e7-8edc-4b9f-9c7e-9b8fe0e9c28a)

---

### *Figure 4: LuckyLink random chat view*  

![random-chat](https://github.com/user-attachments/assets/58a99f55-01a0-4e8a-82fe-1cf83a84401e)

---

### *Figure 5: LuckyLink chat history view*  
![chat-history-view](https://github.com/user-attachments/assets/7510b83d-7d9d-4cd5-8b06-1d2d3f743dd3)

---

### *Figure 6: Moderation report view*  
![moderation-report-screen](https://github.com/user-attachments/assets/d74f2907-590a-4888-b066-7d62044c7911)

---

### *Figure 7: Profile setting view*  
![profile-setting](https://github.com/user-attachments/assets/3c0e4606-dfe2-450a-a280-ac6a919d37d4)

---

### *Figure 8: Friend setting view*  
![friend-setting](https://github.com/user-attachments/assets/ba726440-c682-4910-b5a4-1e843aa348ca)

---

### *Figure 9: Profile picture view*  
![profile-picture-view](https://github.com/user-attachments/assets/c090b033-3f38-4763-b68a-93248a3eea79)

---

### *Figure 10: GIFs option view*  
![gifs-screen](https://github.com/user-attachments/assets/0992a023-7897-4fd5-b06a-a1ec0557ae45)

</div>


## Setup Guide

### Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- Redis Server
- Apache Kafka
- Docker (required for Kafka and Redis)
- AWS Account (for S3)
- OpenAI API Key
- Giphy API Key

### Environment Variables

Create `.env` files in both client and server directories:

#### Server `.env`
```env
# Database (PostgreSQL)
PGUSER=your_database_user
PGHOST=localhost
PGDATABASE=luckylink
PGPASSWORD=your_database_password
PGPORT=5432

# Server Configuration
PORT=5000
NODE_ENV=development
SERVER_URL=https://localhost:5000
CLIENT_URL=http://localhost:3000

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key
SERVER_KEY=your_32_byte_hex_key  # 64 hex characters for message encryption

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKER=localhost:9092

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=luckylink-private-test
AWS_REGION=us-east-2

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Google Services
GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key

# reCAPTCHA
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
GOOGLE_RECAPTCHA_SECRET_KEY=your_google_recaptcha_secret_key



#### Client `.env`
```env
REACT_APP_GIPHY_API_KEY=your_giphy_api_key
REACT_APP_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/luckylink.git
cd luckylink
```

2. **Install dependencies**
```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

3. **Setup Database**
```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE luckylink;
\q
```

4. **Start Services**

**Using Docker Compose (Recommended for Kafka)**
```bash
# Start Kafka using docker-compose
docker-compose up -d
```

**Redis (Standalone Docker)**
```bash
# Pull the latest Redis image
docker pull redis:latest

# Run Redis container
docker run -d --name redis-server -p 6379:6379 redis:latest
```

5. **Generate TLS Certificates** (for development)
```bash
# In server/src/certificates directory
mkcert localhost 127.0.0.1 ::1
```

6. **Start the Application**
```bash
# Start server (from server directory- cd server/src)
node index

# Start client (from client directory- cd client)
npm start
```



## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
## Acknowledgements

<p align="center">
  The development team would like to recognize the contributions of:<br><br>
  John A.<br>
  Jose J.<br>
  Nicholas L.<br>
  Simon D.
</p>
<p align="center">
  Built with ❤️ for connecting people through shared interests
</p>
