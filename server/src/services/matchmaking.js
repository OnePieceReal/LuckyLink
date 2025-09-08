const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const interestModel = require('../models/interest');
const redis = new Redis(); // defaults to localhost:6379

// cache for allowed interests
let allowedInterestsCache = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// get allowed interests from database with caching
async function getAllowedInterests() {
  const now = Date.now();
  
  // return cached interests if still valid
  if (allowedInterestsCache && now < cacheExpiry) {
    return allowedInterestsCache;
  }
  
  try {
    const interests = await interestModel.getAllInterests();
    const interestNames = interests.map(interest => interest.name);
    
    // update cache
    allowedInterestsCache = interestNames;
    cacheExpiry = now + CACHE_DURATION;
    
    console.log('Fetched interests from database:', interestNames);
    return interestNames;
  } catch (error) {
    console.error('Error fetching interests from database:', error);
    // fallback to environment variable if database fails
    const envInterests = (process.env.ALLOWED_INTERESTS || '').split('|').map(s => s.trim()).filter(Boolean);
    return envInterests.length > 0 ? envInterests : ['fallback'];
  }
}

const FALLBACK_INTEREST = 'fallback';
const ACTIVE_EXPIRY = 300; // 5 minutes

// load lua script
const luaScriptPath = path.join(__dirname, 'matchmaking.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');

// shuffle array for random matching
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// validate and filter user interests
async function validateInterests(interests) {
  const result = [];
  
  if (Array.isArray(interests) && interests.length > 0) {
    const allowedInterests = await getAllowedInterests();
    // filter valid interests (excluding fallback to avoid duplicates)
    const filtered = interests
      .filter(i => allowedInterests.includes(i) && i.toLowerCase() !== FALLBACK_INTEREST.toLowerCase())
      .slice(0, 3);
    
    if (filtered.length > 0) {
      result.push(...filtered);
    }
  }
  
  // always add fallback for maximum matching potential
  result.push(FALLBACK_INTEREST);
  
  return result;
}

// remove user from all interest queues and mark as matched/left
async function removeUserFromQueues(userId, interests, status = 'left') {
  await redis.set(`active:${userId}`, status, 'EX', ACTIVE_EXPIRY);
  
  // remove from all possible interest queues (not just user's interests)
  const allQueueKeys = await redis.keys('queue:*');
  for (const queueKey of allQueueKeys) {
    await redis.lrem(queueKey, 0, userId);
  }
}

// match user with others based on interests
async function matchUser(userId, interests) {
  // enforce whitelist and max 3 interests + always add fallback
  const validatedInterests = await validateInterests(interests);
  console.log(`[MATCHMAKING] Validating interests for ${userId}:`, { original: interests, validated: validatedInterests });

  // deduplication: if already active, don't enqueue again
  const activeStatus = await redis.get(`active:${userId}`);
  if (activeStatus === 'waiting' || activeStatus === 'matched') {
    return { error: 'User is already in queue or matched' };
  }

  // fallback to node.js implementation
  for (const interest of shuffle([...validatedInterests])) {
    let matchId;
    while ((matchId = await redis.lpop(`queue:${interest}`))) {
      if (matchId === userId) continue; // don't match with self
      const lock = await redis.set(`lock:${matchId}`, userId, 'NX', 'PX', 5000);
      if (!lock) continue;
      if (await redis.get(`active:${matchId}`) === 'waiting') {
        await Promise.all([
          removeUserFromQueues(userId, validatedInterests, 'matched'),
          removeUserFromQueues(matchId, validatedInterests, 'matched'),
        ]);
        // only delete lock if you still own it
        const owner = await redis.get(`lock:${matchId}`);
        if (owner === userId) {
          await redis.del(`lock:${matchId}`);
        }
        return { matched: true, with: matchId, matchInterest: interest };
      } else {
        // only delete lock if you still own it
        const owner = await redis.get(`lock:${matchId}`);
        if (owner === userId) {
          await redis.del(`lock:${matchId}`);
        }
      }
    }
  }

  // no match found; enqueue user
  await redis.set(`active:${userId}`, 'waiting', 'EX', ACTIVE_EXPIRY);
  for (const interest of validatedInterests) {
    await redis.rpush(`queue:${interest}`, userId);
  }
  
  // debug: check what's in redis after enqueuing
  console.log(`[LUA] No match found via Lua script, user ${userId} enqueued in Redis`);
  for (const interest of validatedInterests) {
    const queueMembers = await redis.lrange(`queue:${interest}`, 0, -1);
    console.log(`[LUA] queue:${interest} now contains: [${queueMembers.join(', ')}]`);
  }
  const userActiveStatus = await redis.get(`active:${userId}`);
  console.log(`[LUA] active:${userId} status: ${userActiveStatus}`);
  
  return { matched: false };
}

module.exports = {
  matchUser,
  removeUserFromQueues,
  redis,
  luaScript,
  getAllowedInterests,
}; 