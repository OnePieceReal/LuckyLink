import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaSmile, FaCircle, FaSearch, FaTimes, FaUserPlus, FaSpinner, FaCheck, FaGift, FaFlag, FaEye } from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';
import GiphyModal from './GiphyModal';
import EmojiPicker from './EmojiPicker';
import ModerationReportModal from './ModerationReportModal';
import logo from '../assets/logo.jpg';
import gifIcon from '../assets/gif-file.png';

// ============================================================================
// CHAT PANEL COMPONENT
// ============================================================================

const ChatPanel = ({ 
  messages, 
  onSendMessage, 
  selectedUser, 
  currentUser, 
  typingUsers = new Set(),
  onTypingStart,
  onTypingStop,
  onStartRandomChat,
  onAddFriend,
  onSkipRandomUser,
  onEndRandomChat,
  isRandomChatActive = false,
  matchedRandomUser = null,
  isWaitingForMatch = false,
  onCancelMatchmaking,
  selectedInterests = [],
  onInterestsChange,
  onInterestToggle,
  userStatuses = {},
  selectedChatHistory = null,
  onCloseChatHistory,
  friends = [], // Add friends list prop
  // E2EE props
  e2eeStatus = 'inactive',
  isE2EEReady = false,
  e2eeError = null,
  // Matched interests and friend request status
  matchedInterests = [],
  sentFriendRequests = []
}) => {
  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  // message input & ui state
  const [message, setMessage] = useState('');
  const [showGiphyModal, setShowGiphyModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // random chat & matchmaking state
  const [interestSearchTerm, setInterestSearchTerm] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [showInterestDropdown, setShowInterestDropdown] = useState(false);
  const [availableInterests, setAvailableInterests] = useState([]);
  const [isLoadingInterests, setIsLoadingInterests] = useState(false);
  const [matchedUserProfile, setMatchedUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // moderation & reporting state
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationData, setModerationData] = useState(null);
  const [isAnalyzingChat, setIsAnalyzingChat] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [hasReportedChat, setHasReportedChat] = useState(false);
  const [analyzedSessions, setAnalyzedSessions] = useState({}); // track analyzed sessions
  const [reportedSessions, setReportedSessions] = useState(new Set());
  
  // refs for dom manipulation
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const messageInputRef = useRef(null);

  // ============================================================================
  // COMPUTED VALUES & DERIVED STATE
  // ============================================================================

  // check if matched user is already a friend
  const isMatchedUserFriend = matchedRandomUser ? friends.includes(matchedRandomUser) : false;
  
  // check if friend request was already sent to matched user
  const isFriendRequestSent = matchedRandomUser ? sentFriendRequests.includes(matchedRandomUser) : false;
  
  // get display text for matched interests
  const getMatchedInterestsText = () => {
    if (!matchedInterests || matchedInterests.length === 0) return null;
    
    // Filter out fallback for display
    const specificInterests = matchedInterests.filter(interest => interest.toLowerCase() !== 'fallback');
    
    if (specificInterests.length === 0) {
      return "🎲 You've been matched from the general pool! Start chatting to find common ground.";
    } else if (specificInterests.length === 1) {
      return `🎯 You've been matched based on your shared interest in ${specificInterests[0]}!`;
    } else {
      const lastInterest = specificInterests[specificInterests.length - 1];
      const otherInterests = specificInterests.slice(0, -1);
      return `🎯 You've been matched based on your shared interests in ${otherInterests.join(', ')} and ${lastInterest}!`;
    }
  };

  // ============================================================================
  // REACT EFFECTS & LIFECYCLE
  // ============================================================================

  // reset isMatching when user is no longer in random chat or waiting
  useEffect(() => {
    if (!isRandomChatActive && !isWaitingForMatch) {
      setIsMatching(false);
    }
  }, [isRandomChatActive, isWaitingForMatch]);

  // Load interests from API
  useEffect(() => {
    const loadInterests = async () => {
      setIsLoadingInterests(true);
      try {
        const response = await fetch('https://localhost:5000/api/interests', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const interests = await response.json();
          const interestNames = interests.map(interest => interest.name);
          setAvailableInterests(interestNames);
        } else {
          setAvailableInterests([]);
        }
      } catch (error) {
        setAvailableInterests([]);
      } finally {
        setIsLoadingInterests(false);
      }
    };

    loadInterests();
  }, []);

  // Reset moderation state when chat history changes
  useEffect(() => {
    if (!selectedChatHistory) {
      // Clear current moderation state when no chat is selected
      setModerationData(null);
      setReportGenerated(false);
      setHasReportedChat(false);
      setShowModerationModal(false);
    } else {
      // Generate unique session ID for this chat history
      const sessionId = `${selectedChatHistory.username}_${selectedChatHistory.timestamp}`;
      
      // Check if this session was already analyzed
      if (analyzedSessions[sessionId]) {
        // Restore the saved moderation data for this session
        setModerationData(analyzedSessions[sessionId]);
        setReportGenerated(true);
      } else {
        // Reset for new session
        setModerationData(null);
        setReportGenerated(false);
      }
      
      // Check if this session was reported
      if (reportedSessions.has(sessionId)) {
        setHasReportedChat(true);
      } else {
        setHasReportedChat(false);
      }
    }
  }, [selectedChatHistory, analyzedSessions, reportedSessions]);

  // Load matched user profile when random chat becomes active
  useEffect(() => {
    const loadMatchedUserProfile = async () => {
      if (!isRandomChatActive || !matchedRandomUser) {
        setMatchedUserProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      try {
        const response = await fetch(`https://localhost:5000/api/users/profile/${matchedRandomUser}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const profile = await response.json();
          setMatchedUserProfile(profile);
        } else {
          setMatchedUserProfile(null);
        }
      } catch (error) {
        setMatchedUserProfile(null);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadMatchedUserProfile();
  }, [isRandomChatActive, matchedRandomUser]);

  // ============================================================================
  // UTILITY FUNCTIONS & HELPERS
  // ============================================================================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowInterestDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ============================================================================
  // EVENT HANDLERS & USER INTERACTIONS
  // ============================================================================

  const handleInputChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // handle typing indicators
    if (newMessage.length > 0) {
      onTypingStart?.();
      
      // clear typing timeout and set new one
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop?.();
      }, 2000);
    } else {
      onTypingStop?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // for random chat, check matchedRandomUser; for friend chat, check selectedUser
    const hasValidChatPartner = isRandomChatActive ? matchedRandomUser : selectedUser;
    
    if (message.trim() && hasValidChatPartner && message.length < 2000) {
      onSendMessage(message.trim());
      setMessage('');
      onTypingStop?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    // If less than 24 hours, show time only
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // If more than 24 hours, show date and time
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessage = (text) => {
    // guard against null/undefined/empty messages
    if (!text || typeof text !== 'string') {
      return text || '';
    }

    // check if this is a giphy url (gif or sticker)
    const giphyPatterns = [
      /https:\/\/media\d*\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.gif/i,
      /https:\/\/media\d*\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.webp/i,
      /https:\/\/i\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.gif/i,
      /https:\/\/i\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.webp/i,
      /https:\/\/media\d*\.giphy\.com\/media\/v\d+\.[^\/\s]+\/[^\/\s]+\/\d+\.gif/i,
      /https:\/\/media\d*\.giphy\.com\/media\/v\d+\.[^\/\s]+\/[^\/\s]+\/\d+\.webp/i,
      /https:\/\/[^\/\s]*\.?giphy\.com\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\.(gif|webp)/i,
      /https:\/\/[^\/\s]*giphy\.com[^\/\s]*\.(gif|webp)/i
    ];
    
    const trimmedText = text.trim();
    const isGiphyUrl = giphyPatterns.some(pattern => pattern.test(trimmedText));
    
    // additional check: if the url contains 'giphy.com' and ends with .gif or .webp
    const isLikelyGiphyUrl = trimmedText.includes('giphy.com') && 
                           (trimmedText.includes('.gif') || trimmedText.includes('.webp'));
    
    if (isGiphyUrl || isLikelyGiphyUrl) {
      // this is a gif/sticker message - render it as an image
      return (
        <div className="flex flex-col items-center max-w-full">
          <img
            src={trimmedText}
            alt="GIF"
            className="max-w-full max-h-64 rounded-lg shadow-lg object-contain bg-gray-800"
            style={{ maxWidth: '100%', height: 'auto' }}
            loading="lazy"
            onLoad={(e) => {}}
            onError={(e) => {
              // fallback: show the url as a link if image fails to load
              e.target.style.display = 'none';
              const linkElement = document.createElement('a');
              linkElement.href = trimmedText;
              linkElement.target = '_blank';
              linkElement.rel = 'noopener noreferrer';
              linkElement.className = 'text-blue-400 hover:text-blue-300 underline break-all';
              linkElement.textContent = 'GIF (Click to view)';
              e.target.parentNode.appendChild(linkElement);
            }}
          />
    
        </div>
      );
    }
    
    // regular text message - existing url detection logic
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
          >
            {part}
          </a>
        );
      }
      // handle long words and text wrapping
      const words = part.split(' ');
      return words.map((word, wordIndex) => (
        <span key={`${index}-${wordIndex}`} className="break-words">
          {wordIndex > 0 ? ' ' : ''}{word}
        </span>
      ));
    });
  };

  // use the handleInterestToggle prop if provided, otherwise fall back to direct state update
  const handleInterestToggle = onInterestToggle || ((interest) => {
    if (selectedInterests.includes(interest)) {
      onInterestsChange(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 3) {
      onInterestsChange([...selectedInterests, interest]);
    }
  });

  const handleStartChat = async () => {
    // don't set isMatching locally - wait for server acknowledgment
    try {
      await onStartRandomChat?.(selectedInterests);
      // the server will emit 'queueJoined' or 'queueJoinFailed' events
      // which will update the ui state accordingly
    } catch (error) {
      // only set isMatching to false on error
      setIsMatching(false);
    }
  };

  const handleCancelMatch = async () => {
    try {
      // use server-authoritative cancel
      if (window.socket) {
        window.socket.emit('cancelMatchmaking');
      }
      
      // the server will emit 'matchCancelled' event which will update the ui
      // we don't need to make api calls anymore
    } catch (error) {
      // error cancelling match
    }
  };

  const handleEmojiSelect = (emoji) => {
    // insert emoji at cursor position
    const input = messageInputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      
      // set cursor position after the emoji
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
      }, 0);
    } else {
      // fallback: append to end
      setMessage(message + emoji);
    }
    
    // close emoji picker but keep focus
    setShowEmojiPicker(false);
  };

  const filteredInterests = availableInterests.filter(interest =>
    interest.toLowerCase().includes(interestSearchTerm.toLowerCase())
  );

  // ============================================================================
  // MODERATION & REPORTING SYSTEM
  // ============================================================================

  // function to analyze chat history for moderation
  const analyzeChat = async () => {
    if (!selectedChatHistory || isAnalyzingChat) return;
    
    // generate unique session id for this chat history
    const sessionId = `${selectedChatHistory.username}_${selectedChatHistory.timestamp}`;
    
    // check if already analyzed
    if (analyzedSessions[sessionId]) {
      // restore the saved data and show the modal
      setModerationData(analyzedSessions[sessionId]);
      setShowModerationModal(true);
      return;
    }
    
    // prevent analysis if currently in an active random chat with the same user
    if (isRandomChatActive && matchedRandomUser === selectedChatHistory.username) {
      alert('You cannot generate a report for a user while actively chatting with them. Please end the chat first.');
      return;
    }
    
    setIsAnalyzingChat(true);
    try {
      // prepare messages for batch moderation - separate by user
      const currentUserMessages = selectedChatHistory.messages
        .filter(msg => msg.sender === currentUser)
        .map(msg => msg.message);
      
      const otherUserMessages = selectedChatHistory.messages
        .filter(msg => msg.sender !== currentUser)
        .map(msg => msg.message);

      // skip analysis if no messages
      if (currentUserMessages.length === 0 && otherUserMessages.length === 0) {
        setIsAnalyzingChat(false);
        return;
      }

      // analyze both users' messages separately
      const analyzeUser = async (messages, username) => {
        if (messages.length === 0) {
          return {
            flagged: false,
            categories: {},
            categoryScores: {},
            severity: 0,
            recommendation: 'No messages to analyze',
            totalMessages: 0,
            flaggedCount: 0,
            flaggedMessages: []
          };
        }

        const response = await fetch('https://localhost:5000/api/moderation/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ texts: messages })
        });

        if (!response.ok) {
          throw new Error('Failed to analyze messages');
        }

        const data = await response.json();
        
        // process batch results
        const flaggedMessages = [];
        let maxSeverity = 0;
        const aggregatedCategories = {};
        const aggregatedScores = {};
        
        // initialize all categories with defaults
        const allCategories = [
          'harassment', 'harassment/threatening', 'hate', 'hate/threatening',
          'self-harm', 'self-harm/intent', 'self-harm/instructions',
          'sexual', 'sexual/minors', 'violence', 'violence/graphic'
        ];
        
        allCategories.forEach(cat => {
          aggregatedCategories[cat] = false;
          aggregatedScores[cat] = 0;
        });
        
        data.results.forEach((result, index) => {
          if (result.flagged) {
            flaggedMessages.push({
              message: messages[index],
              sender: username,
              ...result
            });
          }
          
          maxSeverity = Math.max(maxSeverity, result.severity || 0);
          
          // aggregate categories
          Object.entries(result.categories || {}).forEach(([cat, flagged]) => {
            if (flagged) {
              aggregatedCategories[cat] = true;
            }
          });
          
          // track max scores for each category
          Object.entries(result.categoryScores || {}).forEach(([cat, score]) => {
            aggregatedScores[cat] = Math.max(aggregatedScores[cat] || 0, score);
          });
        });

        return {
          flagged: flaggedMessages.length > 0,
          categories: aggregatedCategories,
          categoryScores: aggregatedScores,
          allScores: aggregatedScores,
          severity: maxSeverity,
          recommendation: flaggedMessages.length > 0 
            ? `${flaggedMessages.length} of ${messages.length} messages flagged`
            : 'Content appears appropriate',
          totalMessages: messages.length,
          flaggedCount: flaggedMessages.length,
          flaggedMessages: flaggedMessages
        };
      };

      // analyze both users
      const [currentUserAnalysis, otherUserAnalysis] = await Promise.all([
        analyzeUser(currentUserMessages, currentUser),
        analyzeUser(otherUserMessages, selectedChatHistory.username)
      ]);

      // determine if reporting is allowed
      // can report if: other user's toxicity is significantly higher than yours
      // allow reporting if other user is >60% toxic and current user is <50% toxic
      const currentUserToxic = currentUserAnalysis.severity > 0.5; // 50% threshold for reporter
      const otherUserToxic = otherUserAnalysis.severity > 0.6; // 60% threshold for reported
      
      const canReport = otherUserToxic && !currentUserToxic;
      const reportReason = canReport 
        ? `The other user has ${otherUserAnalysis.flaggedCount} flagged messages (${(otherUserAnalysis.severity * 100).toFixed(0)}% toxicity)`
        : currentUserToxic 
          ? `Cannot report when your toxicity level is ${(currentUserAnalysis.severity * 100).toFixed(0)}% (must be below 50%)`
          : otherUserToxic 
            ? 'Both users have concerning content'
            : `Other user's toxicity level (${(otherUserAnalysis.severity * 100).toFixed(0)}%) is below reporting threshold (60%)`;

      // set moderation data with per-user analysis
      const moderationResult = {
        currentUserAnalysis,
        otherUserAnalysis,
        canReport,
        reportReason,
        batchMode: true,
        timestamp: new Date().toISOString()
      };

      setModerationData(moderationResult);
      setReportGenerated(true);
      setShowModerationModal(true);
      
      // store the moderation data for this session
      setAnalyzedSessions(prev => ({
        ...prev,
        [sessionId]: moderationResult
      }));
    } catch (error) {
      alert('Failed to analyze chat history. Please try again.');
    } finally {
      setIsAnalyzingChat(false);
    }
  };

  // function to handle report submission
  const handleReportUser = async (reportData) => {
    // generate unique session id for this chat history (must match the one used in useEffect)
    const sessionId = `${reportData.reportedUser}_${reportData.chatHistory.timestamp}`;
    
    // check if already reported
    if (reportedSessions.has(sessionId) || hasReportedChat) {
      return;
    }
    
    // final check: prevent reporting if actively chatting with the same user
    if (isRandomChatActive && matchedRandomUser === reportData.reportedUser) {
      alert('You cannot report a user while actively chatting with them. Please end the chat first.');
      return;
    }
    
    try {
      // generate a unique session id for this chat
      const chatSessionId = `${reportData.chatHistory.timestamp}_${reportData.reportedUser}_${currentUser}`;
      
      // log the moderation report with proper structure
      const logResponse = await fetch('https://localhost:5000/api/moderation-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reported_user: reportData.reportedUser,
          reporting_user: currentUser,
          chat_history: reportData.chatHistory,
          moderation_data: reportData.moderationData,
          chat_session_id: chatSessionId,
          reason: `Chat history flagged: ${reportData.moderationData.otherUserAnalysis.flaggedCount} toxic messages detected`
        })
      });

      const responseData = await logResponse.json();
      
      if (!logResponse.ok) {
        // handle duplicate report error
        if (logResponse.status === 409) {
          alert('You have already reported this chat session.');
          setHasReportedChat(true);
          // track as reported even if server says duplicate
          setReportedSessions(prev => new Set(prev).add(sessionId));
        } else {
          throw new Error(responseData.error || 'Failed to log report');
        }
        return;
      }

      setHasReportedChat(true);
      // track that this session has been reported
      setReportedSessions(prev => new Set(prev).add(sessionId));
      // silent success - button will change to "view report (reported)"
    } catch (error) {
      alert('Failed to submit report. Please try again.');
    }
  };

  // ============================================================================
  // UI COMPONENTS & RENDER LOGIC
  // ============================================================================

  // ============================================================================
  // CHAT HISTORY VIEW
  // ============================================================================

  // chat history view
  if (selectedChatHistory) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* header */}
        <div className="h-[85px] p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onCloseChatHistory}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={20} />
              </button>
              <ProfilePicture 
                username={selectedChatHistory.username} 
                size="lg" 
                status="offline"
              />
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Chat with {selectedChatHistory.username}
                </h2>
                <p className="text-gray-400 text-sm">
                  {new Date(selectedChatHistory.timestamp).toLocaleDateString()} · 
                  Chat {selectedChatHistory.endReason} · Read Only
                  {isRandomChatActive && matchedRandomUser === selectedChatHistory.username && (
                    <span className="ml-2 text-yellow-400">· Currently in active chat</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedChatHistory.messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages in this conversation
            </div>
          ) : (
            selectedChatHistory.messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words ${
                  msg.sender === currentUser
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}>
                  <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender === currentUser ? 'text-purple-200' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* moderation controls */}
        <div className="h-[76.9px] p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center justify-center space-x-3">
            {/* check if user is in active chat with this person */}
            {isRandomChatActive && matchedRandomUser === selectedChatHistory.username ? (
              <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-600/20 border border-yellow-600/50 text-yellow-400 rounded-lg">
                <FaTimes className="w-4 h-4" />
                <span className="text-sm font-medium">Cannot report during active chat - End chat first</span>
              </div>
            ) : !reportGenerated ? (
              <button
                onClick={analyzeChat}
                disabled={isAnalyzingChat || selectedChatHistory.messages.length === 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isAnalyzingChat
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : selectedChatHistory.messages.length === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                }`}
              >
                {isAnalyzingChat ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <FaFlag className="w-4 h-4" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowModerationModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FaEye className="w-4 h-4" />
                <span>{hasReportedChat ? 'View Report (Reported)' : 'View Report'}</span>
              </button>
            )}
            
            {selectedChatHistory.messages.length === 0 && !isRandomChatActive && (
              <span className="text-gray-500 text-sm">No messages to analyze</span>
            )}
          </div>
        </div>
        
        {/* moderation report modal */}
        <ModerationReportModal
          isOpen={showModerationModal}
          onClose={() => setShowModerationModal(false)}
          moderationData={moderationData}
          chatHistory={selectedChatHistory}
          currentUser={currentUser}
          isRandomChatActive={isRandomChatActive && matchedRandomUser === selectedChatHistory.username}
          onReport={handleReportUser}
          hasAlreadyReported={hasReportedChat}
        />
      </div>
    );
  }

  // ============================================================================
  // RANDOM CHAT MATCHMAKING INTERFACE
  // ============================================================================

  // random chat interface
  if (!selectedUser && !isRandomChatActive) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* navigation panel */}
        <div className="h-[85px] p-4 border-b border-gray-700 bg-gray-800">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">LuckyLink</h1>
          </div>
        </div>

        {/* random chat content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="mb-6">
                <img 
                  src={logo} 
                  alt="LuckyLink Logo" 
                  className="w-20 h-20 mx-auto rounded-full border-2 border-purple-500 shadow-lg"
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Start a Random Chat</h2>
              <p className="text-gray-400">Connect with strangers who share your interests</p>
            </div>

            {/* interest selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Interests (max 3):
                {isWaitingForMatch && (
                  <span className="ml-2 text-xs text-yellow-400">
                    (Locked during matchmaking - cancel to change)
                  </span>
                )}
              </label>
              
              {/* selected interests tags */}
              {selectedInterests.filter(interest => interest.toLowerCase() !== 'fallback').length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedInterests
                    .filter(interest => interest.toLowerCase() !== 'fallback')
                    .map((interest) => (
                    <span
                      key={interest}
                      className={`inline-flex items-center px-3 py-1 text-sm rounded-full ${
                        isWaitingForMatch 
                          ? 'bg-gray-600 text-gray-300' 
                          : 'bg-purple-600 text-white'
                      }`}
                    >
                      {interest}
                      {!isWaitingForMatch && (
                        <button
                          onClick={() => handleInterestToggle(interest)}
                          className="ml-2 hover:text-gray-300"
                        >
                          <FaTimes size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* interest dropdown */}
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isWaitingForMatch ? "Cancel matchmaking to change interests" : "Search interests..."}
                    value={interestSearchTerm}
                    onChange={(e) => setInterestSearchTerm(e.target.value)}
                    onFocus={() => !isWaitingForMatch && setShowInterestDropdown(true)}
                    disabled={isWaitingForMatch}
                    className={`w-full px-4 py-3 border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-all ${
                      isWaitingForMatch
                        ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-gray-800 border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                    }`}
                  />
                  <FaSearch className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    isWaitingForMatch ? 'text-gray-500' : 'text-gray-400'
                  }`} size={16} />
                </div>

                {showInterestDropdown && !isWaitingForMatch && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isLoadingInterests ? (
                      <div className="px-4 py-3 text-gray-400 flex items-center">
                        <FaSpinner className="animate-spin mr-2" size={14} />
                        Loading interests...
                      </div>
                    ) : filteredInterests.length > 0 ? (
                      filteredInterests.map((interest) => (
                        <button
                          key={interest}
                          onClick={() => {
                            handleInterestToggle(interest);
                            setInterestSearchTerm('');
                            setShowInterestDropdown(false);
                          }}
                          disabled={selectedInterests.length >= 3 && !selectedInterests.includes(interest)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                            selectedInterests.includes(interest)
                              ? 'bg-purple-600 text-white'
                              : selectedInterests.length >= 3 && !selectedInterests.includes(interest)
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-white'
                          }`}
                        >
                          {interest}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-400">
                        {interestSearchTerm ? 'No interests found' : 'No interests available'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* start chat button */}
            <button
              onClick={handleStartChat}
              disabled={isMatching || isWaitingForMatch}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {(isMatching || isWaitingForMatch) ? (
                <div className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2" size={16} />
                  {isWaitingForMatch ? 'Waiting for match...' : 'Finding a match...'}
                </div>
              ) : (
                'Start Chat'
              )}
            </button>

            {/* cancel button (only show when waiting) */}
            {isWaitingForMatch && (
              <button
                onClick={handleCancelMatch}
                className="w-full mt-3 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Cancel
              </button>
            )}

            {selectedInterests.length === 0 && (
              <p className="text-center text-gray-500 text-sm mt-3">
                No interests selected? You'll be matched randomly!
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACTIVE RANDOM CHAT INTERFACE
  // ============================================================================

  // active random chat interface
  if (isRandomChatActive && matchedRandomUser) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* ============================================================================ */}
        {/* RANDOM CHAT HEADER - PROFILE PICTURE & CONTROLS */}
        {/* ============================================================================ */}
        <div className="h-[85px] p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ProfilePicture 
                username={matchedRandomUser} 
                size="lg" 
                status="online"
                className="mr-3"
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">{matchedRandomUser}</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 text-sm">Random Match</span>
                  {/* e2ee status indicator */}
                  {e2eeStatus === 'ready' && isE2EEReady && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-green-600/20 border border-green-600/50 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs font-medium">Encrypted</span>
                    </div>
                  )}
                  {e2eeStatus === 'key_exchange' && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-600/20 border border-yellow-600/50 rounded-full">
                      <FaSpinner className="w-2 h-2 text-yellow-400 animate-spin" />
                      <span className="text-yellow-400 text-xs font-medium">Securing...</span>
                    </div>
                  )}
                  {e2eeStatus === 'error' && e2eeError && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-red-600/20 border border-red-600/50 rounded-full">
                      <FaTimes className="w-2 h-2 text-red-400" />
                      <span className="text-red-400 text-xs font-medium">Encryption Failed</span>
                    </div>
                  )}
                  {e2eeStatus === 'initializing' && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-blue-600/20 border border-blue-600/50 rounded-full">
                      <FaSpinner className="w-2 h-2 text-blue-400 animate-spin" />
                      <span className="text-blue-400 text-xs font-medium">Initializing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEndRandomChat?.()}
                className="flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                title="End current match"
              >
                <FaTimes size={12} className="mr-1" />
                End Match
              </button>
              <button
                onClick={() => onSkipRandomUser?.()}
                className="flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                title="Skip to next user"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Skip
              </button>
              {isMatchedUserFriend ? (
                <div className="flex items-center px-3 py-2 bg-green-600/20 border border-green-600/50 text-green-400 text-sm rounded-lg">
                  <FaCheck size={12} className="mr-1" />
                  Friends
                </div>
              ) : isFriendRequestSent ? (
                <div className="flex items-center px-3 py-2 bg-blue-600/20 border border-blue-600/50 text-blue-400 text-sm rounded-lg">
                  <FaCheck size={12} className="mr-1" />
                  Sent
                </div>
              ) : (
                <button
                  onClick={() => onAddFriend?.(matchedRandomUser)}
                  className="flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                >
                  <FaUserPlus size={12} className="mr-1" />
                  Add Friend
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================================ */}
        {/* MATCHED INTERESTS DISPLAY */}
        {/* ============================================================================ */}
        
        
        {isRandomChatActive && matchedRandomUser && getMatchedInterestsText() && (
          <div className="border-b border-gray-700 bg-gradient-to-r from-purple-900/10 via-blue-900/10 to-pink-900/10">
            <div className="p-3">
              <div className="text-center">
                <p className="text-sm text-blue-300 leading-relaxed">
                  {getMatchedInterestsText()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================ */}
        {/* USER PROFILE SECTION */}
        {/* ============================================================================ */}
        {isRandomChatActive && matchedRandomUser && (
          <div className="h-[85px] border-b border-gray-700 bg-gradient-to-r from-purple-900/20 via-pink-900/10 to-blue-900/20 animate-gradient-x">
            <div className="p-4">
              {isLoadingProfile ? (
                <div className="flex items-center justify-center py-6">
                  <FaSpinner className="animate-spin text-purple-400 mr-2" size={16} />
                  <span className="text-gray-400">Loading profile...</span>
                </div>
              ) : matchedUserProfile ? (
                <div className="space-y-3">
                  {/* description section */}
                  {matchedUserProfile.description ? (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-gray-300 leading-relaxed">
                            {matchedUserProfile.description}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 ml-4">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
                      <div className="flex items-center justify-between">
                        <p className="text-gray-500 italic">
                          No description available
                        </p>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* member info */}
                  <div className="flex items-center justify-center space-x-6 text-sm text-gray-400 pt-1">
                    <div className="flex items-center space-x-2">
                      <FaCircle size={4} className="text-purple-500" />
                      <span>Member since {new Date(matchedUserProfile.created_at).getFullYear()}</span>
                    </div>
                    {matchedUserProfile.last_active_at && (
                      <div className="flex items-center space-x-2">
                        <FaCircle size={4} className="text-blue-500" />
                        <span>Last active {new Date(matchedUserProfile.last_active_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FaCircle size={20} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">Profile unavailable</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================================ */}
        {/* MESSAGES AREA */}
        {/* ============================================================================ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaCircle size={24} className="text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No messages yet</h3>
                <p className="text-gray-500 text-sm">
                  Send your first message to {matchedRandomUser} to start the conversation!
                </p>
              </div>
            </div>
          ) : (
            <>
              {Array.isArray(messages) ? messages.map((msg, index) => {
                
                return msg.isSystem ? (
                  // system message (tab switching notifications and security)
                  <div key={index} className="flex justify-center my-4">
                    <div className="max-w-md">
                      <div className={`border rounded-lg px-4 py-2 ${
                        msg.message.includes('🔒') || msg.message.includes('encrypted') 
                          ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20'
                          : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20'
                      }`}>
                        <p className={`text-center text-sm leading-relaxed ${
                          msg.message.includes('🔒') || msg.message.includes('encrypted')
                            ? 'text-green-300'
                            : 'text-blue-300'
                        }`}>
                          {msg.message}
                        </p>
                      </div>
                      <div className="text-center text-xs text-gray-500 mt-1">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ) : (
                  // regular user message
                  <div
                    key={index}
                    className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start max-w-xs lg:max-w-md ${msg.sender === currentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* profile picture - aligned with message text */}
                      <ProfilePicture 
                        username={msg.sender} 
                        size="md" 
                        status="online"
                        showStatus={false}
                        className={`${msg.sender === currentUser ? 'ml-2' : 'mr-2'} flex-shrink-0 mt-1`}
                      />
                      
                      {/* message content */}
                      <div className="flex-1">
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            msg.sender === currentUser
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 text-white'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{formatMessage(msg.message)}</p>
                        </div>
                        {/* timestamp and read status below message bubble */}
                        <div className={`text-xs text-gray-500 mt-1 flex items-center gap-2 ${
                          msg.sender === currentUser ? 'justify-end' : 'justify-start'
                        }`}>
                          <span>{formatTime(msg.timestamp)}</span>
                          {/* read status for sent messages (both friend and random chat) */}
                          {msg.sender === currentUser && (
                            <span className="text-gray-400">
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                // handle case where messages might be an object (for random chat)
                <div className="text-center text-gray-500">
                  <p>Loading messages...</p>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ============================================================================ */}
        {/* TYPING INDICATOR */}
        {/* ============================================================================ */}
        {typingUsers.has(matchedRandomUser) && (
          <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-sm text-gray-400">
                {matchedRandomUser} is typing...
              </span>
            </div>
          </div>
        )}

        {/* ============================================================================ */}
        {/* MESSAGE INPUT FIELD */}
        {/* ============================================================================ */}
        <div className="h-[76.9px] p-4 border-t border-gray-700 bg-gray-800">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={messageInputRef}
                value={message}
                onChange={handleInputChange}
                placeholder={`Message ${matchedRandomUser}...`}
                className="w-full px-4 py-2 pr-16 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="1"
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                {message.length > 0 && (
                  <span className={`text-xs mr-2 ${
                    message.length > 1800 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {message.length}/2000
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowGiphyModal(true)}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  title="Add GIF"
                >
                  <img src={gifIcon} alt="GIF" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-emoji-button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                  title="Add Emoji"
                >
                  <FaSmile size={16} />
                </button>
              </div>
              
              {/* emoji picker */}
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelect={handleEmojiSelect}
                inputRef={messageInputRef}
              />
            </div>
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex-shrink-0"
            >
              <FaPaperPlane size={16} />
            </button>
          </form>
        </div>

        {/* ============================================================================ */}
        {/* MODALS */}
        {/* ============================================================================ */}
        <GiphyModal
          isOpen={showGiphyModal}
          onClose={() => setShowGiphyModal(false)}
          onGifSelect={(gifUrl) => {
            // send the gif url as a message
            onSendMessage(gifUrl);
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // NO CHAT SELECTED STATE
  // ============================================================================

  // regular chat interface (existing code)
  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center p-8">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaCircle size={32} className="text-gray-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-300 mb-2">No chat selected</h3>
          <p className="text-gray-500 max-w-md">
            Choose a friend from the sidebar to start chatting and share your thoughts!
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FRIEND CHAT INTERFACE
  // ============================================================================

  // regular friend chat interface
  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* ============================================================================ */}
      {/* FRIEND CHAT HEADER - PROFILE PICTURE & STATUS */}
      {/* ============================================================================ */}
      <div className="h-[85px] p-4 border-b border-gray-700 bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ProfilePicture 
              username={selectedUser} 
              size="lg" 
              status={userStatuses[selectedUser] || 'offline'}
              className="mr-3"
            />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">{selectedUser}</h2>
              <div className="flex items-center">
                <span className="text-gray-400 text-sm capitalize">
                  {userStatuses[selectedUser] || 'offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* FRIEND CHAT MESSAGES AREA */}
      {/* ============================================================================ */}
     
     
     
     
     
     
     <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {/* handle different message formats */}
        {(() => {
          let messagesToRender = [];
          
          if (isRandomChatActive) {
            // random chat: messages is an array
            messagesToRender = Array.isArray(messages) ? messages : [];
          } else {
            // friend chat: messages is an object, get array for selectedUser
            messagesToRender = (messages && selectedUser && messages[selectedUser]) ? messages[selectedUser] : [];
          }
          
          return messagesToRender.length > 0 ? (
            <>
              {messagesToRender.map((msg, index) => {
                
                return (
                <div
                  key={index}
                  className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`flex items-start max-w-xs lg:max-w-md xl:max-w-lg ${msg.sender === currentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* profile picture - aligned with message text */}
                    <ProfilePicture 
                      username={msg.sender} 
                      size="md" 
                      status={userStatuses[msg.sender] || 'offline'}
                      showStatus={false}
                      className={`${msg.sender === currentUser ? 'ml-2' : 'mr-2'} flex-shrink-0 mt-1`}
                    />
                    
                    {/* message content */}
                    <div className="flex-1">
                      <div
                        className={`px-4 py-2 rounded-lg shadow-sm transition-all duration-200 ${
                          msg.sender === currentUser
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words">{formatMessage(msg.message)}</p>
                      </div>
                      {/* timestamp and read status below message bubble */}
                      <div className={`text-xs text-gray-500 mt-1 flex items-center gap-2 ${
                        msg.sender === currentUser ? 'justify-end' : 'justify-start'
                      }`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {/* read status for sent messages (both friend and random chat) */}
                        {msg.sender === currentUser && (
                          <span className="text-gray-400">
                            {msg.isRead ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full animate-fadeIn">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <FaCircle size={24} className="text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No messages yet</h3>
                <p className="text-gray-500 text-sm">
                  Send your first message to {isRandomChatActive ? matchedRandomUser : selectedUser} to start the conversation!
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ============================================================================ */}
      {/* TYPING INDICATOR */}
      {/* ============================================================================ */}
      
      
      
      
      
      {typingUsers.has(selectedUser) && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-sm text-gray-400">
              {selectedUser} is typing...
            </span>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MESSAGE INPUT FIELD */}
      {/* ============================================================================ */}
      
      
      
      
      <div className="h-[76.9px] p-4 border-t border-gray-700 bg-gray-800 shadow-lg ">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={handleInputChange}
              placeholder={`Message ${selectedUser}...`}
              className="w-full px-4 py-2 pr-16 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none shadow-sm"
              rows="1"
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {message.length > 0 && (
                <span className={`text-xs mr-2 ${
                  message.length > 1800 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {message.length}/2000
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowGiphyModal(true)}
                className="opacity-70 hover:opacity-100 transition-opacity"
                title="Add GIF"
              >
                <img src={gifIcon} alt="GIF" className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-emoji-button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-gray-400 hover:text-yellow-400 transition-colors"
                title="Add Emoji"
              >
                <FaSmile size={16} />
              </button>
            </div>
            
            {/* emoji picker */}
            <EmojiPicker
              isOpen={showEmojiPicker}
              onClose={() => setShowEmojiPicker(false)}
              onEmojiSelect={handleEmojiSelect}
              inputRef={messageInputRef}
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 shadow-sm flex-shrink-0"
          >
            <FaPaperPlane size={16} />
          </button>
        </form>
      </div>

      {/* ============================================================================ */}
      {/* MODALS */}
      {/* ============================================================================ */}
      <GiphyModal
        isOpen={showGiphyModal}
        onClose={() => setShowGiphyModal(false)}
        onGifSelect={(gifUrl) => {
          // send the gif url as a message
          onSendMessage(gifUrl);
        }}
      />
    </div>
  );
};


export default ChatPanel; 