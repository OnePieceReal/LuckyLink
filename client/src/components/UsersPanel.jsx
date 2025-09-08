import React, { useState } from 'react';
import { FaHistory, FaSearch, FaUserPlus, FaCircle, FaComment } from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';

const UsersPanel = ({ 
  currentUser, 
  friends, 
  friendRequests,
  sentFriendRequests = [],
  onSendFriendRequest,
  onSelectChatHistory,
  chatHistory = [], // Array of random chat sessions
  checkRelationshipStatus = null, // New prop for relationship checking
  userStatuses = {} // Add userStatuses prop
}) => {
  const [activeTab, setActiveTab] = useState('chat-history'); // 'chat-history' or 'search-users'
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relationshipStatuses, setRelationshipStatuses] = useState({}); // track relationship status for each user

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  // search users by username
  const handleSearchUsers = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://localhost:5000/api/users/search?username=${encodeURIComponent(searchTerm.trim())}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        
        // check relationship status for each user
        if (checkRelationshipStatus) {
          const statuses = {};
          for (const user of data) {
            const status = await checkRelationshipStatus(user.username);
            statuses[user.username] = status;
          }
          setRelationshipStatuses(statuses);
        }
      } else {
        setSearchResults([]);
        setRelationshipStatuses({});
      }
    } catch (error) {
      setSearchResults([]);
      setRelationshipStatuses({});
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSendRequest = (username) => {
    onSendFriendRequest(username);
    // update the relationship status immediately
    setRelationshipStatuses(prev => ({
      ...prev,
      [username]: { status: 'request_sent', targetUserId: null }
    }));
  };

  const handleSelectChatHistory = (sessionId) => {
    onSelectChatHistory(sessionId);
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getButtonState = (username) => {
    const status = relationshipStatuses[username];
    
    if (!status) {
      return {
        disabled: false,
        className: 'bg-purple-600 hover:bg-purple-700 text-white',
        text: 'Add Friend',
        icon: <FaUserPlus size={12} className="mr-1" />
      };
    }
    
    switch (status.status) {
      case 'friends':
        return {
          disabled: true,
          className: 'bg-gray-600 text-gray-400 cursor-not-allowed',
          text: 'Friends',
          icon: <FaCircle size={12} className="mr-1" />
        };
      case 'request_sent':
        return {
          disabled: true,
          className: 'bg-blue-600 text-white cursor-not-allowed',
          text: 'Sent',
          icon: <FaUserPlus size={12} className="mr-1" />
        };
      case 'request_received':
        return {
          disabled: true,
          className: 'bg-green-600 text-white cursor-not-allowed',
          text: 'Received',
          icon: <FaCircle size={12} className="mr-1" />
        };
      default:
        return {
          disabled: false,
          className: 'bg-purple-600 hover:bg-purple-700 text-white',
          text: 'Add Friend',
          icon: <FaUserPlus size={12} className="mr-1" />
        };
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <h2 className="text-xl font-bold text-white">Chat & Contacts</h2>
        <p className="text-gray-400 text-sm mt-1">
          {activeTab === 'chat-history' ? 'Recent chat sessions' : 'Search and add friends'}
        </p>
      </div>

      {/* tab navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('chat-history')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === 'chat-history'
              ? 'bg-purple-600 text-white border-b-2 border-purple-400'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FaHistory className="inline mr-2" size={14} />
          Chat History
        </button>
        <button
          onClick={() => setActiveTab('search-users')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === 'search-users'
              ? 'bg-purple-600 text-white border-b-2 border-purple-400'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FaSearch className="inline mr-2" size={14} />
          Search Users
        </button>
      </div>

      {/* tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat-history' ? (
          /* chat history tab */
          <div className="p-4">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <FaHistory size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  No chat history
                </h3>
                <p className="text-gray-500 text-sm">
                  Your random chat sessions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatHistory.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectChatHistory(session.id)}
                    className="p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <ProfilePicture 
                          username={session.username} 
                          size="lg" 
                          status="offline"
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {session.username}
                          </p>
                          <p className="text-gray-400 text-sm truncate">
                            {session.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-xs">
                          {new Date(session.timestamp).toLocaleTimeString()}
                        </p>
                        <FaComment className="text-purple-400 mt-1" size={12} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* search users tab */
          <div className="p-4">
            {/* search input */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter username to search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  onClick={handleSearchUsers}
                  disabled={isSearching || !searchTerm.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* search results */}
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div key={user.id} className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <ProfilePicture 
                          username={user.username} 
                          size="lg" 
                          status={userStatuses[user.username] || user.status || 'offline'}
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {user.username}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {userStatuses[user.username] || user.status || 'offline'}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleSendRequest(user.username)}
                        disabled={getButtonState(user.username).disabled}
                        className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          getButtonState(user.username).className
                        }`}
                      >
                        {getButtonState(user.username).icon}
                        {getButtonState(user.username).text}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm && !isSearching ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <FaSearch size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  No users found
                </h3>
                <p className="text-gray-500 text-sm">
                  Try searching with a different username
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <FaUserPlus size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Search for users
                </h3>
                <p className="text-gray-500 text-sm">
                  Enter a username above to find and add friends
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="h-[76.9px] p-4 border-t border-gray-700 bg-gray-800">
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            {activeTab === 'chat-history' 
              ? 'Random chat sessions are not stored permanently' 
              : 'Friend requests are sent via secure messaging'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default UsersPanel; 