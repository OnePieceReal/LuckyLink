import React, { useState, useEffect } from 'react';
import { FaTimes, FaTrash } from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';

const FriendSettingsModal = ({ 
  isOpen, 
  onClose, 
  friendUsername, 
  currentUser,
  onDeleteFriend,
  userStatuses = {}
}) => {
  const [friendData, setFriendData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  // load friend data
  const loadFriendData = async () => {
    if (!friendUsername || !isOpen) return;
    
    setIsLoading(true);
    try {
      // get friend profile data
      const profileResponse = await fetch(`https://localhost:5000/api/users/profile/${friendUsername}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        
        // get friend interests
        const interestsResponse = await fetch(`https://localhost:5000/api/user-interests/user/${profileData.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        let interests = [];
        if (interestsResponse.ok) {
          interests = await interestsResponse.json();
        }

        setFriendData({
          ...profileData,
          interests
        });
      }
    } catch (error) {
      // error loading friend data
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  // handle friend deletion
  const handleDeleteFriend = async () => {
    if (!friendData || !currentUser || !currentUser.id) {
      alert('Missing user data. Please try refreshing the page.');
      return;
    }
    
    setIsDeleting(true);
    try {
      // call the delete friend endpoint
      const response = await fetch(`https://localhost:5000/api/friends/${currentUser.id}/${friendData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        onDeleteFriend?.(friendUsername);
        onClose();
      } else {
        const errorData = await response.json();
        alert('Failed to delete friend. Please try again.');
      }
    } catch (error) {
      alert('An error occurred while deleting friend. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // format relative time
  const formatRelativeTime = (dateString, status) => {
    if (!dateString) return 'Unknown';
    
    // if user is currently online, show "Online now"
    if (status === 'online') return 'Online now';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    
    if (diffInMinutes < 5) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return formatDate(dateString);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadFriendData();
  }, [friendUsername, isOpen]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Friend Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* content */}
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading...</p>
            </div>
          ) : friendData ? (
            <div className="space-y-4">
              {/* friend profile */}
              <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                <ProfilePicture 
                  username={friendUsername} 
                  size="lg"
                  status={userStatuses[friendUsername] || 'offline'}
                />
                <div className="flex-1">
                  <h3 className="text-white font-medium">{friendUsername}</h3>
                  <p className="text-gray-400 text-sm capitalize">
                    {userStatuses[friendUsername] === 'dnd' ? 'Do Not Disturb' : userStatuses[friendUsername] || 'Offline'}
                  </p>
                </div>
              </div>

              {/* description */}
              {friendData.description && (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <h4 className="text-white font-medium mb-2">About</h4>
                  <p className="text-gray-300 text-sm">{friendData.description}</p>
                </div>
              )}

              {/* basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-700 rounded-lg text-center">
                  <p className="text-gray-400 text-xs">Joined</p>
                  <p className="text-white text-sm">{formatDate(friendData.created_at)}</p>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg text-center">
                  <p className="text-gray-400 text-xs">Last Seen</p>
                  <p className="text-white text-sm">{formatRelativeTime(friendData.last_active_at, userStatuses[friendUsername])}</p>
                </div>
              </div>

              {/* interests */}
              {friendData.interests && friendData.interests.filter(interest => interest.name.toLowerCase() !== 'fallback').length > 0 && (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {friendData.interests.filter(interest => interest.name.toLowerCase() !== 'fallback').map((interest) => (
                      <span key={interest.id} className="px-2 py-1 bg-gray-600 text-gray-200 text-xs rounded">
                        {interest.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Failed to load friend information</p>
            </div>
          )}
        </div>

        {/* footer */}
        {friendData && (
          <div className="p-4 border-t border-gray-700">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <FaTrash className="mr-2" size={14} />
                Delete Friend
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm text-center">
                  Are you sure? This will delete all messages and data.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleDeleteFriend}
                    disabled={isDeleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendSettingsModal;
