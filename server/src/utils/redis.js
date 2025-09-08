const Redis = require('ioredis');

// create redis client for socket management
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// handle redis connection errors
redis.on('error', (error) => {
  // redis connection error
});

redis.on('connect', () => {
  // redis connected successfully
});

// socket management functions
const socketManager = {
  // add socket for user (supports multiple devices/tabs)
  async addUserSocket(userId, socketId) {
    try {
      const key = `user_socket:${userId}`;
      await redis.hset(key, socketId, Date.now().toString());
      await redis.expire(key, 3600); // expire after 1 hour
    } catch (error) {
      // error adding user socket to redis
    }
  },

  // remove socket for user
  async removeUserSocket(userId, socketId) {
    try {
      const key = `user_socket:${userId}`;
      await redis.hdel(key, socketId);
    } catch (error) {
      // error removing user socket from redis
    }
  },

  // get all sockets for a user
  async getUserSockets(userId) {
    try {
      const key = `user_socket:${userId}`;
      const sockets = await redis.hgetall(key);
      return Object.keys(sockets);
    } catch (error) {
      return [];
    }
  },

  // check if user has any active sockets
  async isUserOnline(userId) {
    try {
      const sockets = await this.getUserSockets(userId);
      return sockets.length > 0;
    } catch (error) {
      return false;
    }
  },

  // set user online status (for redis-based status checking)
  async setUserStatus(userId, status) {
    try {
      const key = `user_status:${userId}`;
      await redis.set(key, status, 'EX', 3600);
    } catch (error) {
      // error setting user status in redis
    }
  },

  // get user online status from redis
  async getUserStatus(userId) {
    try {
      const key = `user_status:${userId}`;
      return await redis.get(key);
    } catch (error) {
      return null;
    }
  },

  // set user's last known status (persistent)
  async setLastKnownStatus(userId, status) {
    try {
      const key = `last_known_status:${userId}`;
      await redis.set(key, status, 'EX', 86400); // expire after 24 hours
    } catch (error) {
      // error setting last known status in redis
    }
  },

  // get user's last known status
  async getLastKnownStatus(userId) {
    try {
      const key = `last_known_status:${userId}`;
      return await redis.get(key);
    } catch (error) {
      return null;
    }
  },

  // get effective user status (online status + last known status)
  async getEffectiveUserStatus(userId) {
    try {
      const isOnline = await this.isUserOnline(userId);
      const lastKnownStatus = await this.getLastKnownStatus(userId);
      
      if (!isOnline) {
        return 'offline';
      }
      
      // if user is online but status is 'invisible', show as offline
      if (lastKnownStatus === 'invisible') {
        return 'offline';
      }
      
      return lastKnownStatus || 'online';
    } catch (error) {
      return 'offline';
    }
  },

  // update user status (both redis and last known)
  async updateUserStatus(userId, status) {
    try {
      await this.setUserStatus(userId, status);
      await this.setLastKnownStatus(userId, status);
    } catch (error) {
      // error updating user status in redis
    }
  },

  // generate friend room id (consistent across both users)
  generateFriendRoomId(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort();
    return `room:${sortedIds.join(':')}`;
  },

  // add user to friend room
  async addToFriendRoom(userId1, userId2, socketId) {
    try {
      const roomId = this.generateFriendRoomId(userId1, userId2);
      const key = `room_members:${roomId}`;
      await redis.sadd(key, socketId);
      await redis.expire(key, 3600);
      return roomId;
    } catch (error) {
      return null;
    }
  },

  // remove user from friend room
  async removeFromFriendRoom(userId1, userId2, socketId) {
    try {
      const roomId = this.generateFriendRoomId(userId1, userId2);
      const key = `room_members:${roomId}`;
      await redis.srem(key, socketId);
    } catch (error) {
      // error removing user from friend room in redis
    }
  },

  // get all members in a friend room
  async getRoomMembers(userId1, userId2) {
    try {
      const roomId = this.generateFriendRoomId(userId1, userId2);
      const key = `room_members:${roomId}`;
      return await redis.smembers(key);
    } catch (error) {
      return [];
    }
  },


};

module.exports = { redis, socketManager }; 