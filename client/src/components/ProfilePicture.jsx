import React, { useState, useEffect } from 'react';
import { FaCircle } from 'react-icons/fa';

// ============================================================================
// CACHE AND CONFIGURATION
// ============================================================================

// cache for profile pictures to prevent re-fetching
const profilePictureCache = new Map();

// expose cache globally for cache clearing
if (typeof window !== 'undefined') {
  window.profilePictureCache = profilePictureCache;
}

const ProfilePicture = ({ 
  username, 
  size = 'md', 
  status = 'online',
  className = '',
  showStatus = true,
  imageUrl = null // add imageUrl prop
}) => {
  const [profileImageUrl, setProfileImageUrl] = useState(imageUrl);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!imageUrl); // track loading state

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // fetch profile picture url if not provided
  useEffect(() => {
    if (!imageUrl && username && !imageError) {
      // check cache first
      const cachedUrl = profilePictureCache.get(username);
      if (cachedUrl) {
        setProfileImageUrl(cachedUrl);
        setIsLoading(false);
        return;
      }

      const fetchProfilePicture = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`https://localhost:5000/api/users/profile/${username}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.profile_picture_url) {
              setProfileImageUrl(data.profile_picture_url);
              // store in cache
              profilePictureCache.set(username, data.profile_picture_url);
            }
          }
        } catch (error) {
          // error fetching profile picture
        } finally {
          setIsLoading(false);
        }
      };

      fetchProfilePicture();
    }
  }, [username, imageUrl, imageError]);

  // update when imageUrl prop changes
  useEffect(() => {
    if (imageUrl) {
      setProfileImageUrl(imageUrl);
      setImageError(false);
      setIsLoading(false);
      // update cache when we get a url from props
      if (username) {
        profilePictureCache.set(username, imageUrl);
      }
    }
  }, [imageUrl, username]);

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  // size configurations
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-12 h-12 text-lg',
    '2xl': 'w-16 h-16 text-xl'
  };

  // status color configurations
  const statusColors = {
    online: 'text-green-400',
    away: 'text-yellow-400',
    dnd: 'text-red-400',
    offline: 'text-gray-400',
    invisible: 'text-gray-400'
  };

  // status indicator size configurations
  const indicatorSizes = {
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
    '2xl': 16
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const handleImageError = () => {
    setImageError(true);
    setProfileImageUrl(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`relative inline-block ${className}`}>
      {/* profile picture */}
      {profileImageUrl && !imageError && !isLoading ? (
        <img 
          src={profileImageUrl}
          alt={username}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-purple-500`}
          onError={handleImageError}
        />
      ) : (
        <div className={`${sizeClasses[size]} bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold`}>
          {getInitials(username)}
        </div>
      )}
      
      {/* presence indicator */}
      {showStatus && (
        <div 
          className="absolute bottom-0 right-0 transform translate-x-1/4 translate-y-1/4"
          style={{
            width: `${indicatorSizes[size]}px`,
            height: `${indicatorSizes[size]}px`
          }}
        >
          <FaCircle 
            size={indicatorSizes[size]} 
            className={`${statusColors[status]} drop-shadow-sm`}
            style={{
              filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePicture; 