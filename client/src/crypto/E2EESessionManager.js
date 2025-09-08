/**
 * e2ee session manager for random chat
 * manages multiple signal protocol sessions per random chat match
 */

import SignalProtocolClient from './SignalProtocol';
import sessionStorage from './SessionStorage';

class E2EESessionManager {
  constructor() {
    // ============================================================================
    // STATE AND CONFIGURATION
    // ============================================================================

    this.sessions = new Map(); // sessionId -> SignalProtocolClient
    this.sessionStates = new Map(); // sessionId -> state
    this.messageQueues = new Map(); // sessionId -> messages[]
    this.keyExchangeCallbacks = new Map(); // sessionId -> callbacks
    this.initializingPromises = new Map(); // sessionId -> Promise (prevent duplicate initialization)
    this.retryCounters = new Map(); // sessionId -> retry count for error handling
    this.decryptionErrors = new Map(); // sessionId -> decryption error count
    this.sessionToChatMapping = new Map(); // sessionId -> { matchedUser, isInitiator }
    this.lastCleanup = 0; // track last cleanup time
    
    // session states
    this.STATES = {
      INITIALIZING: 'initializing',
      KEY_EXCHANGE: 'key_exchange',
      READY: 'ready',
      ERROR: 'error',
      CLOSED: 'closed'
    };
    
    // initialize storage and cleanup expired sessions
    this.initializeStorage();
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initializeStorage() {
    try {
      await sessionStorage.init();
      await sessionStorage.clearExpiredSessions();
    } catch (error) {
      // failed to initialize session storage
    }
  }

  // ============================================================================
  // SESSION MAPPING
  // ============================================================================

  // set session chat mapping
  setSessionChatMapping(sessionId, matchedUser, isInitiator) {
    this.sessionToChatMapping.set(sessionId, { matchedUser, isInitiator });
  }

  // get session chat mapping
  getSessionChatMapping(sessionId) {
    return this.sessionToChatMapping.get(sessionId);
  }

  // ============================================================================
  // SESSION CREATION
  // ============================================================================

  // create a new e2ee session for a random chat match
  async createSession(sessionId, username, isInitiator, matchedUser = null) {
    // store the chat mapping if matchedUser is provided
    if (matchedUser) {
      this.setSessionChatMapping(sessionId, matchedUser, isInitiator);
    }
    
    // prevent duplicate initialization
    if (this.initializingPromises.has(sessionId)) {
      return await this.initializingPromises.get(sessionId);
    }
    
    // check if session already exists and is ready
    if (this.sessions.has(sessionId)) {
      const existingState = this.getSessionState(sessionId);
      if (existingState === this.STATES.READY || existingState === this.STATES.KEY_EXCHANGE) {
        return this.sessions.get(sessionId);
      }
      
      // if session exists but in error/closed state, clean it up first
      await this.closeSession(sessionId);
      
      // add delay after cleanup to ensure race conditions are resolved
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // enhanced initialization with better error handling
    const initPromise = this.initializeSession(sessionId, username, isInitiator);
    this.initializingPromises.set(sessionId, initPromise);
    
    try {
      const signal = await initPromise;
      this.initializingPromises.delete(sessionId);
      
      // verify session was created successfully
      if (!this.sessions.has(sessionId)) {
        throw new Error(`Session ${sessionId} was not properly created`);
      }
      
      return signal;
    } catch (error) {
      this.initializingPromises.delete(sessionId);
      throw error;
    }
  }
  
  async initializeSession(sessionId, username, isInitiator) {
    try {
      // try to load existing session from storage
      const persistedSession = await sessionStorage.loadSession(sessionId);
      
      if (persistedSession && persistedSession.state === this.STATES.READY) {
        // restore session from storage
        const signal = new SignalProtocolClient(username);
        await signal.initialize();
        
        // todo: restore session keys from persisted data
        // for now, we'll mark as needs key exchange
        this.sessions.set(sessionId, signal);
        this.sessionStates.set(sessionId, this.STATES.KEY_EXCHANGE);
        this.messageQueues.set(sessionId, []);
        
        return signal;
      }
      
      // create new session
      const signal = new SignalProtocolClient(username);
      await signal.initialize();
      
      // store session
      this.sessions.set(sessionId, signal);
      this.sessionStates.set(sessionId, this.STATES.INITIALIZING);
      this.messageQueues.set(sessionId, []);
      
      // save to persistent storage
      await this.persistSession(sessionId, {
        username,
        isInitiator,
        state: this.STATES.INITIALIZING
      });
      
      return signal;
    } catch (error) {
      this.setSessionState(sessionId, this.STATES.ERROR);
      throw error;
    }
  }

  // ============================================================================
  // SESSION ACCESS
  // ============================================================================

  // get session by id
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // get session state
  getSessionState(sessionId) {
    return this.sessionStates.get(sessionId) || this.STATES.CLOSED;
  }
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // update session state with enhanced queue processing
  setSessionState(sessionId, state) {
    const previousState = this.getSessionState(sessionId);
    this.sessionStates.set(sessionId, state);
    
    // handle state transitions
    if (state === this.STATES.READY && previousState !== this.STATES.READY) {
      // trigger callbacks
      const callbacks = this.keyExchangeCallbacks.get(sessionId) || [];
      callbacks.forEach(cb => {
        try {
          cb();
        } catch (error) {
          // error in key exchange callback
        }
      });
      this.keyExchangeCallbacks.delete(sessionId);
      
      // process queued messages
      this.processQueuedMessages(sessionId).catch(error => {
        // error processing queued messages
      });
      
      // persist the ready state
      this.persistSession(sessionId, { state: this.STATES.READY }).catch(error => {
        // failed to persist ready state
      });
      
    } else if (state === this.STATES.ERROR) {
      // clear any queued messages on error
      this.clearMessageQueue(sessionId);
      
    } else if (state === this.STATES.CLOSED) {
      // clean up queues on close
      this.clearMessageQueue(sessionId);
    }
  }
  
  /**
   * Start key exchange for a session
   */
  async startKeyExchange(sessionId, socket, partnerId, isInitiator) {
    const signal = this.getSession(sessionId);
    if (!signal) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    this.setSessionState(sessionId, this.STATES.KEY_EXCHANGE);
    
    if (isInitiator) {
      // Send public keys to start X3DH
      const publicKeys = await signal.getPublicKeys();
      socket.emit('e2ee_key_exchange', {
        sessionId,
        targetId: partnerId,
        message: publicKeys,
        type: 'x3dh_init'
      });
    }
    
    return new Promise((resolve) => {
      // Store callback for when key exchange completes
      const callbacks = this.keyExchangeCallbacks.get(sessionId) || [];
      callbacks.push(resolve);
      this.keyExchangeCallbacks.set(sessionId, callbacks);
    });
  }
  
  /**
   * Handle incoming key exchange message with comprehensive error handling
   */
  async handleKeyExchange(sessionId, data, socket, currentUsername, partnerUsername) {
    const maxRetries = 3;
    const keyExchangeTimeout = 15000; // 15 seconds
    const maxWaitTime = 3000; // Maximum 3 seconds to wait for session creation
    
    let signal = this.getSession(sessionId);
    let retryCount = 0;
    const retryDelay = 300; // 300ms between retries
    
    // Enhanced retry logic with exponential backoff
    while (!signal && retryCount < Math.ceil(maxWaitTime / retryDelay)) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      signal = this.getSession(sessionId);
      retryCount++;
    }
    
    if (!signal) {
      this.setSessionState(sessionId, this.STATES.ERROR);
      return;
    }
    
    // Verify session is in a valid state for key exchange
    const currentState = this.getSessionState(sessionId);
    if (currentState === this.STATES.ERROR || currentState === this.STATES.CLOSED) {
      return;
    }
    
    const { message, type, senderId } = data;
    
    try {
      // Set timeout for key exchange operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Key exchange timeout')), keyExchangeTimeout);
      });
      
      const keyExchangeOperation = this.performKeyExchangeStep(sessionId, signal, type, message, socket, senderId);
      
      // Race between operation and timeout
      await Promise.race([keyExchangeOperation, timeoutPromise]);
      
      // Persist successful state changes
      await this.persistSession(sessionId, {
        lastKeyExchange: Date.now(),
        exchangeStep: type
      });
      
    } catch (error) {
      await this.handleKeyExchangeError(sessionId, error, type, maxRetries);
    }
  }
  
  /**
   * Perform individual key exchange step
   */
  async performKeyExchangeStep(sessionId, signal, type, message, socket, senderId) {
    switch (type) {
      case 'x3dh_init':
        const success = await signal.performX3DHKeyAgreement(message, false);
        
        if (success) {
          // Send our keys back with retry logic
          const publicKeys = await signal.getPublicKeys();
          await this.sendKeyExchangeMessageWithRetry(socket, {
            sessionId,
            targetId: senderId,
            message: publicKeys,
            type: 'x3dh_response'
          });
          
          // RESPONDER: Wait for initiator to send their ratchet key first
        } else {
          throw new Error('X3DH key agreement failed');
        }
        break;
        
      case 'x3dh_response':
        const complete = await signal.performX3DHKeyAgreement(message, true);
        
        if (complete) {
          // INITIATOR: Get and send ratchet key immediately
          const ratchetKey = await signal.getRatchetPublicKey();
          await this.sendKeyExchangeMessageWithRetry(socket, {
            sessionId,
            targetId: senderId,
            message: { ratchetPublicKey: ratchetKey },
            type: 'ratchet_init_from_initiator'
          });
          
        } else {
          throw new Error('X3DH key agreement completion failed');
        }
        break;
        
      case 'ratchet_init_from_initiator':
        // RESPONDER: Receive initiator's ratchet key
        if (message.ratchetPublicKey) {
          await signal.initializePartnerRatchet(message.ratchetPublicKey);
          
          // Get responder's ratchet key immediately
          const ratchetKey = await signal.getRatchetPublicKey();
          
          // Send responder's ratchet key back
          await this.sendKeyExchangeMessageWithRetry(socket, {
            sessionId,
            targetId: senderId,
            message: { ratchetPublicKey: ratchetKey },
            type: 'ratchet_init_from_responder'
          });
          
          
          // Mark session as ready immediately after sending ratchet key
          this.setSessionState(sessionId, this.STATES.READY);
          await this.persistSession(sessionId, { state: this.STATES.READY });
          
        } else {
          throw new Error('Invalid ratchet key received from initiator');
        }
        break;
        
      case 'ratchet_init_from_responder':
        // INITIATOR: Receive responder's ratchet key
        if (message.ratchetPublicKey) {
          await signal.initializePartnerRatchet(message.ratchetPublicKey);
          
          // Both sides now have each other's ratchet keys
          this.setSessionState(sessionId, this.STATES.READY);
          await this.persistSession(sessionId, { state: this.STATES.READY });
        } else {
          throw new Error('Invalid ratchet key received from responder');
        }
        break;
        
      case 'exchange_confirmation':
        break;
        
      default:
        break;
    }
  }
  
  /**
   * Send key exchange message with retry logic
   */
  async sendKeyExchangeMessageWithRetry(socket, messageData, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        socket.emit('e2ee_key_exchange', messageData);
        return;
      } catch (error) {
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to send key exchange message after ${maxRetries} attempts`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  /**
   * Handle key exchange errors with retry logic
   */
  async handleKeyExchangeError(sessionId, error, exchangeStep, maxRetries) {
    const retryCount = this.getRetryCount(sessionId) + 1;
    
    
    if (retryCount <= maxRetries && this.isRetriableError(error)) {
      
      this.setRetryCount(sessionId, retryCount);
      
      // Exponential backoff before retry
      const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
      setTimeout(() => {
        // Reset to key exchange state for retry
        this.setSessionState(sessionId, this.STATES.KEY_EXCHANGE);
      }, delay);
      
    } else {
      this.setSessionState(sessionId, this.STATES.ERROR);
      this.clearRetryCount(sessionId);
      
      // Clean up failed session
      setTimeout(() => {
        this.closeSession(sessionId);
      }, 5000);
    }
  }
  
  /**
   * Check if error is retriable
   */
  isRetriableError(error) {
    const retriableErrors = [
      'Key exchange timeout',
      'Network error',
      'Connection lost',
      'Temporary failure'
    ];
    
    return retriableErrors.some(retriableError => 
      error.message && error.message.includes(retriableError)
    );
  }
  
  /**
   * Get retry count for session
   */
  getRetryCount(sessionId) {
    return this.retryCounters?.get(sessionId) || 0;
  }
  
  /**
   * Set retry count for session
   */
  setRetryCount(sessionId, count) {
    if (!this.retryCounters) {
      this.retryCounters = new Map();
    }
    this.retryCounters.set(sessionId, count);
  }
  
  /**
   * Clear retry count for session
   */
  clearRetryCount(sessionId) {
    if (this.retryCounters) {
      this.retryCounters.delete(sessionId);
    }
  }
  
  /**
   * Queue a message if key exchange is not complete with overflow protection
   */
  queueMessage(sessionId, message, callback = null) {
    const maxQueueSize = 50; // Prevent memory issues
    const queue = this.messageQueues.get(sessionId) || [];
    
    // Check for queue overflow
    if (queue.length >= maxQueueSize) {
      queue.shift(); // Remove oldest message
    }
    
    // Add message with metadata
    const queuedMessage = {
      content: message,
      timestamp: Date.now(),
      callback,
      id: this.generateMessageId()
    };
    
    queue.push(queuedMessage);
    this.messageQueues.set(sessionId, queue);
    
    
    // Set timeout for queued messages
    this.scheduleMessageTimeout(sessionId, queuedMessage.id);
    
    return queuedMessage.id;
  }
  
  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Schedule timeout for queued message
   */
  scheduleMessageTimeout(sessionId, messageId) {
    const messageTimeout = 30000; // 30 seconds
    
    setTimeout(() => {
      this.removeQueuedMessage(sessionId, messageId, 'timeout');
    }, messageTimeout);
  }
  
  /**
   * Remove specific queued message
   */
  removeQueuedMessage(sessionId, messageId, reason = 'unknown') {
    const queue = this.messageQueues.get(sessionId) || [];
    const messageIndex = queue.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      const removedMessage = queue.splice(messageIndex, 1)[0];
      this.messageQueues.set(sessionId, queue);
      return removedMessage;
    }
    
    return null;
  }
  
  /**
   * Process queued messages after key exchange with proper error handling
   */
  async processQueuedMessages(sessionId) {
    const queue = this.messageQueues.get(sessionId) || [];
    if (queue.length === 0) return;
    
    
    const signal = this.getSession(sessionId);
    if (!signal) {
      this.clearMessageQueue(sessionId);
      return;
    }
    
    const processedMessages = [];
    const failedMessages = [];
    
    // Process messages in order (FIFO)
    for (let i = 0; i < queue.length; i++) {
      const queuedMessage = queue[i];
      
      try {
        // Check if message hasn't expired
        const messageAge = Date.now() - queuedMessage.timestamp;
        if (messageAge > 60000) { // 1 minute max age
          continue;
        }
        
        
        // Execute the callback if available
        if (queuedMessage.callback) {
          await queuedMessage.callback();
        }
        
        processedMessages.push(queuedMessage.id);
        
        // Add small delay between messages to prevent overwhelming
        if (i < queue.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        failedMessages.push({ id: queuedMessage.id, error: error.message });
        
        // Don't stop processing other messages
      }
    }
    
    // Clear processed messages from queue
    this.clearMessageQueue(sessionId);
    
    
    if (failedMessages.length > 0) {
    }
    
    return {
      processed: processedMessages.length,
      failed: failedMessages.length,
      failures: failedMessages
    };
  }
  
  /**
   * Clear message queue for session
   */
  clearMessageQueue(sessionId) {
    const queue = this.messageQueues.get(sessionId) || [];
    if (queue.length > 0) {
    }
    this.messageQueues.set(sessionId, []);
  }
  
  /**
   * Get queue status for session
   */
  getQueueStatus(sessionId) {
    const queue = this.messageQueues.get(sessionId) || [];
    return {
      count: queue.length,
      oldestMessage: queue.length > 0 ? Date.now() - queue[0].timestamp : 0,
      newestMessage: queue.length > 0 ? Date.now() - queue[queue.length - 1].timestamp : 0
    };
  }
  
  /**
   * Check if session can send messages immediately
   */
  canSendMessage(sessionId) {
    const state = this.getSessionState(sessionId);
    return state === this.STATES.READY;
  }
  
  /**
   * Smart message sending - queue if needed, send immediately if ready
   */
  async sendMessage(sessionId, message, encryptAndSendCallback) {
    if (this.canSendMessage(sessionId)) {
      // Send immediately
      try {
        return await encryptAndSendCallback();
      } catch (error) {
        throw error;
      }
    } else {
      // Queue for later
      const messageId = this.queueMessage(sessionId, message, encryptAndSendCallback);
      return { queued: true, messageId };
    }
  }
  
  /**
   * Encrypt a message for a session with error handling
   */
  async encryptMessage(sessionId, plaintext) {
    try {
      const signal = this.getSession(sessionId);
      if (!signal) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      const state = this.getSessionState(sessionId);
      if (state !== this.STATES.READY) {
        throw new Error(`Session ${sessionId} not ready for encryption (state: ${state})`);
      }
      
      // Add timeout for encryption operation
      const encryptionTimeout = 5000; // 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Encryption timeout')), encryptionTimeout);
      });
      
      const encryptionPromise = signal.encrypt(plaintext);
      const encrypted = await Promise.race([encryptionPromise, timeoutPromise]);
      
      return encrypted;
      
    } catch (error) {
      
      // If encryption fails due to session issues, mark session as error
      if (error.message.includes('not ready') || error.message.includes('not found')) {
        this.setSessionState(sessionId, this.STATES.ERROR);
      }
      
      throw error;
    }
  }
  
  /**
   * Decrypt a message for a session with enhanced error handling
   */
  async decryptMessage(sessionId, encryptedData) {
    try {
      const signal = this.getSession(sessionId);
      if (!signal) {
        return null;
      }
      
      const state = this.getSessionState(sessionId);
      if (state !== this.STATES.READY) {
        return null;
      }
      
      // Add timeout for decryption operation
      const decryptionTimeout = 5000; // 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Decryption timeout')), decryptionTimeout);
      });
      
      const decryptionPromise = signal.decrypt(encryptedData);
      const decrypted = await Promise.race([decryptionPromise, timeoutPromise]);
      
      return decrypted;
      
    } catch (error) {
      
      // Categorize decryption errors
      if (error.message.includes('timeout')) {
      } else if (error.message.includes('invalid') || error.message.includes('corrupt')) {
      } else {
        // If consistent decryption failures, mark session as problematic
        this.handleDecryptionError(sessionId, error);
      }
      
      return null;
    }
  }
  
  /**
   * Handle decryption errors and potential session recovery
   */
  async handleDecryptionError(sessionId, error) {
    const errorCount = this.getDecryptionErrorCount(sessionId) + 1;
    this.setDecryptionErrorCount(sessionId, errorCount);
    
    // If too many decryption errors, mark session as problematic
    if (errorCount >= 5) {
      this.setSessionState(sessionId, this.STATES.ERROR);
      this.clearDecryptionErrorCount(sessionId);
      
      // Schedule session cleanup
      setTimeout(() => {
        this.closeSession(sessionId);
      }, 10000); // 10 seconds delay
    }
  }
  
  /**
   * Get decryption error count for session
   */
  getDecryptionErrorCount(sessionId) {
    if (!this.decryptionErrors) {
      this.decryptionErrors = new Map();
    }
    return this.decryptionErrors.get(sessionId) || 0;
  }
  
  /**
   * Set decryption error count for session
   */
  setDecryptionErrorCount(sessionId, count) {
    if (!this.decryptionErrors) {
      this.decryptionErrors = new Map();
    }
    this.decryptionErrors.set(sessionId, count);
  }
  
  /**
   * Clear decryption error count for session
   */
  clearDecryptionErrorCount(sessionId) {
    if (this.decryptionErrors) {
      this.decryptionErrors.delete(sessionId);
    }
  }
  
  /**
   * Check if a session is ready for E2EE
   */
  isSessionReady(sessionId) {
    return this.getSessionState(sessionId) === this.STATES.READY;
  }
  
  /**
   * Wait for session to be ready
   */
  async waitForSession(sessionId, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.isSessionReady(sessionId)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }
  
  /**
   * Close and clean up a session with enhanced cleanup
   */
  async closeSession(sessionId) {
    
    try {
      // Mark session as closing to prevent new operations
      this.setSessionState(sessionId, this.STATES.CLOSED);
      
      const signal = this.getSession(sessionId);
      if (signal) {
        // Gracefully clear session
        signal.clearSession();
      }
      
      // Clean up all session data with small delay to handle race conditions
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      
      this.sessions.delete(sessionId);
      this.sessionStates.delete(sessionId);
      this.messageQueues.delete(sessionId);
      this.keyExchangeCallbacks.delete(sessionId);
      this.initializingPromises.delete(sessionId);
      this.clearRetryCount(sessionId);
      this.clearDecryptionErrorCount(sessionId);
      this.sessionToChatMapping.delete(sessionId);
      
      // Clear from IndexedDB
      await this.clearPersistedSession(sessionId);
      
    } catch (error) {
      // Force cleanup even if errors occur
      this.sessions.delete(sessionId);
      this.sessionStates.delete(sessionId);
      this.messageQueues.delete(sessionId);
      this.keyExchangeCallbacks.delete(sessionId);
      this.initializingPromises.delete(sessionId);
      this.clearRetryCount(sessionId);
      this.clearDecryptionErrorCount(sessionId);
      this.sessionToChatMapping.delete(sessionId);
    }
  }
  
  /**
   * Close all sessions
   */
  async closeAllSessions() {
    
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
  }
  
  /**
   * Persist session to IndexedDB for recovery
   */
  async persistSession(sessionId, sessionData = {}) {
    try {
      const state = this.getSessionState(sessionId);
      const session = this.getSession(sessionId);
      
      const dataToStore = {
        ...sessionData,
        state,
        sessionInfo: session ? session.getSessionInfo() : null,
        timestamp: Date.now()
      };
      
      await sessionStorage.saveSession(sessionId, dataToStore);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Load session from IndexedDB
   */
  async loadPersistedSession(sessionId) {
    try {
      const persistedData = await sessionStorage.loadSession(sessionId);
      if (!persistedData) {
        return null;
      }
      
      // Check if session is not too old (max 1 hour for security)
      const maxAge = 60 * 60 * 1000; // 1 hour
      if (Date.now() - persistedData.timestamp > maxAge) {
        await this.clearPersistedSession(sessionId);
        return null;
      }
      
      return persistedData;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Clear persisted session from IndexedDB
   */
  async clearPersistedSession(sessionId) {
    try {
      await sessionStorage.deleteSession(sessionId);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Perform key rotation for a session
   */
  async rotateSessionKeys(sessionId, socket) {
    const signal = this.getSession(sessionId);
    if (!signal) {
      throw new Error(`Session ${sessionId} not found for key rotation`);
    }
    
    const sessionInfo = signal.getSessionInfo();
    if (!sessionInfo.canRotateKeys) {
      throw new Error(`Session ${sessionId} cannot rotate keys - missing root key or partner ratchet key`);
    }
    
    
    try {
      // Perform the rotation
      await signal.performKeyRotation();
      
      // Get new ratchet public key
      const newRatchetPublicKey = await signal.getNewRatchetPublicKey();
      
      // Notify partner about key rotation via socket
      if (socket) {
        socket.emit('e2ee_key_rotation', {
          sessionId,
          newRatchetPublicKey,
          type: 'key_rotation_notification'
        });
      }
      
      // Persist the updated session
      await this.persistSession(sessionId, { 
        state: this.STATES.READY,
        keyRotationAt: Date.now()
      });
      
      return true;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Handle partner's key rotation
   */
  async handleKeyRotation(sessionId, data) {
    const signal = this.getSession(sessionId);
    if (!signal) {
      return false;
    }
    
    const { newRatchetPublicKey, type } = data;
    
    try {
      if (type === 'key_rotation_notification') {
        
        // Update partner's ratchet key
        await signal.updatePartnerRatchetKey(newRatchetPublicKey);
        
        // Persist the session with updated partner key
        await this.persistSession(sessionId, {
          state: this.STATES.READY,
          partnerKeyRotationAt: Date.now()
        });
        
        return true;
      }
    } catch (error) {
      return false;
    }
    
    return false;
  }
  
  /**
   * Check if session needs key rotation (based on message count or time)
   */
  shouldRotateKeys(sessionId, messageThreshold = 100, timeThreshold = 300000) { // 5 minutes
    const signal = this.getSession(sessionId);
    if (!signal) return false;
    
    const sessionInfo = signal.getSessionInfo();
    if (!sessionInfo.canRotateKeys) return false;
    
    // Check message count threshold
    if (sessionInfo.messageCounter >= messageThreshold) {
      return true;
    }
    
    // Check time threshold (would need to store session creation time)
    // This could be implemented with session metadata
    
    return false;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const stats = {
      totalSessions: this.sessions.size,
      readySessions: 0,
      pendingSessions: 0,
      errorSessions: 0
    };
    
    for (const [sessionId, state] of this.sessionStates) {
      if (state === this.STATES.READY) stats.readySessions++;
      else if (state === this.STATES.KEY_EXCHANGE) stats.pendingSessions++;
      else if (state === this.STATES.ERROR) stats.errorSessions++;
    }
    
    return stats;
  }
}

// Create singleton instance
const e2eeSessionManager = new E2EESessionManager();

export default e2eeSessionManager;