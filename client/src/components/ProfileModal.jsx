import React, { useState, useEffect } from 'react';
import { FaUser, FaEdit, FaTimes, FaBell, FaCheck, FaPlus, FaTrash, FaCircle, FaCamera } from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';
import ImageSelectionModal from './ImageSelectionModal';

const ProfileModal = ({ 
  user, 
  isOpen, 
  onClose, 
  onUpdateProfile,
  onUpdateStatus,
  onUpdateDescription,
  currentInterests = [],
  onLogout,
  userStatuses = {} // add userStatuses prop
}) => {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'interests', 'notifications'
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(user?.description || '');
  // use real-time status from userStatuses, fallback to user.status
  const currentStatus = userStatuses[user?.username] || user?.status || 'offline';
  const [status, setStatus] = useState(currentStatus);
  const [userInterests, setUserInterests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [isSavingImage, setIsSavingImage] = useState(false);

  // ============================================================================
  // STATE AND CONFIGURATION
  // ============================================================================

  const statusOptions = [
    { value: 'online', label: 'Online', color: 'text-green-400' },
    { value: 'away', label: 'Away', color: 'text-yellow-400' },
    { value: 'dnd', label: 'Do Not Disturb', color: 'text-red-400' },
    { value: 'offline', label: 'Offline', color: 'text-gray-400' }
  ];

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // sync local status state with real-time userStatuses
  useEffect(() => {
    const realTimeStatus = userStatuses[user?.username] || user?.status || 'offline';
    setStatus(realTimeStatus);
  }, [userStatuses, user?.username, user?.status]);

  // load user interests on mount
  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
      loadUserInterests();
      loadNotifications();
    }
  }, [isOpen, user]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  const loadUserProfile = async () => {
    try {
      const response = await fetch(`https://localhost:5000/api/users/profile/${user.username}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const profileData = await response.json();
        // update the description state with fetched data
        if (profileData.description) {
          setDescription(profileData.description);
        }
        // update profile picture url
        if (profileData.profile_picture_url) {
          setProfilePictureUrl(profileData.profile_picture_url);
        }
      }
    } catch (error) {
      // error loading user profile
    }
  };

  const loadUserInterests = async () => {
    try {
      const response = await fetch(`https://localhost:5000/api/user-interests/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserInterests(data.map(item => item.interest_name || item.name));
      }
    } catch (error) {
      // error loading user interests
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch(`https://localhost:5000/api/friend-requests/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      // error loading notifications
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleUpdateStatus = async (newStatus) => {
    setIsLoading(true);
    
    // optimistically update the ui to prevent flicker
    setStatus(newStatus);
    
    try {
      const response = await fetch(`https://localhost:5000/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        const responseData = await response.json();
        
        // call the parent callback to update the global state
        onUpdateStatus?.(newStatus);
        
        // also emit via socket for real-time updates
        if (window.socket) {
          window.socket.emit('updateStatus', { status: newStatus });
        }
      } else {
        const errorData = await response.text();
        
        // revert the optimistic update on error
        const realTimeStatus = userStatuses[user?.username] || user?.status || 'offline';
        setStatus(realTimeStatus);
      }
    } catch (error) {
      // revert the optimistic update on error
      const realTimeStatus = userStatuses[user?.username] || user?.status || 'offline';
      setStatus(realTimeStatus);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDescription = async () => {
    if (!description.trim()) {
      alert('Description cannot be empty');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://localhost:5000/api/users/${user.id}/description`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description: description.trim() })
      });
      
      if (response.ok) {
        setIsEditingDescription(false);
        // update local state
        setDescription(description.trim());
        // call parent callback if provided
        onUpdateDescription?.(description.trim());
      } else {
        const errorData = await response.text();
        alert('Failed to update description. Please try again.');
      }
    } catch (error) {
      alert('Failed to update description. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddInterest = async (interest) => {
    if (userInterests.length >= 3) {
      alert('You can only have up to 3 interests');
      return;
    }
    
    setIsLoading(true);
    try {
      // First, get the interest ID by name
      const interestsResponse = await fetch('https://localhost:5000/api/interests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (interestsResponse.ok) {
        const interests = await interestsResponse.json();
        const interestObj = interests.find(i => i.name === interest);
        
        if (interestObj) {
          const response = await fetch(`https://localhost:5000/api/user-interests/${user.id}/${interestObj.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            setUserInterests(prev => [...prev, interest]);
            // onAddInterest?.(interest); // This line is removed as per the edit hint
          }
        }
      }
    } catch (error) {
      // error adding interest
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveInterest = async (interest) => {
    setIsLoading(true);
    try {
      // First, get the interest ID by name
      const interestsResponse = await fetch('https://localhost:5000/api/interests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (interestsResponse.ok) {
        const interests = await interestsResponse.json();
        const interestObj = interests.find(i => i.name === interest);
        
        if (interestObj) {
          const response = await fetch(`https://localhost:5000/api/user-interests/${user.id}/${interestObj.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            setUserInterests(prev => prev.filter(i => i !== interest));
            // onRemoveInterest?.(interest); // This line is removed as per the edit hint
          }
        }
      }
    } catch (error) {
      // error removing interest
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId, response) => {
    setIsLoading(true);
    try {
      const apiResponse = await fetch('https://localhost:5000/api/friend-requests', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId,
          status: response,
          receiver_id: user.id
        })
      });
      
      if (apiResponse.ok) {
        // remove the notification from the list
        setNotifications(prev => prev.filter(n => n.id !== requestId));
        // reload notifications
        loadNotifications();
      }
    } catch (error) {
      // error responding to friend request
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProfilePicture = async () => {
    if (!user || !user.id) {
      alert('User data not available. Please refresh the page and try again.');
      return;
    }

    if (!description || description.trim().length === 0) {
      alert('Please add a description to your profile before generating an image.');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImages([]);
    setShowImageSelection(true);
    
    try {
      const response = await fetch('https://localhost:5000/api/images/generate-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quality: 'standard',
          size: '1024x1024'
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
          setGeneratedImages(data.images);
        } else {
          alert('Images generated but not received. Please try again.');
          setShowImageSelection(false);
        }
      } else {
        let errorMessage = 'Failed to generate images';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || 'Unknown error occurred';
        } catch (parseError) {
          // failed to parse error response
        }
        alert(`Failed to generate profile pictures: ${errorMessage}`);
        setShowImageSelection(false);
      }
    } catch (error) {
      alert('An error occurred while generating profile pictures. Please try again.');
      setShowImageSelection(false);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSelectImage = async (selectedImage, imageIndex) => {
    if (!selectedImage || !selectedImage.url) {
      alert('Invalid image selection. Please try again.');
      return;
    }

    setIsSavingImage(true);
    
    try {
      const response = await fetch('https://localhost:5000/api/images/save-selected', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl: selectedImage.url,
          revisedPrompt: selectedImage.revised_prompt
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // close the selection modal
        setShowImageSelection(false);
        setGeneratedImages([]);
        
        // close the profile modal
        onClose();
        
        // reload the page to update all components with the new image
        window.location.reload();
      } else {
        let errorMessage = 'Failed to save selected image';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || 'Unknown error occurred';
        } catch (parseError) {
          // failed to parse error response
        }
        alert(`Failed to save selected image: ${errorMessage}`);
      }
    } catch (error) {
      alert('An error occurred while saving the selected image. Please try again.');
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleCloseImageSelection = () => {
    setShowImageSelection(false);
    setGeneratedImages([]);
    setIsGeneratingImage(false);
    setIsSavingImage(false);
  };

  const handleDeleteAccount = async () => {
    if (!user || !user.id) {
      alert('User data not available. Please refresh the page and try again.');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`https://localhost:5000/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // clear all local storage
        localStorage.clear();
        
        // close the modal first
        onClose();
        
        // call logout to handle cleanup and redirect
        onLogout();
        
        // force redirect to login page
        window.location.href = '/';
      } else {
        let errorMessage = 'Unknown error occurred';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || 'Unknown error';
        } catch (parseError) {
          // failed to parse error response
        }
        alert(`Failed to delete account: ${errorMessage}`);
      }
    } catch (error) {
      alert('An error occurred while deleting account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <>
      {/* image selection modal */}
      <ImageSelectionModal
        isOpen={showImageSelection}
        onClose={handleCloseImageSelection}
        images={generatedImages}
        onSelectImage={handleSelectImage}
        isLoading={isSavingImage}
      />

      {/* main profile modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* header */}
        <div className="p-6 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* tab navigation */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-purple-600 text-white border-b-2 border-purple-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaUser className="inline mr-2" size={14} />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('interests')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'interests'
                ? 'bg-purple-600 text-white border-b-2 border-purple-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaEdit className="inline mr-2" size={14} />
            Interests
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'notifications'
                ? 'bg-purple-600 text-white border-b-2 border-purple-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaBell className="inline mr-2" size={14} />
            Notifications ({notifications.length})
          </button>
        </div>

        {/* tab content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* user info */}
              <div className="flex items-center space-x-4">
                <ProfilePicture 
                  username={user?.username} 
                  size="2xl" 
                  status={userStatuses[user?.username] || user?.status || 'online'}
                  imageUrl={profilePictureUrl}
                />
                <div>
                  <h3 className="text-xl font-semibold text-white">{user?.username}</h3>
                  <p className="text-gray-400">{user?.email}</p>
                </div>
              </div>

              {/* status */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleUpdateStatus(option.value)}
                      disabled={isLoading}
                      className={`p-3 rounded-lg border transition-all ${
                        status === option.value
                          ? 'border-purple-500 bg-purple-600 text-white'
                          : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center">
                        <FaCircle size={12} className={`mr-2 ${option.color}`} />
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Description
                </label>
                {isEditingDescription ? (
                  <div className="space-y-3">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                      rows="3"
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        {description.length}/500 characters
                      </span>
                      {description.length > 450 && (
                        <span className="text-xs text-yellow-400">
                          {500 - description.length} characters remaining
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleUpdateDescription}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingDescription(false);
                          setDescription(user?.description || '');
                        }}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-300 bg-gray-800 p-4 rounded-lg min-h-[60px]">
                      {description ? description : 'No description set. Click "Edit Description" to add one!'}
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setIsEditingDescription(true)}
                        className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        <FaEdit size={14} className="mr-2" />
                        {description ? 'Edit Description' : 'Add Description'}
                      </button>
                      <button
                        onClick={handleGenerateProfilePicture}
                        disabled={isGeneratingImage || !description}
                        className={`flex items-center px-4 py-2 ${
                          isGeneratingImage || !description
                            ? 'bg-gray-600 cursor-not-allowed opacity-50'
                            : 'bg-purple-600 hover:bg-purple-700'
                        } text-white rounded-lg transition-colors`}
                        title={!description ? 'Please add a description first' : ''}
                      >
                        <FaCamera size={14} className="mr-2" />
                        {isGeneratingImage ? 'Generating Image...' : 'Generate Profile Picture'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* logout section */}
              <div className="pt-6 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {activeTab === 'interests' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Your Interests ({currentInterests.filter(interest => interest.toLowerCase() !== 'fallback').length}/3)
                </h3>
                
                {/* current interests */}
                {currentInterests.filter(interest => interest.toLowerCase() !== 'fallback').length > 0 ? (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Current Interests:</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentInterests
                        .filter(interest => interest.toLowerCase() !== 'fallback')
                        .map((interest) => (
                        <span
                          key={interest}
                          className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-sm rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-4">
                      <FaEdit size={48} className="mx-auto" />
                    </div>
                    <p className="text-gray-400">No interests selected</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Select interests in the matchmaking section to see them here
                    </p>
                  </div>
                )}

                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">How to update interests:</h4>
                  <p className="text-gray-400 text-sm">
                    Go to the "Start a Random Chat" section and select your interests there. 
                    Your selected interests will be reflected here automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">
                Friend Requests
              </h3>
              
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <FaBell size={48} className="text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">
                            {notification.sender_username || notification.sender_name}
                          </p>
                          <p className="text-gray-400 text-sm">
                            wants to be your friend
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleRespondToRequest(notification.id, 'accepted')}
                            disabled={isLoading}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                          >
                            <FaCheck size={12} />
                          </button>
                          <button
                            onClick={() => handleRespondToRequest(notification.id, 'rejected')}
                            disabled={isLoading}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* danger zone - only show in profile tab */}
          {activeTab === 'profile' && (
          <div className="mt-8 pt-6 border-t border-gray-700">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <h3 className="text-red-400 font-semibold mb-2 flex items-center">
                <FaTrash className="mr-2" size={16} />
                Danger Zone
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Delete Account
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-800/20 border border-red-400/30 rounded-lg p-3">
                    <p className="text-red-300 font-medium mb-1">
                      ⚠️ This action is not reversible!
                    </p>
                    <p className="text-gray-300 text-sm">
                      Your account, messages, friends, and all data will be permanently deleted.
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      No, Keep My Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default ProfileModal; 