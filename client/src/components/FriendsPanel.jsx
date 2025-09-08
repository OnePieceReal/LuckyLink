import React, { useState } from 'react';
import { FaUserFriends, FaUserPlus, FaCircle, FaCheck, FaTimes, FaUser, FaCog } from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';
import FriendSettingsModal from './FriendSettingsModal';

const FriendsPanel = ({ 
  friends, 
  friendRequests, 
  onRespondToRequest,
  onSelectUser,
  currentUser,
  selectedUser,
  onSendFriendRequest,
  onOpenProfile,
  onFindFriend,
  userStatuses = {},
  onRefreshData,
  getUnreadMessageCount
}) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchTerm, setSearchTerm] = useState('');
  const [friendSettingsModal, setFriendSettingsModal] = useState({
    isOpen: false,
    friendUsername: null
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const filteredFriends = friends.filter(friend => 
    friend.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = friendRequests.filter(request => 
    request.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'away': return 'text-yellow-400';
      case 'dnd': return 'text-red-400';
      case 'invisible': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleOpenFriendSettings = (friendUsername) => {
    setFriendSettingsModal({
      isOpen: true,
      friendUsername
    });
  };

  const handleCloseFriendSettings = () => {
    setFriendSettingsModal({
      isOpen: false,
      friendUsername: null
    });
  };

  const handleDeleteFriend = (friendUsername) => {
    // refresh the friends list after deletion
    if (onRefreshData) {
      onRefreshData();
    }
    handleCloseFriendSettings();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Friends</h2>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === 'friends' ? `${friends.length} friends` : `${friendRequests.length} requests`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onFindFriend}
              className="flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
              title="Find new friends"
            >
              <FaUserPlus size={12} className="mr-1" />
              Find Friend
            </button>
          </div>
        </div>
      </div>

      {/* search bar */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder={`Search ${activeTab === 'friends' ? 'friends' : 'requests'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium transition-all ${
            activeTab === 'friends'
              ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          <FaUserFriends className="mr-2" />
          Friends
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium transition-all ${
            activeTab === 'requests'
              ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          <FaUserPlus className="mr-2" />
          Requests
          {friendRequests.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {friendRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' ? (
          <div>
            {filteredFriends.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <FaUserFriends size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No friends yet</h3>
                <p className="text-gray-500 text-sm">
                  {searchTerm ? 'No friends match your search' : 'Start connecting with people!'}
                </p>
              </div>
            ) : (
              <div className="py-2">
                {filteredFriends.map((friend, index) => (
                  <div
                    key={index}
                    className={`px-4 py-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition-colors ${
                      selectedUser === friend ? 'bg-gray-800 border-r-2 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div 
                        onClick={() => onSelectUser(friend)}
                        className="flex items-center flex-1 cursor-pointer"
                      >
                        <ProfilePicture 
                          username={friend} 
                          size="md" 
                          status={userStatuses[friend] || 'offline'} 
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{friend}</p>
                          <p className="text-gray-400 text-sm capitalize">
                            {userStatuses[friend] || 'offline'}
                          </p>
                        </div>
                        
                        {/* unread message counter - positioned separately for better alignment */}
                        {getUnreadMessageCount && getUnreadMessageCount(friend) > 0 && (
                          <div className="flex items-center ml-2">
                            <span className="bg-purple-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-md">
                              {getUnreadMessageCount(friend) > 99 ? '99+' : getUnreadMessageCount(friend)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* settings button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFriendSettings(friend);
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ml-2 bg-gray-800 border border-gray-600"
                        title={`Friend settings for ${friend}`}
                      >
                        <FaUser size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <FaUserPlus size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No friend requests</h3>
                <p className="text-gray-500 text-sm">
                  {searchTerm ? 'No requests match your search' : 'All caught up!'}
                </p>
              </div>
            ) : (
              <div className="py-2">
                {filteredRequests.map((request, index) => (
                  <div key={index} className="px-4 py-3 border-b border-gray-700 last:border-b-0">
                    <div className="flex items-center mb-3">
                      <ProfilePicture 
                        username={request.sender} 
                        size="md" 
                        status="offline" 
                        className="mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{request.sender}</p>
                        <p className="text-gray-400 text-sm">Wants to be your friend</p>
                      </div>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            onRespondToRequest(request.sender, 'accepted');
                            // automatically switch to chat with the new friend
                            onSelectUser(request.sender);
                          }}
                          className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                        >
                          <FaCheck size={12} className="mr-1" />
                          Accept
                        </button>
                        <button
                          onClick={() => onRespondToRequest(request.sender, 'rejected')}
                          className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                        >
                          <FaTimes size={12} className="mr-1" />
                          Decline
                        </button>
                      </div>
                    )}
                    
                    {request.status !== 'pending' && (
                      <div className={`text-sm px-3 py-1 rounded-lg ${
                        request.status === 'accepted' 
                          ? 'bg-green-500/10 text-green-400' 
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {request.status === 'accepted' ? 'Accepted' : 'Declined'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* user info */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ProfilePicture 
              username={currentUser.username} 
              size="md" 
              status={userStatuses[currentUser.username] || 'online'} 
              className="mr-3"
              imageUrl={currentUser.profile_picture_url}
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{currentUser.username}</p>
              <p className="text-gray-400 text-sm capitalize">
                {userStatuses[currentUser.username] || 'online'}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenProfile}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600"
            title="Profile Settings"
          >
            <FaCog size={14} />
          </button>
        </div>
      </div>

      {/* friend settings modal */}
      <FriendSettingsModal
        isOpen={friendSettingsModal.isOpen}
        onClose={handleCloseFriendSettings}
        friendUsername={friendSettingsModal.friendUsername}
        currentUser={currentUser}
        onDeleteFriend={handleDeleteFriend}
        userStatuses={userStatuses}
      />
    </div>
  );
};

export default FriendsPanel; 