import React, { useState } from 'react';
import { FaTimes, FaCheck, FaSpinner } from 'react-icons/fa';

const ImageSelectionModal = ({ 
  isOpen, 
  onClose, 
  images = [], 
  onSelectImage,
  isLoading = false 
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [imageLoadStates, setImageLoadStates] = useState({});

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleImageLoad = (index) => {
    setImageLoadStates(prev => ({
      ...prev,
      [index]: { loaded: true, error: false }
    }));
  };

  const handleImageError = (index) => {
    setImageLoadStates(prev => ({
      ...prev,
      [index]: { loaded: false, error: true }
    }));
  };

  const handleSelectImage = () => {
    if (selectedImageIndex !== null && images[selectedImageIndex]) {
      onSelectImage(images[selectedImageIndex], selectedImageIndex);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* header */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white">Choose Your Profile Picture</h3>
              <p className="text-gray-400 mt-1">Select your favorite generated avatar</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700"
              disabled={isLoading}
            >
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
          {/* loading state */}
          {images.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-purple-600/20 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                  </div>
                </div>
                <h4 className="text-white font-semibold mb-2">Generating Your Profile Pictures</h4>
                <p className="text-gray-400">Creating 3 unique avatars based on your description...</p>
                <p className="text-gray-500 text-sm mt-2">This may take up to 30 seconds</p>
              </div>
            </div>
          ) : (
            /* images grid */
            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
                {images.map((image, index) => {
                  const loadState = imageLoadStates[index] || { loaded: false, error: false };
                  const isSelected = selectedImageIndex === index;
                  const isHovered = hoveredIndex === index;

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center space-y-4"
                    >
                      {/* circular image container */}
                      <div
                        className="relative cursor-pointer transition-all duration-300"
                        onClick={() => setSelectedImageIndex(index)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {/* outer ring/glow */}
                        <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                          isSelected 
                            ? 'ring-4 ring-purple-500 shadow-lg shadow-purple-500/50' 
                            : isHovered 
                              ? 'ring-2 ring-purple-400 shadow-md shadow-purple-400/30' 
                              : ''
                        }`} style={{ width: '192px', height: '192px' }} />
                        
                        {/* image circle */}
                        <div className="relative w-48 h-48 rounded-full overflow-hidden bg-gray-800 border-4 border-gray-700">
                          {/* loading state */}
                          {!loadState.loaded && !loadState.error && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                            </div>
                          )}
                          
                          {/* error state */}
                          {loadState.error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <FaTimes className="text-red-500 text-2xl mb-2" />
                              <p className="text-red-400 text-xs text-center px-4">Failed to load</p>
                            </div>
                          )}

                          {/* avatar image */}
                          {!loadState.error && (
                            <img
                              src={image.url}
                              alt={`Avatar option ${index + 1}`}
                              className={`w-full h-full object-cover transition-all duration-300 ${
                                loadState.loaded ? 'opacity-100' : 'opacity-0'
                              } ${isHovered ? 'brightness-110' : ''}`}
                              onLoad={() => handleImageLoad(index)}
                              onError={() => handleImageError(index)}
                            />
                          )}

                          {/* selection overlay */}
                          <div className={`absolute inset-0 bg-purple-600 transition-opacity duration-200 ${
                            isSelected 
                              ? 'bg-opacity-20' 
                              : 'bg-opacity-0'
                          }`} />
                        </div>
                      </div>

                      {/* image label */}
                      <div className="text-center">
                        <div className={`px-4 py-2 rounded-full transition-all duration-200 ${
                          isSelected 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          <span className="text-sm font-medium">
                            Option {index + 1}
                          </span>
                        </div>
                        {isSelected && (
                          <p className="text-purple-400 text-xs mt-2 font-medium">
                            ✓ Selected
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>

        {/* footer with action buttons */}
        <div className="p-6 border-t border-gray-700 bg-gray-800">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            
            <div className="text-center">
              {selectedImageIndex === null ? (
                <p className="text-gray-500 text-sm">
                  Select an avatar above to continue
                </p>
              ) : (
                <button
                  onClick={handleSelectImage}
                  disabled={isLoading}
                  className={`px-8 py-3 font-semibold rounded-lg transition-all duration-200 flex items-center ${
                    isLoading
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-3"></div>
                      Saving Your Avatar...
                    </>
                  ) : (
                    <>
                      <FaCheck className="mr-2" />
                      Set as My Profile Picture
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageSelectionModal;