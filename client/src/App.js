import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import AuthModal from './components/AuthModal';
import FriendsPanel from './components/FriendsPanel';
import ChatPanel from './components/ChatPanel';
import UsersPanel from './components/UsersPanel';
import ProfileModal from './components/ProfileModal';
import useE2EE from './hooks/useE2EE';

  // ============================================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================================

// centralized api configuration
const API_BASE_URL = 'https://localhost:5000';
const WS_URL = 'wss://localhost:5000';
const API_ENDPOINTS = {
  // auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  
  // user endpoints  
  USER_SEARCH: `${API_BASE_URL}/api/users/search`,
  USER_STATUS: (userId) => `${API_BASE_URL}/api/users/${userId}/status`,
  USER_INTERESTS: (userId) => `${API_BASE_URL}/api/user-interests/user/${userId}`,
  USER_INTEREST_ADD: (userId, interestId) => `${API_BASE_URL}/api/user-interests/${userId}/${interestId}`,
  USER_INTEREST_REMOVE: (userId, interestId) => `${API_BASE_URL}/api/user-interests/${userId}/${interestId}`,
  
  // friend endpoints
  FRIENDS: (userId) => `${API_BASE_URL}/api/friends/${userId}`,
  FRIEND_REQUESTS: `${API_BASE_URL}/api/friend-requests`,
  
  // message endpoints
  MESSAGES_READ_ALL: `${API_BASE_URL}/api/messages/read-all`,
  MESSAGES_BETWEEN: (user1Id, user2Id) => `${API_BASE_URL}/api/messages/${user1Id}/${user2Id}`,
  
  // interest endpoints
  INTERESTS: `${API_BASE_URL}/api/interests`
};

// ============================================================================
// GLOBAL VARIABLES & UTILITIES
// ============================================================================

// initialize socket.io connection
let socket;

// helper function to generate consistent session ids for random chat
const generateRandomSessionId = (user1, user2) => {
  // sort usernames to ensure consistent session id regardless of who initiates
  const sortedUsers = [user1, user2].sort();
  return `random_${sortedUsers[0]}_${sortedUsers[1]}`;
};

