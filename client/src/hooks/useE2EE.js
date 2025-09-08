/**
 * react hook for e2ee in random chat
 * handles key exchange, encryption, and decryption
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import e2eeSessionManager from '../crypto/E2EESessionManager';

const useE2EE = (socket, currentUser, isRandomChatActive, matchedRandomUser, currentSessionId) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [e2eeStatus, setE2EEStatus] = useState('inactive');
  const [isE2EEReady, setIsE2EEReady] = useState(false);
  const [e2eeError, setE2EEError] = useState(null);
  const sessionRef = useRef(null);
  const cleanupRef = useRef(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // initialize e2ee session when random chat match is found
  useEffect(() => {
    if (!isRandomChatActive || !matchedRandomUser || !currentSessionId || !socket || !currentUser) {
      return;
    }
    
    const initializeE2EE = async () => {
      try {
        setE2EEStatus('initializing');
        setE2EEError(null);
        
        // determine who initiates key exchange (alphabetically first username)
        const isInitiator = currentUser.username < matchedRandomUser;
        
        // create e2ee session with matched user info
        const session = await e2eeSessionManager.createSession(
          currentSessionId,
          currentUser.username,
          isInitiator,
          matchedRandomUser
        );
        
        sessionRef.current = currentSessionId;
        
        // start key exchange
        setE2EEStatus('key_exchange');
        
        // enhanced synchronization: both users wait, but initiator waits longer
        const baseDelay = isInitiator ? 1000 : 500; // initiator waits 1s, responder waits 0.5s
        
        if (isInitiator) {
          setTimeout(async () => {
            try {
              // double-check session still exists before sending
              if (!e2eeSessionManager.getSession(currentSessionId)) {
                return;
              }
              const publicKeys = await session.getPublicKeys();
              socket.emit('e2ee_key_exchange', {
                sessionId: currentSessionId,
                targetUser: matchedRandomUser,
                message: publicKeys,
                type: 'x3dh_init'
              });
            } catch (error) {
              setE2EEError(error.message);
              setE2EEStatus('error');
            }
          }, baseDelay);
        } else {
          // responder also gets a small delay to ensure full initialization
          setTimeout(() => {
            // responder setup completed, ready for key exchange
          }, baseDelay);
        }
        
      } catch (error) {
        setE2EEError(error.message);
        setE2EEStatus('error');
      }
    };
    
    // enhanced delay to ensure socket and session state are ready
    const timer = setTimeout(initializeE2EE, 200);
    
    return () => {
      clearTimeout(timer);
    };
  }, [isRandomChatActive, matchedRandomUser, currentSessionId, socket, currentUser]);
  
  // periodic check for session ready status (fallback)
  useEffect(() => {
    if (!currentSessionId || e2eeStatus === 'ready' || e2eeStatus === 'error') return;
    
    const checkInterval = setInterval(() => {
      if (e2eeSessionManager.isSessionReady(currentSessionId)) {
        setE2EEStatus('ready');
        setIsE2EEReady(true);
        clearInterval(checkInterval);
      }
    }, 500);
    
    // clean up after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);
    
    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [currentSessionId, e2eeStatus]);
  
  // handle incoming e2ee key exchange messages
  useEffect(() => {
    if (!socket || !currentSessionId) return;
    
    const handleKeyExchange = async (data) => {
      // verify this is for our current session
      if (data.sessionId !== currentSessionId) {
        return;
      }
      
      try {
        await e2eeSessionManager.handleKeyExchange(
          currentSessionId,
          data,
          socket,
          currentUser.username,
          matchedRandomUser
        );
        
        // always check if session is ready after handling key exchange
        // this ensures both initiator and responder update their status
        const checkSessionReady = () => {
          const isReady = e2eeSessionManager.isSessionReady(currentSessionId);
          
          if (isReady) {
            setE2EEStatus('ready');
            setIsE2EEReady(true);
            
            // notify server that e2ee session is ready (for secure connection message)
            socket.emit('e2ee_session_ready', {
              sessionId: currentSessionId
            });
            return true;
          }
          return false;
        };
        
        // check immediately
        if (!checkSessionReady()) {
          // if not ready immediately, check again after a short delay
          // this handles cases where the session becomes ready after sending response
          setTimeout(() => {
            checkSessionReady();
          }, 200);
        }
        
      } catch (error) {
        setE2EEError(error.message);
        setE2EEStatus('error');
      }
    };

    const handleKeyRotation = async (data) => {
      // verify this is for our current session
      if (data.sessionId !== currentSessionId) {
        return;
      }
      
      try {
        await e2eeSessionManager.handleKeyRotation(currentSessionId, data);
      } catch (error) {
        setE2EEError(error.message);
      }
    };
    
    socket.on('e2ee_key_exchange', handleKeyExchange);
    socket.on('e2ee_key_rotation', handleKeyRotation);
    
    return () => {
      socket.off('e2ee_key_exchange', handleKeyExchange);
      socket.off('e2ee_key_rotation', handleKeyRotation);
    };
  }, [socket, currentSessionId, currentUser, matchedRandomUser]);

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  // encrypt message before sending
  const encryptMessage = useCallback(async (plaintext) => {
    if (!currentSessionId || !isE2EEReady) {
      // queue the message to be sent after key exchange
      e2eeSessionManager.queueMessage(currentSessionId, {
        plaintext,
        callback: async () => {
          // this will be called when e2ee is ready
          const encrypted = await e2eeSessionManager.encryptMessage(currentSessionId, plaintext);
          return encrypted;
        }
      });
      
      return null;
    }
    
    try {
      const encrypted = await e2eeSessionManager.encryptMessage(currentSessionId, plaintext);
      return encrypted;
    } catch (error) {
      setE2EEError(error.message);
      return null;
    }
  }, [currentSessionId, isE2EEReady]);
  
  // decrypt received message
  const decryptMessage = useCallback(async (encryptedData, sessionId = null) => {
    // use provided sessionid or fallback to currentsessionid
    const decryptSessionId = sessionId || currentSessionId;
    
    if (!decryptSessionId) {
      return null;
    }
    
    // check if the session is ready
    const sessionReady = e2eeSessionManager.isSessionReady(decryptSessionId);
    
    if (!sessionReady) {
      return null;
    }
    
    try {
      const plaintext = await e2eeSessionManager.decryptMessage(decryptSessionId, encryptedData);
      return plaintext;
    } catch (error) {
      setE2EEError(error.message);
      return null;
    }
  }, [currentSessionId]);

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  // clean up session when chat ends
  useEffect(() => {
    return () => {
      if (sessionRef.current && !cleanupRef.current) {
        cleanupRef.current = true;
        e2eeSessionManager.closeSession(sessionRef.current);
        sessionRef.current = null;
        setIsE2EEReady(false);
        setE2EEStatus('inactive');
      }
    };
  }, []);
  
  // handle session cleanup on skip/end
  const cleanupE2EESession = useCallback(() => {
    if (currentSessionId) {
      e2eeSessionManager.closeSession(currentSessionId);
      sessionRef.current = null;
      setIsE2EEReady(false);
      setE2EEStatus('inactive');
      setE2EEError(null);
      cleanupRef.current = false;
    }
  }, [currentSessionId]);
  
  // ============================================================================
  // KEY ROTATION
  // ============================================================================

  // perform key rotation
  const rotateKeys = useCallback(async () => {
    if (!currentSessionId || !socket) {
      return false;
    }
    
    try {
      const success = await e2eeSessionManager.rotateSessionKeys(currentSessionId, socket);
      return success;
    } catch (error) {
      setE2EEError(error.message);
      return false;
    }
  }, [currentSessionId, socket]);
  
  // check if keys should be rotated
  const shouldRotateKeys = useCallback((messageThreshold = 100) => {
    if (!currentSessionId) return false;
    return e2eeSessionManager.shouldRotateKeys(currentSessionId, messageThreshold);
  }, [currentSessionId]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // expose session info for debugging
  const getSessionInfo = useCallback(() => {
    if (!currentSessionId) return null;
    
    const session = e2eeSessionManager.getSession(currentSessionId);
    if (!session) return null;
    
    return session.getSessionInfo();
  }, [currentSessionId]);
  
  return {
    e2eeStatus,
    isE2EEReady,
    e2eeError,
    encryptMessage,
    decryptMessage,
    cleanupE2EESession,
    rotateKeys,
    shouldRotateKeys,
    getSessionInfo
  };
};

export default useE2EE;