/**
 * indexeddb session storage for e2ee sessions
 * prevents re-initialization and browser crashes
 */

class SessionStorage {
  constructor() {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    this.dbName = 'LuckyLinkE2EE';
    this.dbVersion = 1;
    this.storeName = 'sessions';
    this.db = null;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        // failed to open indexeddb
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // create object store for sessions
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'sessionId' });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveSession(sessionId, sessionData) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        sessionId,
        ...sessionData,
        timestamp: Date.now(),
        version: 1
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadSession(sessionId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          resolve(null);
        };
      });
    } catch (error) {
      return null;
    }
  }

  async deleteSession(sessionId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(sessionId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async clearExpiredSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const cutoff = Date.now() - maxAge;
      const range = IDBKeyRange.upperBound(cutoff);
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        let deletedCount = 0;
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return 0;
    }
  }

  async getAllSessions() {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          resolve([]);
        };
      });
    } catch (error) {
      return [];
    }
  }

  async sessionExists(sessionId) {
    const session = await this.loadSession(sessionId);
    return session !== null;
  }

  // Cleanup method for component unmount
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create singleton instance
const sessionStorage = new SessionStorage();

export default sessionStorage;