function App() {
  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  // suppress recaptcha background timeout errors immediately on mount
  React.useLayoutEffect(() => {
    // handle unhandled promise rejections from recaptcha
    const handleUnhandledRejection = (event) => {
      // simple check: if it's just "timeout" with no other context, suppress it
      if (event.reason?.message === 'Timeout' || event.reason === 'Timeout' || 
          (event.reason && event.reason.toString() === 'Timeout')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    };

    // also handle window error events to catch them before react
    const handleError = (event) => {
      if (event.message === 'Timeout' || 
          (event.error && event.error.message === 'Timeout')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    };

    // add with capture: true to catch events in capture phase before react
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    window.addEventListener('error', handleError, true);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.removeEventListener('error', handleError, true);
    };
  }, []);

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  // authentication & user state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  
  // typing indicators & ui state
  const [typingUsers, setTypingUsers] = useState(new Set()); // track all typing users
  const [typingTimeouts, setTypingTimeouts] = useState({}); // track timeouts for each user
  const [authError, setAuthError] = useState('');
  const [displayErrorFlag, setErrorFlag] = useState(false);
  
  // random chat state
  const [chatHistory, setChatHistory] = useState([]); // random chat sessions
  const [selectedChatHistory, setSelectedChatHistory] = useState(null);
  const [currentChatSession, setCurrentChatSession] = useState(null); // track current session for history
  const [isRandomChatActive, setIsRandomChatActive] = useState(false);
  const [matchedRandomUser, setMatchedRandomUser] = useState(null);
  const [lastMatchedUser, setLastMatchedUser] = useState(null); // track last matched user to prevent duplicate handling

  // ============================================================================
  // STATE WRAPPER FUNCTIONS
  // ============================================================================

  // wrapper functions to track state changes
  const setIsRandomChatActiveWithLog = (value) => {
    setIsRandomChatActive(value);
  };

  const setMatchedRandomUserWithLog = (value) => {
    setMatchedRandomUser(value);
  };

  // additional random chat state
  const [randomChatMessages, setRandomChatMessages] = useState([]);
  const [isWaitingForMatch, setIsWaitingForMatch] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null); // store server-provided session id
  const [matchedInterests, setMatchedInterests] = useState([]); // store interests that matched users share
  
  // profile & interests state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [userInterestIds, setUserInterestIds] = useState([]); // store interest ids for api calls
  const [userStatuses, setUserStatuses] = useState({});
  const [sentFriendRequests, setSentFriendRequests] = useState([]);

  // ============================================================================
  // E2EE HOOK
  // ============================================================================

  // e2ee hook
  const {
    e2eeStatus,
    isE2EEReady,
    e2eeError,
    encryptMessage,
    decryptMessage,
    cleanupE2EESession,
    rotateKeys,
    shouldRotateKeys,
    getSessionInfo
  } = useE2EE(socket, user, isRandomChatActive, matchedRandomUser, currentSessionId);

  // ============================================================================
  // SOCKET CONNECTION & EVENT HANDLERS
  // ============================================================================

  // initialize socket when user is authenticated
  useEffect(() => {
    if (user && token) {
      socket = io(WS_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        secure: true,
        rejectUnauthorized: false // for development with self-signed certs
      });

      // make socket available globally for chatpanel
      window.socket = socket;

      // socket event listeners
      socket.on('connect', () => {
        // connected to server
      });

      socket.on('disconnect', (reason) => {
        // disconnected from server
      });

      socket.on('reconnect', (attemptNumber) => {
        // reconnected to server after attempts
      });

      socket.on('connect_error', (error) => {
        if (error.message.includes('Authentication error')) {
          // token is invalid, logout user
          handleLogout();
        }
      });

      // handle socket errors
      socket.on('error', (error) => {
        // could show a toast notification here
      });

      // handle new messages from the server
      socket.on('newMessage', (messageData) => {
        const { sender, message, timestamp, isReceived, targetUserId, id } = messageData;
        
        // handle broadcast messages (targetuserid indicates it was broadcasted)
        if (targetUserId && targetUserId !== user.id) {
          return;
        }
        
      setMessages(prev => ({
        ...prev,
        [sender]: [...(prev[sender] || []), {
            id: id || Date.now(), // use server id if available, fallback to timestamp
          sender,
          message,
            isReceived: isReceived || false,
            isRead: false, // new messages are not read yet
            timestamp: new Date(timestamp)
        }]
      }));
        
        // if we're currently in a chat with this sender, emit chat_seen to mark messages as read
        // but only if the tab is currently visible
        if (selectedUser === sender && socket) {
          if (document.visibilityState === 'visible') {
            markFriendMessagesAsRead(sender);
          }
        }
      });

      // handle user status updates with throttling to prevent flicker
      socket.on('userStatusChanged', (data) => {
        const { userId, username, status } = data;
        
        // throttle rapid status updates for the same user to prevent flicker
        setUserStatuses(prev => {
          // only update if the status actually changed
          if (prev[username] !== status) {
            const updated = { ...prev, [username]: status };
            return updated;
          }
          return prev; // no change, return previous state
        });
      });

      // handle friend request events
      socket.on('friendRequestReceived', (data) => {
        // add to friend requests list
        setFriendRequests(prev => [...prev, {
          id: data.id,
          sender: data.sender_username,
          status: data.status,
          created_at: data.created_at
        }]);
      });

      socket.on('friendRequestSent', (data) => {
        // could update ui to show sent requests if needed
      });

      socket.on('friendRequestResponded', (data) => {
        // remove from friend requests and add to friends if accepted
        setFriendRequests(prev => prev.filter(req => req.id !== data.id));
        
        if (data.status === 'accepted') {
          // reload the complete friends list from the database
          loadFriends();
          // remove from sent requests since it's now accepted
          setSentFriendRequests(prev => prev.filter(username => username !== data.sender_username));
          // do not automatically switch to chat - let user select manually
          
          // emit friendrequestaccepted to trigger friend room joining on server
          socket.emit('friendRequestAccepted', { 
            friendId: data.receiver_id // this event is for the sender, so friendid is receiver_id
          });
        }
      });

      socket.on('friendRequestUpdated', (data) => {
        // update the request status in the list
      setFriendRequests(prev => 
          prev.map(req => 
            req.id === data.id ? { ...req, status: data.status } : req
          )
        );
        
        // if accepted, reload friends list
        if (data.status === 'accepted') {
          // reload the complete friends list from the database
          loadFriends();
          // remove from sent requests since it's now accepted
          setSentFriendRequests(prev => prev.filter(username => username !== data.sender_username));
          // do not automatically switch to chat - let user select manually
          // the accepter (receiver) can auto-select, but sender should not
          // only auto-select if this is the accepter, not the original sender
          if (data.sender_id === user.id) {
            // this user accepted the request, so auto-select the new friend
            setSelectedUser(data.sender_username);
          }
          
          // emit friendrequestaccepted to trigger friend room joining on server
          socket.emit('friendRequestAccepted', { 
            friendId: data.sender_id 
          });
          
          // join the new friend room (redundant but ensures compatibility)
          socket.emit('joinFriendRoom', { roomId: `chat:${user.username}:${data.sender_username}` });
        }
      });

      // handle joining friend room
      socket.on('joinFriendRoom', (data) => {
        socket.emit('joinRoom', data.roomId);
      });

      socket.on('friendRequestDeleted', (data) => {
        // remove from friend requests list
        setFriendRequests(prev => prev.filter(req => req.id !== data.id));
      });

      // handle friend request notifications
      socket.on('friendRequestReceived', ({ senderId, senderUsername }) => {
        // load fresh friend requests from api
        loadFriendRequests();
      });

      // handle message read status
      socket.on('messagesRead', (data) => {
        const { messageIds, readBy, readByUsername, readAt } = data;
        
        // update messages in state to show as read
        setMessages(prev => {
          const updatedMessages = { ...prev };
          
          // update all message arrays
          Object.keys(updatedMessages).forEach(username => {
            updatedMessages[username] = updatedMessages[username].map(msg => {
              // for messages sent by current user, mark as read if they're in the read list
              if (msg.sender === user.username && messageIds.includes(msg.id)) {
                return { ...msg, isRead: true };
              }
              return msg;
            });
          });
          
          return updatedMessages;
        });
      });

      // handle friend status changes
      socket.on('friendStatusChanged', ({ userId, status }) => {
        // update friend status in ui
      });

      // handle user joined room
      socket.on('userJoined', ({ userId, username }) => {
        // user joined the chat room
      });

      // handle user left room
      socket.on('userLeft', ({ userId, username }) => {
        // user left the chat room
      });

      // handle message read receipts
      socket.on('messageRead', ({ messageId, readBy, readAt }) => {
        // message read by user
      });

      // handle random chat messages (with e2ee support)
      socket.on('randomMessage', async ({ sender, message, encryptedData, isEncrypted, timestamp, isReceived, sessionId, isSystem }) => {
        let finalMessage = message;
        
        // decrypt message if it's encrypted
        if (isEncrypted && encryptedData && sender !== user.username) {
          try {
            // use the sessionid from the message or fallback to currentsessionid
            const decryptSessionId = sessionId || currentSessionId;
            if (decryptSessionId) {
              finalMessage = await decryptMessage(encryptedData, decryptSessionId);
            } else {
              finalMessage = null;
            }
            
            if (!finalMessage) {
              finalMessage = '[encrypted message - decryption failed]';
            }
          } catch (error) {
            finalMessage = '[encrypted message - decryption failed]';
          }
        }
        
        // prevent duplicate messages by checking if this message already exists
        setRandomChatMessages(prev => {
          const messageExists = prev.some(msg => 
            msg.sender === sender && 
            (msg.message === finalMessage || (isEncrypted && msg.encryptedData)) &&
            Math.abs(new Date(msg.timestamp) - new Date(timestamp)) < 1000 // within 1 second
          );
          
          if (messageExists) {
            return prev;
          }
          
          const newMessages = [...prev, {
            sender: sender,
            message: finalMessage,
            isReceived: isReceived,
            isEncrypted: isEncrypted,
            encryptedData: isEncrypted ? encryptedData : null,
            timestamp: new Date(timestamp),
            isRead: false, // add isread property for read status
            isSystem: isSystem || false // preserve system message flag
          }];
          
          // immediately emit randomchatseen if this is a message from the matched user
          if (isRandomChatActive && matchedRandomUser === sender && socket && user) {
            const randomSessionId = generateRandomSessionId(user.username, matchedRandomUser);
            socket.emit('randomChatSeen', {
              sessionId: randomSessionId,
              matchedUser: matchedRandomUser
            });
          }
          
          return newMessages;
        });
      });

      // handle random chat typing indicators (legacy - now handled by separate useeffect)
      socket.on('randomTypingStart', ({ username }) => {
        // this is now handled by the separate random chat typing effect
      });

      socket.on('randomTypingStop', ({ username }) => {
        // this is now handled by the separate random chat typing effect
      });

      // handle random chat match found
      socket.on('randomMatchFound', ({ matchedUser, sessionId }) => {
        // prevent duplicate handling of the same match
        if (lastMatchedUser === matchedUser && isRandomChatActive && matchedRandomUser === matchedUser) {
          return;
        }
        
        // update last matched user
        setLastMatchedUser(matchedUser);
        
        // check if the matched user is already a friend
        // handle case where friends array might not be loaded yet
        const isAlreadyFriend = friends && friends.length > 0 ? friends.some(friend => friend.username === matchedUser) : false;
        
        if (isAlreadyFriend) {
          // switch to friend chat instead of random chat
          setSelectedUser(matchedUser);
          setIsRandomChatActiveWithLog(false);
          setMatchedRandomUserWithLog(null);
          setIsWaitingForMatch(false);
          
          // load friend messages
          loadMessages(matchedUser);
        } else {
          // start random chat
          setIsRandomChatActiveWithLog(true);
          setMatchedRandomUserWithLog(matchedUser);
          setSelectedUser(null);
          setIsWaitingForMatch(false);
          
          // fix scaling layout issue when random chat becomes active
          setTimeout(() => forceLayoutRecalculation(), 100);
          
          // join random chat room with consistent session id
          const randomSessionId = generateRandomSessionId(user.username, matchedUser);
          if (socket) {
            socket.emit('joinRandomChat', { sessionId, matchedUser: matchedUser });
          }
        }
      });

      // handle random chat ended
      socket.on('randomChatEnded', ({ endedBy }) => {
        // when someone ends the match, this user should be re-queued and waiting for a new match
        setIsRandomChatActive(false); // return to random chat matchmaking interface
        setMatchedRandomUser(null);
        setRandomChatMessages([]);
        setIsWaitingForMatch(true); // wait for new match - user is re-queued
        setSelectedUser(null);
        setLastMatchedUser(null);
        setCurrentSessionId(null); // clear session id
        setMatchedInterests([]); // clear matched interests
        
        // finalize chat history with end reason
        if (currentChatSession) {
          setChatHistory(prev => {
            const existingIndex = prev.findIndex(s => s.id === currentChatSession.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], endReason: 'ended' };
              return updated;
            }
            return prev;
          });
          setCurrentChatSession(null);
        }
        
        // clear localstorage session data
        localStorage.removeItem('currentRandomChatSession');
        localStorage.removeItem('currentRandomChatPartner');
      });

      // handle random user skipped
      socket.on('randomUserSkipped', ({ skippedBy, reason }) => {
        // when someone skips, this user should be re-queued and waiting for a new match
        setIsRandomChatActive(false); // return to random chat matchmaking interface
        setMatchedRandomUser(null);
        setRandomChatMessages([]);
        setIsWaitingForMatch(true); // wait for new match - user is re-queued
        setCurrentSessionId(null); // clear session id
        setMatchedInterests([]); // clear matched interests
        
        // finalize chat history with end reason
        if (currentChatSession) {
          setChatHistory(prev => {
            const existingIndex = prev.findIndex(s => s.id === currentChatSession.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], endReason: 'skipped' };
              return updated;
            }
            return prev;
          });
          setCurrentChatSession(null);
        }
        
        // clear localstorage session data
        localStorage.removeItem('currentRandomChatSession');
        localStorage.removeItem('currentRandomChatPartner');
        // the backend will automatically re-queue this user for a new match
      });

      // handle random match waiting
      socket.on('randomMatchWaiting', ({ message }) => {
        setIsWaitingForMatch(true);
      });

      // handle random user disconnected
      socket.on('randomUserDisconnected', ({ disconnectedUser }) => {
        if (matchedRandomUser === disconnectedUser) {
          setMatchedRandomUser(null);
          setIsWaitingForMatch(true);
          setRandomChatMessages([]);
        }
      });

      // handle partner tab switching notifications
      socket.on('partnerTabSwitch', ({ partnerName, isVisible }) => {
        // check both state and localstorage for persistent session data
        const persistentPartner = localStorage.getItem('currentRandomChatPartner');
        const isValidPartnerSwitch = (isRandomChatActive && matchedRandomUser === partnerName) || 
                                   (persistentPartner === partnerName);
        
        if (isValidPartnerSwitch) {
          if (isVisible) {
            // partner returned to tab
            setRandomChatMessages(prev => [...prev, {
              sender: 'system',
              message: 'Your chat partner is back!',
              timestamp: new Date().toISOString(),
              isSystem: true,
              isRead: true
            }]);
          } else {
            // partner switched away from tab
            setRandomChatMessages(prev => [...prev, {
              sender: 'system', 
              message: 'It looks like your partner switched tabs → they might take a moment to reply.',
              timestamp: new Date().toISOString(),
              isSystem: true,
              isRead: true
            }]);
          }
        }
      });

      // handle server-authoritative matchmaking events
      socket.on('queueJoined', () => {
        setIsWaitingForMatch(true);
      });

      socket.on('queueJoinFailed', ({ reason }) => {
        setIsWaitingForMatch(false);
      });

      socket.on('matchFound', ({ sessionId, partner, interests, systemMessages = [] }) => {
        // filter out fallback interest from display and state
        const publicInterests = interests.filter(interest => interest.toLowerCase() !== 'fallback');
        
        setIsWaitingForMatch(false);
        setIsRandomChatActiveWithLog(true);
        setMatchedRandomUserWithLog(partner);
        setSelectedUser(null);
        
        // fix scaling layout issue when random chat becomes active
        setTimeout(() => forceLayoutRecalculation(), 100);
        
        // don't overwrite user's selected interests - they should persist
        setLastMatchedUser(partner);
        setCurrentSessionId(sessionId); // store the server-provided session id
        setMatchedInterests(interests); // store all matched interests including fallback
        
        // clear any previous chat session when starting new match
        setCurrentChatSession(null);
        
        // store session data in localstorage for persistence during tab switches
        localStorage.setItem('currentRandomChatSession', sessionId);
        localStorage.setItem('currentRandomChatPartner', partner);
        
        // add system messages from server (interest match + civility reminder)
        if (systemMessages.length > 0) {
          setRandomChatMessages(prev => [...prev, ...systemMessages]);
        } else {
          // fallback if no system messages provided
          setRandomChatMessages(prev => [...prev, {
            sender: 'system',
            message: '🎉 You\'ve been matched! Start chatting below.',
            timestamp: new Date().toISOString(),
            isSystem: true,
            isRead: true
          }]);
        }
        
        // join the random chat room
        socket.emit('joinRandomChat', { sessionId, matchedUser: partner });
      });

      socket.on('matchCancelled', () => {
        setIsWaitingForMatch(false);
        setCurrentSessionId(null); // clear session id
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, token]);

  // ============================================================================
  // REACT EFFECTS & LIFECYCLE
  // ============================================================================

  // auto-save chat history when messages change during active random chat
  useEffect(() => {
    if (isRandomChatActive && matchedRandomUser && randomChatMessages.length > 0) {
      updateChatHistory(randomChatMessages, matchedRandomUser);
    }
  }, [isRandomChatActive, matchedRandomUser, randomChatMessages]);

  // typing indicator effect - at top level
  useEffect(() => {
    if (!socket) return;
    
    const handleUserTyping = ({ fromUserId, fromUsername }) => {
      // check if this typing event is for the current chat (friend or random)
      const currentChatPartner = isRandomChatActive ? matchedRandomUser : selectedUser;
      if (currentChatPartner === fromUsername) {
        // add user to typing set
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.add(fromUsername);
          return updated;
        });
        
        // clear existing timeout for this user
        setTypingTimeouts(prev => {
          if (prev[fromUsername]) {
            clearTimeout(prev[fromUsername]);
          }
          return prev;
        });
        
        // set new timeout to auto-clear typing indicator
        const timeoutId = setTimeout(() => {
          setTypingUsers(prev => {
            const updated = new Set(prev);
            updated.delete(fromUsername);
            return updated;
          });
          setTypingTimeouts(prev => {
            const newTimeouts = { ...prev };
            delete newTimeouts[fromUsername];
            return newTimeouts;
          });
        }, 5000);
        
        // store timeout id
        setTypingTimeouts(prev => ({ ...prev, [fromUsername]: timeoutId }));
      }
    };
    
    const handleUserStopTyping = ({ fromUserId, fromUsername }) => {
      // remove user from typing set
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(fromUsername);
        return updated;
      });
      
      // clear timeout for this user
      setTypingTimeouts(prev => {
        if (prev[fromUsername]) {
          clearTimeout(prev[fromUsername]);
          const newTimeouts = { ...prev };
          delete newTimeouts[fromUsername];
          return newTimeouts;
        }
        return prev;
      });
    };
    
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    
    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
      
      // clear all typing timeouts
      setTypingTimeouts(prev => {
        Object.values(prev).forEach(timeoutId => {
          clearTimeout(timeoutId);
        });
        return {};
      });
    };
  }, [selectedUser, socket]);

  // random chat typing indicator effect
  useEffect(() => {
    if (!socket || !isRandomChatActive || !matchedRandomUser) return;
    
    const handleRandomTypingStart = ({ username }) => {
      if (username === matchedRandomUser) {
        // add user to typing set
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.add(username);
          return updated;
        });
        
        // clear existing timeout for this user
        setTypingTimeouts(prev => {
          if (prev[username]) {
            clearTimeout(prev[username]);
          }
          return prev;
        });
        
        // set new timeout to auto-clear typing indicator
        const timeoutId = setTimeout(() => {
          setTypingUsers(prev => {
            const updated = new Set(prev);
            updated.delete(username);
            return updated;
          });
          setTypingTimeouts(prev => {
            const newTimeouts = { ...prev };
            delete newTimeouts[username];
            return newTimeouts;
          });
        }, 3000); // 3 second timeout for random chat
        
        // store the timeout id
        setTypingTimeouts(prev => ({ ...prev, [username]: timeoutId }));
      }
    };
    
    const handleRandomTypingStop = ({ username }) => {
      if (username === matchedRandomUser) {
        // remove user from typing set
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(username);
          return updated;
        });
        
        // clear timeout for this user
        setTypingTimeouts(prev => {
          if (prev[username]) {
            clearTimeout(prev[username]);
            const newTimeouts = { ...prev };
            delete newTimeouts[username];
            return newTimeouts;
          }
          return prev;
        });
      }
    };
    
    socket.on('randomTypingStart', handleRandomTypingStart);
    socket.on('randomTypingStop', handleRandomTypingStop);
    
    return () => {
      socket.off('randomTypingStart', handleRandomTypingStart);
      socket.off('randomTypingStop', handleRandomTypingStop);
      
      // clear all typing timeouts
      setTypingTimeouts(prev => {
        Object.values(prev).forEach(timeoutId => {
          clearTimeout(timeoutId);
        });
        return {};
      });
    };
  }, [socket, isRandomChatActive, matchedRandomUser]);

  // chat seen effect - at top level
  useEffect(() => {
    if (selectedUser && user && socket) {
      // get the user id for the selected user
      fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(selectedUser)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(response => response.json())
        .then(users => {
          const targetUser = users.find(u => u.username === selectedUser);
          if (targetUser) {
            socket.emit('chat_seen', {
              chatId: null, // if you have a chatid, use it here
              friendId: targetUser.id,
            });
          }
        });
    }
  }, [selectedUser, user, socket, token]);

  // messages seen by other effect - at top level
  useEffect(() => {
    if (!socket) return;
    
    const handleMessagesSeen = ({ chatId, friendId, friendUsername }) => {
      // when we receive this event, it means the other user (friendid) has seen our messages
      // so we need to update messages sent by current user to the friendusername
      if (friendUsername) {
        setMessages(prev => {
          const updated = { ...prev };
          if (updated[friendUsername]) {
            updated[friendUsername] = updated[friendUsername].map(msg =>
              msg.sender === user.username ? { ...msg, isRead: true } : msg
            );
          }
          return updated;
        });
      }
    };
    
    socket.on('messages_seen_by_other', handleMessagesSeen);
    return () => socket.off('messages_seen_by_other', handleMessagesSeen);
  }, [user, socket, selectedUser]);

  // auto-mark random chat messages as read when entering random chat
  useEffect(() => {
    if (isRandomChatActive && matchedRandomUser && socket && user) {
      // only emit randomchatchatseen if there are actually unread messages to mark
      const hasUnreadMessages = randomChatMessages.some(msg => 
        msg.sender === matchedRandomUser && !msg.isRead
      );
      
              if (hasUnreadMessages && document.visibilityState === 'visible') {
          const randomSessionId = generateRandomSessionId(user.username, matchedRandomUser);
          socket.emit('randomChatSeen', {
            sessionId: randomSessionId,
            matchedUser: matchedRandomUser
          });
        }
    }
  }, [isRandomChatActive, matchedRandomUser, socket, user, randomChatMessages]);

  // auto-mark new messages as read when received in active random chat (only when tab is visible)
  useEffect(() => {
    if (isRandomChatActive && matchedRandomUser && socket && user && randomChatMessages.length > 0) {
      // only mark as read if the tab is visible (user is actually viewing the chat)
      if (document.visibilityState === 'visible') {
        // check if there are any unread messages from the matched user
        const hasUnreadMessages = randomChatMessages.some(msg => 
          msg.sender === matchedRandomUser && !msg.isRead
        );
        
        if (hasUnreadMessages) {
          const randomSessionId = generateRandomSessionId(user.username, matchedRandomUser);
          socket.emit('randomChatSeen', {
            sessionId: randomSessionId,
            matchedUser: matchedRandomUser
          });
        }
      }
    }
  }, [isRandomChatActive, matchedRandomUser, socket, user, randomChatMessages]);

  // monitor random chat messages structure (reduced logging)
  useEffect(() => {
    if (isRandomChatActive && randomChatMessages.length > 0) {
      // only log when there are unread messages to reduce spam
      const unreadCount = randomChatMessages.filter(msg => !msg.isRead).length;
      if (unreadCount > 0) {
        // unread messages detected
      }
    }
  }, [isRandomChatActive, randomChatMessages]);

  // read status monitor (simplified)
  useEffect(() => {
    if (isRandomChatActive && randomChatMessages.length > 0) {
      const unreadCount = randomChatMessages.filter(msg => !msg.isRead).length;
      if (unreadCount > 0) {
        // unread messages in random chat
      }
    }
  }, [isRandomChatActive, randomChatMessages]);

  // test function to manually trigger read status (for debugging)
  const testReadStatus = () => {
    if (isRandomChatActive && matchedRandomUser && socket) {
      const randomSessionId = generateRandomSessionId(user.username, matchedRandomUser);
      socket.emit('randomChatSeen', {
        sessionId: randomSessionId,
        matchedUser: matchedRandomUser
      });
    }
  };

  // random messages seen by other effect
  useEffect(() => {
    if (!socket) return;
    
    const handleRandomMessagesSeen = ({ sessionId, matchedUser, matchedUserId }) => {
      // when we receive this event, it means the other user (matcheduser) has seen our messages in random chat
      // so we need to update messages sent by current user in the random chat
      if (matchedUser && isRandomChatActive && matchedRandomUser === matchedUser) {
        setRandomChatMessages(prev => {
          const updated = prev.map(msg =>
            msg.sender === user.username ? { ...msg, isRead: true } : msg
          );
          return updated;
        });
      }
    };
    
    socket.on('randomMessagesSeenByOther', handleRandomMessagesSeen);
    return () => socket.off('randomMessagesSeenByOther', handleRandomMessagesSeen);
  }, [user, socket, isRandomChatActive, matchedRandomUser]); // removed randomchatmessages from dependencies to prevent infinite loop

  // auto-mark messages as read when selected user changes and messages are loaded (only if tab is visible)
  useEffect(() => {
    if (selectedUser && socket && messages[selectedUser] && messages[selectedUser].length > 0) {
      // only mark as read if the tab is currently visible
      if (document.visibilityState === 'hidden') {
        return;
      }
      
      // check if there are any unread messages from the selected user
      const hasUnreadMessages = messages[selectedUser].some(msg => 
        msg.sender !== user.username && !msg.isRead
      );
      
      if (hasUnreadMessages) {
        markFriendMessagesAsRead(selectedUser);
      }
    }
  }, [selectedUser, messages, socket, user, token]);

  // handle tab visibility changes for marking messages as read
  useEffect(() => {
    const handleTabVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedUser && !isRandomChatActive && socket) {
        // check if there are unread messages from the currently selected friend
        if (messages[selectedUser]) {
          const hasUnreadMessages = messages[selectedUser].some(msg => 
            msg.sender !== user.username && !msg.isRead
          );
          
          if (hasUnreadMessages) {
            setTimeout(() => {
              markFriendMessagesAsRead(selectedUser);
            }, 100);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleTabVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleTabVisibilityChange);
  }, [selectedUser, messages, socket, user, isRandomChatActive]);

  // ============================================================================
  // UTILITY FUNCTIONS & HELPERS
  // ============================================================================

  // helper function to count unread messages for a specific friend
  const getUnreadMessageCount = (friendUsername) => {
    if (!messages[friendUsername] || !user) {
      return 0;
    }
    
    // count messages that are:
    // 1. from the friend (not from current user)
    // 2. not read (isread = false)
    return messages[friendUsername].filter(msg => 
      msg.sender !== user.username && !msg.isRead
    ).length;
  };

  // force layout recalculation when chat becomes active (fixes scaling issue)
  const forceLayoutRecalculation = () => {
    // force immediate reflow and resize
    requestAnimationFrame(() => {
      // force browser to recalculate layout
      window.dispatchEvent(new Event('resize'));
      
      // additional reflow trigger
      requestAnimationFrame(() => {
        const body = document.body;
        const currentHeight = body.style.height;
        body.style.height = '100vh';
        // eslint-disable-next-line no-unused-expressions
        body.offsetHeight;
        body.style.height = currentHeight;
      });
    });
  };

  // ============================================================================
  // MESSAGE HANDLING & READ STATUS
  // ============================================================================

  // function to mark friend messages as read
  const markFriendMessagesAsRead = async (friendUsername) => {
    if (!socket || !friendUsername) return;
    
    try {
      // get the user id for the friend
      const response = await fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(friendUsername)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        const targetUser = users.find(u => u.username === friendUsername);
        if (targetUser) {
          // emit chat_seen event to mark messages as read
          socket.emit('chat_seen', {
            chatId: null,
            friendId: targetUser.id,
          });
          
          // update the ui immediately
          setMessages(prev => {
            const updated = { ...prev };
            if (updated[friendUsername]) {
              updated[friendUsername] = updated[friendUsername].map(msg =>
                msg.sender !== user.username ? { ...msg, isRead: true } : msg
              );
            }
            return updated;
          });
        }
      }
    } catch (error) {
      // error marking friend messages as read
    }
  };

  // ============================================================================
  // AUTHENTICATION & USER MANAGEMENT
  // ============================================================================

  const handleError = () => {
    setErrorFlag(prev => !prev);
  };

  const handleLogin = async (formData) => {
    try {
      setAuthError('');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          recaptchaToken: formData.recaptchaToken
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // store token and user data
      localStorage.setItem('token', data.token);
      setToken(data.token);
      
      // fetch complete user data with profile picture
      fetch('https://localhost:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        },
      })
      .then(res => res.json())
      .then(userData => {
        if (userData.id) {
          setUser(userData);
          // user logged in with profile
        } else {
          setUser(data.user);
        }
      })
      .catch(() => {
        setUser(data.user);
      });
      
      setAuthError('');
    } catch (error) {
      // login error
      if (error.name === 'AbortError') {
        setAuthError('Login request timed out. Please try again.');
      } else {
        setAuthError(error.message);
      }
      if (!displayErrorFlag) handleError();
    }
  };

  const handleRegister = async (formData) => {
    try {
      setAuthError('');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          recaptchaToken: formData.recaptchaToken
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // store token and user data
      localStorage.setItem('token', data.token);
      setToken(data.token);
      
      // fetch complete user data with profile picture
      fetch('https://localhost:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        },
      })
      .then(res => res.json())
      .then(userData => {
        if (userData.id) {
          setUser(userData);
          // user logged in with profile
        } else {
          setUser(data.user);
        }
      })
      .catch(() => {
        setUser(data.user);
      });
      
      setAuthError('');
    } catch (error) {
      // registration error
      if (error.name === 'AbortError') {
        setAuthError('Registration request timed out. Please try again.');
      } else {
        setAuthError(error.message);
      }
      if (!displayErrorFlag) handleError();
    }
  };

  // ============================================================================
  // INTERESTS & PROFILE MANAGEMENT
  // ============================================================================

  // load user interests from database
  const loadUserInterests = async () => {
    if (!user?.id || !token) return;
    
    try {
      // loading user interests for user
      const response = await fetch(API_ENDPOINTS.USER_INTERESTS(user.id), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const interests = await response.json();
        // loaded user interests
        
        // extract interest names and ids
        const interestNames = interests.map(interest => interest.name);
        const interestIds = interests.map(interest => interest.id);
        
        setSelectedInterests(interestNames);
        setUserInterestIds(interestIds);
      } else {
        // failed to load user interests
        setSelectedInterests([]);
        setUserInterestIds([]);
      }
    } catch (error) {
      // error loading user interests
      setSelectedInterests([]);
      setUserInterestIds([]);
    }
  };

  // add interest via api
  const handleAddInterest = async (interestName) => {
    if (!user?.id || !token) return;
    
    try {
      // first get the interest id by name
      const interestsResponse = await fetch(API_ENDPOINTS.INTERESTS, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!interestsResponse.ok) {
        // failed to fetch interests
        return;
      }
      
      const allInterests = await interestsResponse.json();
      const interest = allInterests.find(i => i.name === interestName);
      
      if (!interest) {
        // interest not found
        return;
      }
      
      // add the interest to user
      const response = await fetch(API_ENDPOINTS.USER_INTEREST_ADD(user.id, interest.id), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // added interest
        // update local state
        setSelectedInterests(prev => [...prev, interestName]);
        setUserInterestIds(prev => [...prev, interest.id]);
      } else {
        // failed to add interest
      }
    } catch (error) {
      // error adding interest
    }
  };

  // remove interest via api
  const handleRemoveInterest = async (interestName) => {
    if (!user?.id || !token) return;
    
    try {
      // first get the interest id by name
      const interestsResponse = await fetch(API_ENDPOINTS.INTERESTS, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!interestsResponse.ok) {
        // failed to fetch interests
        return;
      }
      
      const allInterests = await interestsResponse.json();
      const interest = allInterests.find(i => i.name === interestName);
      
      if (!interest) {
        // interest not found
        return;
      }
      
      // remove the interest from user
      const response = await fetch(API_ENDPOINTS.USER_INTEREST_ADD(user.id, interest.id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // removed interest
        // update local state
        setSelectedInterests(prev => prev.filter(i => i !== interestName));
        setUserInterestIds(prev => {
          const index = selectedInterests.indexOf(interestName);
          if (index > -1) {
            return prev.filter((_, i) => i !== index);
          }
          return prev;
        });
      } else {
        // failed to remove interest
      }
    } catch (error) {
      // error removing interest
    }
  };

  // handle interest toggle (add/remove)
  const handleInterestToggle = (interestName) => {
    if (selectedInterests.includes(interestName)) {
      handleRemoveInterest(interestName);
    } else {
      if (selectedInterests.length < 3) {
        handleAddInterest(interestName);
      }
    }
  };

  const handleLogout = async () => {
    try {
      // call logout api endpoint
      if (token) {
        await fetch('https://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      // logout api error
      // continue with local cleanup even if api call fails
    }
    
    // clean up local state
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSelectedUser(null);
    setMessages({});
    setFriendRequests([]);
    setFriends([]);
    setSelectedInterests([]);
    setUserInterestIds([]);
    if (socket) {
      socket.disconnect();
    }
  };

  // ============================================================================
  // FRIEND MANAGEMENT & CHAT SELECTION
  // ============================================================================

  // handle user selection and room joining
  const handleUserSelect = async (username) => {
    // if we're in random chat, end it first properly
    if (isRandomChatActive && matchedRandomUser) {
      await handleEndRandomChat();
    } else if (isRandomChatActive) {
      // if in random chat but no matched user, just clear state
      setIsRandomChatActiveWithLog(false);
      setMatchedRandomUserWithLog(null);
      setRandomChatMessages([]);
      setLastMatchedUser(null);
      setMatchedInterests([]);
    } else if (isWaitingForMatch) {
      // if waiting for match, cancel matchmaking properly
      if (socket) {
        socket.emit('cancelMatchmaking');
      }
      setIsWaitingForMatch(false);
    }
    
    setSelectedUser(username);
    
    // fix scaling layout issue when chat becomes active
    setTimeout(() => forceLayoutRecalculation(), 100);
    
    // load messages for the selected user and then mark as read
    loadMessages(username).then(() => {
      // mark messages as read after loading
      if (username && socket) {
        // first get the user id for the selected user
        fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(users => {
          const targetUser = users.find(u => u.username === username);
          if (targetUser) {
            // emit chat_seen event to mark messages as read
            socket.emit('chat_seen', {
              chatId: null,
              friendId: targetUser.id,
            });
            
            // mark messages as read via socket.io (legacy)
            socket.emit('markMessagesAsRead', { withUserId: targetUser.id });
            
            // also mark as read via rest api for persistence
            fetch(API_ENDPOINTS.MESSAGES_READ_ALL, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                receiver_id: user.id,
                sender_id: targetUser.id
              })
            })
            .then(response => {
              if (response.ok) {
                // messages marked as read via rest api
                // update the ui immediately after marking as read
                setMessages(prev => {
                  const updated = { ...prev };
                  if (updated[username]) {
                    updated[username] = updated[username].map(msg =>
                      msg.sender !== user.username ? { ...msg, isRead: true } : msg
                    );
                  }
                  return updated;
                });
              }
            })
            .catch(error => {
              // error marking messages as read
            });
          }
        })
        .catch(error => {
          // error finding user for read status
        });
      }
    });
  };

  const sendFriendRequest = async (recipient) => {
    if (!user || !recipient || recipient === user.username || 
        friendRequests.find(req => req.sender === recipient) || 
        friends.includes(recipient) ||
        sentFriendRequests.includes(recipient)) {
      // friend request validation failed
      return;
    }

    try {
      // first, get the recipient's user id from their username
      const searchResponse = await fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(recipient)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error('Failed to search for user');
      }
      
      const searchResults = await searchResponse.json();
      
      const recipientUser = searchResults.find(u => u.username === recipient);
      
      if (!recipientUser) {
        throw new Error('User not found');
      }
      
      // now send the friend request with the correct user id
      const requestResponse = await fetch(API_ENDPOINTS.FRIEND_REQUESTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sender_id: user.id,
          receiver_id: recipientUser.id
        }),
      });
      
      if (!requestResponse.ok) {
        const errorData = await requestResponse.json();
        throw new Error(errorData.error || 'Failed to send friend request');
      }
      
      const requestData = await requestResponse.json();
      
      // add to sent requests list
      setSentFriendRequests(prev => [...prev, recipient]);
    } catch (error) {
      // error sending friend request
    }
  };

  const respondToFriendRequest = async (sender, responseStatus) => {
    // find the request from the friendrequests array
    const request = friendRequests.find(req => req.sender === sender);
    if (!request) {
      return;
    }

    try {
      // send via api for persistence and real-time delivery
      const apiResponse = await fetch(API_ENDPOINTS.FRIEND_REQUESTS, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: request.id,
          status: responseStatus,
          receiver_id: user.id
        }),
      });
      
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'Failed to respond to friend request');
      }
      
      // if accepted, reload friends list to ensure both users are updated
      if (responseStatus === 'accepted') {
        // small delay to ensure backend has processed the request
        setTimeout(() => {
          loadFriends();
        }, 100);
      }
    } catch (error) {
      // error responding to friend request
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim() || !selectedUser) return;
    
    const newMessage = {
      sender: user.username,
      message: message.trim(),
      timestamp: new Date(),
      isRead: false
    };

    // add message to local state immediately
    setMessages(prev => ({
      ...prev,
      [selectedUser]: [...(prev[selectedUser] || []), newMessage]
    }));

    // send message via socket for friend chat
    if (socket) {
      // get the user id for the selected user
      try {
        const response = await fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(selectedUser)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const users = await response.json();
          const targetUser = users.find(u => u.username === selectedUser);
          
          if (targetUser) {
            socket.emit('sendMessage', {
              receiverId: targetUser.id,
              message: message.trim()
            });
          } else {
            // target user not found
          }
        }
      } catch (error) {
        // error sending message
      }
    }
  };

  const handleTypingStart = () => {
    if (!socket) return;
    
    const targetUser = isRandomChatActive ? matchedRandomUser : selectedUser;
    if (!targetUser) return;
    
    if (isRandomChatActive) {
      // random chat typing - use server-generated session id
      if (currentSessionId) {
        socket.emit('randomTypingStart', {
          sessionId: currentSessionId
        });
      } else {
        // no current session id available for typing indicator
      }
    } else {
      // friend chat typing - get the user id for the selected user
      fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(targetUser)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(response => response.json())
        .then(users => {
          const targetUserObj = users.find(u => u.username === targetUser);
          if (targetUserObj) {
            socket.emit('typingStart', {
              receiverId: targetUserObj.id
            });
          }
        });
    }
  };

  const handleTypingStop = () => {
    if (!socket) return;
    
    const targetUser = isRandomChatActive ? matchedRandomUser : selectedUser;
    if (!targetUser) return;
    
    if (isRandomChatActive) {
      // random chat typing stop - use server-generated session id
      if (currentSessionId) {
        socket.emit('randomTypingStop', {
          sessionId: currentSessionId
        });
      } else {
        // no current session id available for typing indicator
      }
    } else {
      // friend chat typing stop - get the user id for the selected user
      fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(targetUser)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(response => response.json())
        .then(users => {
          const targetUserObj = users.find(u => u.username === targetUser);
          if (targetUserObj) {
            socket.emit('typingStop', {
              receiverId: targetUserObj.id
            });
          }
        });
    }
  };

  // function to save/update chat history in real-time
  const updateChatHistory = (messages, partnerName) => {
    if (!partnerName || !user) return;
    
    const userMessages = messages.filter(msg => msg.sender === user.username);
    const partnerMessages = messages.filter(msg => msg.sender !== user.username && !msg.isSystem);
    
    // only save if both users have participated
    if (userMessages.length > 0 && partnerMessages.length > 0) {
      const sessionId = currentChatSession?.id || Date.now().toString();
      const lastNonSystemMessage = messages.filter(msg => !msg.isSystem).slice(-1)[0];
      
      const chatSession = {
        id: sessionId,
        username: partnerName,
        messages: messages.filter(msg => !msg.isSystem), // exclude system messages
        timestamp: new Date().toISOString(),
        lastMessage: lastNonSystemMessage?.message || 'Chat in progress...',
        endReason: 'ongoing'
      };
      
      // update existing session or create new one
      setChatHistory(prev => {
        const existingIndex = prev.findIndex(s => s.id === sessionId);
        if (existingIndex >= 0) {
          // update existing session
          const updated = [...prev];
          updated[existingIndex] = chatSession;
          return updated;
        } else {
          // add new session at the beginning
          return [chatSession, ...prev.slice(0, 9)]; // keep only last 10
        }
      });
      
      // track current session
      if (!currentChatSession) {
        setCurrentChatSession({ id: sessionId, partner: partnerName });
      }
    }
  };

  // ============================================================================
  // RANDOM CHAT & MATCHMAKING
  // ============================================================================

  const handleSelectChatHistory = (sessionId) => {
    // find the chat session by id
    const session = chatHistory.find(s => s.id === sessionId);
    setSelectedChatHistory(session);

    // selected chat history session
  };

  const handleStartRandomChat = async (interests) => {
    try {
      // clear any existing session id when starting new match
      setCurrentSessionId(null);
      
      // use server-authoritative matchmaking
      if (socket) {
        socket.emit('enqueueForRandom', { interests });
      } else {
        throw new Error('Socket connection not available');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRandomChatMessage = async (message) => {
    if (!message.trim() || !matchedRandomUser) return;
    
    // check if keys should be rotated before sending message
    if (isE2EEReady && shouldRotateKeys) {
      const needsRotation = shouldRotateKeys(50); // rotate after 50 messages
      if (needsRotation) {
        try {
          await rotateKeys();
        } catch (error) {
          // continue sending message even if rotation fails
        }
      }
    }
    
    let messageToSend = message.trim();
    let encryptedData = null;
    let isEncrypted = false;
    
    // encrypt message if e2ee is ready
    if (isE2EEReady) {
      try {
        encryptedData = await encryptMessage(messageToSend);
        if (encryptedData) {
          isEncrypted = true;
        }
      } catch (error) {
        // encryption failed, sending as plaintext
      }
    }
    
    const newMessage = {
      sender: user.username,
      message: messageToSend,
      isReceived: false,
      isEncrypted: isEncrypted,
      encryptedData: isEncrypted ? encryptedData : null,
      timestamp: new Date(),
      isRead: false
    };

    setRandomChatMessages(prev => [...prev, newMessage]);
    
    // send message via socket for random chat
    if (socket && currentSessionId) {
      socket.emit('sendRandomMessage', {
        message: isEncrypted ? null : messageToSend, // don't send plaintext if encrypted
        encryptedData: isEncrypted ? encryptedData : null,
        isEncrypted: isEncrypted,
        sessionId: currentSessionId
      });
    }
  };

  const handleAddFriendFromRandom = (username) => {
    sendFriendRequest(username);
    // could show a success message here
  };

  const handleSkipRandomUser = async () => {
    if (!matchedRandomUser || !currentSessionId) {
      return;
    }

    try {
      // clean up e2ee session first
      cleanupE2EESession();
      
      // use server-authoritative skip with stored session id
      if (socket) {
        socket.emit('skipMatch', { sessionId: currentSessionId });
      }
      
      // immediately return skipper to matchmaking page with waiting status
      setIsRandomChatActive(false); // return to matchmaking interface
      setMatchedRandomUser(null);
      setRandomChatMessages([]);
      setIsWaitingForMatch(true); // show "waiting for match" status
      setCurrentSessionId(null); // clear session id
      
    } catch (error) {
      throw error;
    }
  };

  const handleEndRandomChat = async () => {
    if (!matchedRandomUser || !currentSessionId) {
      return;
    }

    try {
      // clean up e2ee session first
      cleanupE2EESession();
      
      // use server-authoritative end match with stored session id
      if (socket) {
        socket.emit('endMatch', { sessionId: currentSessionId });
      }
      
      // return to matchmaking page (don't re-queue this user)
      setIsRandomChatActiveWithLog(false);
      setMatchedRandomUserWithLog(null);
      setRandomChatMessages([]);
      setSelectedUser(null);
      setIsWaitingForMatch(false);
      setLastMatchedUser(null); // reset last matched user
      setCurrentSessionId(null); // clear session id
      setMatchedInterests([]); // clear matched interests
      
    } catch (error) {
      // error ending random chat
    }
  };

  const handleCancelMatchmaking = () => {
    setIsWaitingForMatch(false);
    // could also call the cancel api here if needed
  };

  const handleOpenProfile = async () => {
    // if we're in random chat, end it first properly
    if (isRandomChatActive && matchedRandomUser) {
      await handleEndRandomChat();
    } else if (isWaitingForMatch) {
      // if waiting for match, cancel matchmaking properly
      if (socket) {
        socket.emit('cancelMatchmaking');
      }
      setIsWaitingForMatch(false);
    }
    setIsProfileModalOpen(true);
  };

  const handleCloseProfile = () => {
    setIsProfileModalOpen(false);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!user || !user.id) {
      return;
    }

    try {
      // update status in backend via rest api
      const response = await fetch(API_ENDPOINTS.USER_STATUS(user.id), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        const responseData = await response.json();
        
        // update local user state 
        setUser(prev => {
          const updated = { ...prev, status: newStatus };
          return updated;
        });

        // also update userstatuses immediately for instant ui feedback
        setUserStatuses(prev => ({
          ...prev,
          [user.username]: newStatus
        }));

        // emit status update via socket.io for real-time updates to other users
        if (socket) {
          socket.emit('updateStatus', { status: newStatus });
        }
      }
    } catch (error) {
      // error updating status
    }
  };

  const handleUpdateDescription = (newDescription) => {
    setUser(prev => ({ ...prev, description: newDescription }));
  };

  // interest handlers are defined earlier in the file

  // ============================================================================
  // DATA LOADING & API INTEGRATION
  // ============================================================================

  const loadInitialUserStatuses = async () => {
    if (!user || !user.id) return;
    
    try {
      // load friends' current statuses from the database
      const response = await fetch(API_ENDPOINTS.FRIENDS(user.id), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const friends = await response.json();
        const statusUpdates = {};
        
        // get status for each friend
        for (const friend of friends) {
          try {
            const statusResponse = await fetch(API_ENDPOINTS.USER_STATUS(friend.id), {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              statusUpdates[friend.username] = statusData.status;
            }
          } catch (error) {
            // error loading status for friend
            statusUpdates[friend.username] = 'offline';
          }
        }
        
        // also load current user's status
        try {
          const currentUserStatusResponse = await fetch(API_ENDPOINTS.USER_STATUS(user.id), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (currentUserStatusResponse.ok) {
            const currentUserStatusData = await currentUserStatusResponse.json();
            statusUpdates[user.username] = currentUserStatusData.status;
          }
        } catch (error) {
          // error loading current user status
          statusUpdates[user.username] = user.status || 'online';
        }
        
        setUserStatuses(prev => ({ ...prev, ...statusUpdates }));
      }
    } catch (error) {
      // error loading initial user statuses
    }
  };

  const loadFriendRequests = async () => {
    if (!user || !user.id) {
      // user not available, skipping friend requests load
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // filter to only show received requests (not sent ones)
        const receivedRequests = data.filter(req => req.receiver_id === user.id);
        const sentRequests = data.filter(req => req.sender_id === user.id);
        
        setFriendRequests(receivedRequests.map(req => ({
          id: req.id,
          sender: req.sender_username || req.sender_name,
          status: req.status,
          created_at: req.created_at
        })));
        
        // extract usernames of sent requests
        const sentUsernames = sentRequests.map(req => req.receiver_username || req.receiver_name);
        setSentFriendRequests(sentUsernames);
      }
    } catch (error) {
      // error loading friend requests
    }
  };

  const loadFriends = async () => {
    if (!user || !user.id) {
      // user not available, skipping friends load
      return;
    }
    
    try {
      const response = await fetch(API_ENDPOINTS.FRIENDS(user.id), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const friends = await response.json();
        
        // extract usernames from friend objects
        const friendUsernames = friends.map(friend => friend.username);
        setFriends(friendUsernames);
      }
    } catch (error) {
      // error loading friends
    }
  };

  const loadMessages = async (friendUsername) => {
    if (!user || !user.id) {
      // user not available, cannot load messages
      return Promise.resolve();
    }
    
    try {
      // first get the friend's user id
      const searchResponse = await fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(friendUsername)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to find friend');
      }

      const searchResults = await searchResponse.json();
      const friendUser = searchResults.find(u => u.username === friendUsername);

      if (!friendUser) {
        throw new Error('Friend not found');
      }

      // now load messages between the two users
      const messagesResponse = await fetch(API_ENDPOINTS.MESSAGES_BETWEEN(user.id, friendUser.id), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        
        const formattedMessages = messagesData.map(msg => ({
          id: msg.id, // include message id for read status
          sender: msg.sender_username,
          message: msg.encrypted_message, // use encrypted_message column (contains plain text for now)
          timestamp: new Date(msg.sent_at), // use sent_at column
          isReceived: msg.sender_id !== user.id,
          isRead: msg.is_read // include read status
        }));

        setMessages(prev => ({
          ...prev,
          [friendUsername]: formattedMessages
        }));
      }
    } catch (error) {
      // error loading messages
    }
  };

  // load unread message counts for all friends (for sidebar badges)
  const loadUnreadMessageCounts = async () => {
    if (!user || !user.id || !friends || friends.length === 0) {
      return;
    }

    try {
      // load messages for all friends to get unread counts
      const messagePromises = friends.map(async (friendUsername) => {
        try {
          // get friend's user id
          const searchResponse = await fetch(`${API_ENDPOINTS.USER_SEARCH}?username=${encodeURIComponent(friendUsername)}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) return null;

          const searchResults = await searchResponse.json();
          const friendUser = searchResults.find(u => u.username === friendUsername);
          if (!friendUser) return null;

          // load messages between users
          const messagesResponse = await fetch(API_ENDPOINTS.MESSAGES_BETWEEN(user.id, friendUser.id), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!messagesResponse.ok) return null;

          const messagesData = await messagesResponse.json();
          
          const formattedMessages = messagesData.map(msg => ({
            id: msg.id,
            sender: msg.sender_username,
            message: msg.encrypted_message,
            timestamp: new Date(msg.sent_at),
            isReceived: msg.sender_id !== user.id,
            isRead: msg.is_read
          }));

          return { friendUsername, messages: formattedMessages };
        } catch (error) {
          // error loading messages for friend
          return null;
        }
      });

      const results = await Promise.all(messagePromises);
      
      // update messages state with all loaded conversations
      const newMessages = {};
      results.forEach(result => {
        if (result) {
          newMessages[result.friendUsername] = result.messages;
        }
      });

      if (Object.keys(newMessages).length > 0) {
        setMessages(prev => ({
          ...prev,
          ...newMessages
        }));
      }

    } catch (error) {
      // error loading unread message counts
    }
  };

  const checkRelationshipStatus = async (targetUsername) => {
    if (!user || !user.id) {
      // user not available, cannot check relationship status
      return { status: 'error', error: 'User not available' };
    }
    
    try {
      // get target user's id
      const searchResponse = await fetch(`https://localhost:5000/api/users/search?username=${encodeURIComponent(targetUsername)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!searchResponse.ok) {
        return { status: 'unknown', error: 'User not found' };
      }
      
      const searchResults = await searchResponse.json();
      const targetUser = searchResults.find(u => u.username === targetUsername);
      
      if (!targetUser) {
        return { status: 'unknown', error: 'User not found' };
      }
      
      // check if they are friends
      const friendsResponse = await fetch(`https://localhost:5000/api/friends/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (friendsResponse.ok) {
        const friends = await friendsResponse.json();
        const isFriend = friends.some(friend => friend.id === targetUser.id);
        
        if (isFriend) {
          return { status: 'friends', targetUserId: targetUser.id };
        }
      }
      
      // check friend requests
      const requestsResponse = await fetch(`https://localhost:5000/api/friend-requests/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (requestsResponse.ok) {
        const requests = await requestsResponse.json();
        
        // check if we sent a request to them
        const sentRequest = requests.find(req => 
          req.sender_id === user.id && req.receiver_id === targetUser.id
        );
        
        if (sentRequest) {
          return { 
            status: 'request_sent', 
            requestId: sentRequest.id,
            requestStatus: sentRequest.status,
            targetUserId: targetUser.id 
          };
        }
        
        // check if they sent a request to us
        const receivedRequest = requests.find(req => 
          req.sender_id === targetUser.id && req.receiver_id === user.id
        );
        
        if (receivedRequest) {
          return { 
            status: 'request_received', 
            requestId: receivedRequest.id,
            requestStatus: receivedRequest.status,
            targetUserId: targetUser.id 
          };
        }
      }
      
      return { status: 'none', targetUserId: targetUser.id };
      
    } catch (error) {
      // error checking relationship status
      return { status: 'error', error: error.message };
    }
  };

  const refreshData = async () => {
    if (!user || !user.id) {
      // user not available, skipping data refresh
      return;
    }
    
    await Promise.all([
      loadFriendRequests(),
      loadFriends(),
      loadUserInterests(), // load user's saved interests
      loadInitialUserStatuses() // load initial statuses for friends
    ]);
  };

  // load user data on mount if token exists
  useEffect(() => {
    if (token && !user) {
      // verify token and get user data
      fetch('https://localhost:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setUser(data);
          // log to verify profile picture url is loaded
          // user data loaded
        } else {
          handleLogout();
        }
      })
      .catch(() => {
        handleLogout();
      });
    }
  }, [token]);

  // load data when user is set
  useEffect(() => {
    if (user && user.id && token) {
      refreshData();
      loadInitialUserStatuses(); // load initial statuses for friends
    }
  }, [user, token]);

  // load unread message counts when friends list changes
  useEffect(() => {
    if (user && user.id && token && friends && friends.length > 0) {
      loadUnreadMessageCounts();
    }
  }, [friends, user, token]);

  // client-side heartbeat to keep user active
  useEffect(() => {
    if (!user || !user.id || !token) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        // update last_active_at timestamp
        await fetch('https://localhost:5000/api/users/heartbeat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        // heartbeat error
      }
    }, 15000); // send heartbeat every 15 seconds

    return () => clearInterval(heartbeatInterval);
  }, [user, token]);

  // handle page unload (tab close, refresh, navigation)
  useEffect(() => {
    if (!user || !user.id || !token) return;

    const handleBeforeUnload = (event) => {
      // use sendbeacon for more reliable delivery during page unload
      const data = JSON.stringify({ userId: user.id });
      navigator.sendBeacon('https://localhost:5000/api/users/offline', data);
      
      // also try to emit socket event if socket is available
      if (socket) {
        socket.emit('forceDisconnect');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // mark as offline when page becomes hidden
        fetch('https://localhost:5000/api/users/offline', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          // error marking user as offline on visibility change
        });
        
        // also emit disconnect event via socket if available
        if (socket) {
          socket.emit('forceDisconnect');
          
          // notify chat partner if in random chat
          // also check localstorage for persistent session data in case state was cleared
          const persistentSessionId = localStorage.getItem('currentRandomChatSession');
          const persistentPartner = localStorage.getItem('currentRandomChatPartner');
          
          if ((isRandomChatActive && matchedRandomUser && currentSessionId) || 
              (persistentSessionId && persistentPartner)) {
            const sessionToUse = currentSessionId || persistentSessionId;
            const partnerToUse = matchedRandomUser || persistentPartner;
            
            socket.emit('partnerTabSwitch', { 
              sessionId: sessionToUse,
              isVisible: false 
            });
          }
        }
      } else if (document.visibilityState === 'visible') {
        // let the server decide the correct status via forceconnect - don't override from client
        // the server has the authoritative status information from database/redis
        
        // emit connect event via socket if available - let server handle status restoration
        if (socket) {
          socket.emit('forceConnect');
          
          // notify chat partner if in random chat that user is back
          // also check localstorage for persistent session data in case state was cleared
          const persistentSessionId = localStorage.getItem('currentRandomChatSession');
          const persistentPartner = localStorage.getItem('currentRandomChatPartner');
          
          if ((isRandomChatActive && matchedRandomUser && currentSessionId) || 
              (persistentSessionId && persistentPartner)) {
            const sessionToUse = currentSessionId || persistentSessionId;
            const partnerToUse = matchedRandomUser || persistentPartner;
            
            socket.emit('partnerTabSwitch', { 
              sessionId: sessionToUse,
              isVisible: true 
            });
          }
          
          // mark friend messages as read when returning to tab if in friend chat
          if (selectedUser && !isRandomChatActive) {
            // small delay to ensure state is fully updated before marking as read
            setTimeout(() => {
              markFriendMessagesAsRead(selectedUser);
            }, 100);
          }
        }
      }
    };

    // add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, token, socket]);

  // check for oauth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (tokenParam && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('token', tokenParam);
        setToken(tokenParam);
        setUser(userData);
        // clean up url
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        // error parsing oauth callback
      }
    }
  }, []);

  // handle visibility change for random chat read status
  useEffect(() => {
    if (!isRandomChatActive || !matchedRandomUser || !socket || !user) return;

    const handleRandomChatVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // check if there are any unread messages from the matched user
        const hasUnreadMessages = randomChatMessages.some(msg => 
          msg.sender === matchedRandomUser && !msg.isRead
        );
        
        if (hasUnreadMessages) {
          const randomSessionId = generateRandomSessionId(user.username, matchedRandomUser);
          socket.emit('randomChatSeen', {
            sessionId: randomSessionId,
            matchedUser: matchedRandomUser
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleRandomChatVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleRandomChatVisibilityChange);
    };
  }, [isRandomChatActive, matchedRandomUser, socket, user, randomChatMessages]);

  // ============================================================================
  // COMPONENT RENDER & UI
  // ============================================================================

  if (!user || !token) {
    return (
      <div className="app-scale-wrapper">
        <AuthModal 
          onLogin={handleLogin}
          onRegister={handleRegister}
          message={authError}
          displayErrorFlag={displayErrorFlag}
          handleError={handleError}
        />
      </div>
    );
  }

  return (
    <div className="app-scale-wrapper">
      <div className="flex h-screen bg-gray-900">
        {/* Main Content */}
        <div className="flex w-full h-full">
        {/* Friends Panel */}
        <FriendsPanel
            friends={friends}
            friendRequests={friendRequests}
            onRespondToRequest={respondToFriendRequest}
          onSelectUser={handleUserSelect}
          currentUser={user}
  selectedUser={selectedUser}
  onSendFriendRequest={sendFriendRequest}
          onOpenProfile={handleOpenProfile}
          onFindFriend={async () => {
            // if we're in random chat, end it first properly
            if (isRandomChatActive && matchedRandomUser) {
                          await handleEndRandomChat();
          } else if (isWaitingForMatch) {
            // if waiting for match, cancel matchmaking properly
            if (socket) {
              socket.emit('cancelMatchmaking');
            }
            }
            setIsRandomChatActive(false);
            setMatchedRandomUser(null);
            setSelectedUser(null);
            setIsWaitingForMatch(false);
            setMatchedInterests([]);
          }}
          userStatuses={userStatuses}
          onRefreshData={refreshData}
          getUnreadMessageCount={getUnreadMessageCount}
        />
        
        <ChatPanel
          messages={isRandomChatActive ? randomChatMessages : messages}
          onSendMessage={isRandomChatActive ? handleRandomChatMessage : handleSendMessage}
          selectedUser={selectedUser}
          currentUser={user.username}
          typingUsers={typingUsers}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          onStartRandomChat={handleStartRandomChat}
          onAddFriend={handleAddFriendFromRandom}
          onSkipRandomUser={handleSkipRandomUser}
          onEndRandomChat={handleEndRandomChat}
          isRandomChatActive={isRandomChatActive}
          matchedRandomUser={matchedRandomUser}
          isWaitingForMatch={isWaitingForMatch}
          onCancelMatchmaking={handleCancelMatchmaking}
          selectedInterests={selectedInterests}
          onInterestsChange={setSelectedInterests}
          onInterestToggle={handleInterestToggle}
          userStatuses={userStatuses}
          selectedChatHistory={selectedChatHistory}
          onCloseChatHistory={() => setSelectedChatHistory(null)}
          friends={friends} // pass friends list
          // e2ee props
          e2eeStatus={e2eeStatus}
          isE2EEReady={isE2EEReady}
          e2eeError={e2eeError}
          // matched interests for random chat
          matchedInterests={matchedInterests}
          sentFriendRequests={sentFriendRequests}
        />

        <UsersPanel
          currentUser={user.username}
          friends={friends}
          friendRequests={friendRequests}
          sentFriendRequests={sentFriendRequests}
          onSendFriendRequest={sendFriendRequest}
          onSelectChatHistory={handleSelectChatHistory}
          chatHistory={chatHistory}
          checkRelationshipStatus={checkRelationshipStatus}
          userStatuses={userStatuses}
        />
      </div>

      {/* Modals */}
      <ProfileModal
        user={user}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfile}
        onUpdateProfile={() => {}}
        onUpdateStatus={handleUpdateStatus}
        onUpdateDescription={handleUpdateDescription}
        currentInterests={selectedInterests || []}
        onLogout={handleLogout}
        userStatuses={userStatuses}
      />
      </div>
    </div>
  );
}

export default App;