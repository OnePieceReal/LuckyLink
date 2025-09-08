import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes, FaRandom, FaGift, FaSpinner } from 'react-icons/fa';
import giphyService from '../services/giphyService';

const GiphyModal = ({ isOpen, onClose, onGifSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trending'); // trending, search, stickers, categories
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories] = useState(giphyService.getPopularCategories());
  const searchInputRef = useRef(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (isOpen) {
      // load trending gifs when modal opens
      loadTrendingGifs();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      // reset state when modal closes
      setSearchTerm('');
      setActiveTab('trending');
      setError(null);
      setSelectedCategory(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // debounced search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchTerm.trim() && activeTab === 'search') {
      const timeout = setTimeout(() => {
        if (activeTab === 'search') {
          searchGifs(searchTerm);
        }
      }, 500);
      setSearchTimeout(timeout);
    } else if (searchTerm.trim() && activeTab === 'stickers') {
      const timeout = setTimeout(() => {
        if (activeTab === 'stickers') {
          searchStickers(searchTerm);
        }
      }, 500);
      setSearchTimeout(timeout);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm, activeTab]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  const loadTrendingGifs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const trendingGifs = await giphyService.getTrendingGifs(20);
      setGifs(trendingGifs);
      if (trendingGifs.length === 0) {
        setError('No trending GIFs available');
      }
    } catch (error) {
      setError('Failed to load trending GIFs. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrendingStickers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const trendingStickers = await giphyService.getTrendingStickers(20);
      setGifs(trendingStickers);
      if (trendingStickers.length === 0) {
        setError('No trending stickers available');
      }
    } catch (error) {
      setError('Failed to load trending stickers. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const searchResults = await giphyService.searchGifs(query, 20);
      setGifs(searchResults);
      if (searchResults.length === 0) {
        setError(`No GIFs found for "${query}"`);
      }
    } catch (error) {
      setError('Failed to search GIFs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const searchStickers = async (query) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const searchResults = await giphyService.searchStickers(query, 20);
      setGifs(searchResults);
      if (searchResults.length === 0) {
        setError(`No stickers found for "${query}"`);
      }
    } catch (error) {
      setError('Failed to search stickers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRandomGif = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const randomGif = await giphyService.getRandomGif(searchTerm || 'funny');
      if (randomGif) {
        setGifs([randomGif]);
      } else {
        setError('No random GIF available');
      }
    } catch (error) {
      setError('Failed to get random GIF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryGifs = async (categoryId) => {
    setIsLoading(true);
    setError(null);
    try {
      const categoryGifs = await giphyService.getGifsByCategory(categoryId, 20);
      setGifs(categoryGifs);
      if (categoryGifs.length === 0) {
        setError(`No GIFs found for ${categoryId}`);
      }
    } catch (error) {
      setError('Failed to load category GIFs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryStickers = async (categoryId) => {
    setIsLoading(true);
    setError(null);
    try {
      const categoryStickers = await giphyService.getStickersByCategory(categoryId, 20);
      setGifs(categoryStickers);
      if (categoryStickers.length === 0) {
        setError(`No stickers found for ${categoryId}`);
      }
    } catch (error) {
      setError('Failed to load category stickers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setError(null);
    setSelectedCategory(null);
    
    if (tab === 'trending') {
      loadTrendingGifs();
    } else if (tab === 'stickers') {
      loadTrendingStickers();
    } else if (tab === 'random') {
      getRandomGif();
    } else if (tab === 'categories') {
      // show categories grid - no initial load
      setGifs([]);
    }
    // for 'search' tab, wait for user input
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    if (activeTab === 'stickers') {
      loadCategoryStickers(categoryId);
    } else {
      loadCategoryGifs(categoryId);
    }
  };

  const handleGifSelect = (gif) => {
    // send the gif url that will be detected by formatMessage
    onGifSelect(gif.url);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-gray-900 rounded-lg w-full max-w-4xl h-3/4 max-h-[600px] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FaGift className="text-purple-500 text-xl" />
            <h2 className="text-xl font-semibold text-white">GIFs & Stickers</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => handleTabChange('trending')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'trending' 
                ? 'text-purple-500 border-b-2 border-purple-500 bg-gray-800' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>🔥</span>
            <span>Trending</span>
          </button>
          <button
            onClick={() => handleTabChange('search')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'search' 
                ? 'text-purple-500 border-b-2 border-purple-500 bg-gray-800' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FaSearch />
            <span>Search</span>
          </button>
          <button
            onClick={() => handleTabChange('stickers')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'stickers' 
                ? 'text-purple-500 border-b-2 border-purple-500 bg-gray-800' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>😀</span>
            <span>Stickers</span>
          </button>
          <button
            onClick={() => handleTabChange('categories')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'categories' 
                ? 'text-purple-500 border-b-2 border-purple-500 bg-gray-800' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>📁</span>
            <span>Categories</span>
          </button>
          <button
            onClick={() => handleTabChange('random')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'random' 
                ? 'text-purple-500 border-b-2 border-purple-500 bg-gray-800' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FaRandom />
            <span>Random</span>
          </button>
        </div>

        {/* search bar */}
        {(activeTab === 'search' || activeTab === 'stickers') && (
          <div className="p-4 border-b border-gray-700">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search for ${activeTab === 'stickers' ? 'stickers' : 'GIFs'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'categories' && !selectedCategory ? (
            /* categories grid */
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-white mb-2">Popular Categories</h3>
                <p className="text-gray-400 text-sm">Choose a category to browse GIFs{activeTab === 'stickers' ? ' and stickers' : ''}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all duration-200 text-center group border border-gray-700 hover:border-purple-500"
                  >
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">
                      {category.emoji}
                    </div>
                    <div className="text-white text-sm font-medium">
                      {category.name.replace(/^[^\s]+ /, '')} {/* remove emoji from name */}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FaSpinner className="animate-spin text-purple-500 text-3xl mb-4 mx-auto" />
                <p className="text-gray-400">Loading...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-400 text-6xl mb-4">⚠️</div>
                <p className="text-red-400 font-medium mb-2">Error</p>
                <p className="text-gray-400 text-sm">{error}</p>
                <button
                  onClick={() => selectedCategory ? handleCategorySelect(selectedCategory) : handleTabChange(activeTab)}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : gifs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {activeTab === 'search' ? 
                'Search for GIFs to get started!' : 
                activeTab === 'stickers' ?
                'Search for stickers or view trending ones!' :
                'No content available'
              }
            </div>
          ) : (
            <div>
              {/* back button for categories */}
              {activeTab === 'categories' && selectedCategory && (
                <div className="mb-4">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setGifs([]);
                    }}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <span>←</span>
                    <span>Back to Categories</span>
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {gifs.map((gif) => (
                  <div
                    key={gif.id}
                    onClick={() => handleGifSelect(gif)}
                    className="cursor-pointer group relative overflow-hidden rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 aspect-square"
                    title={gif.title}
                  >
                    <img
                      src={gif.previewUrl}
                      alt={gif.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      onError={(e) => {
                        // fallback to regular url if preview fails
                        e.target.src = gif.url;
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <FaGift className="text-white text-2xl drop-shadow-lg" />
                      </div>
                    </div>
                    {/* sticker indicator */}
                    {gif.isSticker && (
                      <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                        Sticker
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800">
          <p className="text-center text-xs text-gray-500">
            Powered by GIPHY • Click a GIF to send it
          </p>
        </div>
      </div>
    </div>
  );
};

export default GiphyModal;
