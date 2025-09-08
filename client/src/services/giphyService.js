import { GiphyFetch } from '@giphy/js-fetch-api';

class GiphyService {
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  constructor() {
    // initialize with api key from environment
    this.gf = new GiphyFetch(process.env.REACT_APP_GIPHY_API_KEY);
  }

  // ============================================================================
  // GIF METHODS
  // ============================================================================

  async getTrendingGifs(limit = 20, offset = 0) {
    try {
      const { data } = await this.gf.trending({ limit, offset, type: 'gifs' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  async searchGifs(query, limit = 20, offset = 0) {
    try {
      const { data } = await this.gf.search(query, { limit, offset, type: 'gifs' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  async getTrendingStickers(limit = 20, offset = 0) {
    try {
      const { data } = await this.gf.trending({ limit, offset, type: 'stickers' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  async searchStickers(query, limit = 20, offset = 0) {
    try {
      const { data } = await this.gf.search(query, { limit, offset, type: 'stickers' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  async getRandomGif(tag = '') {
    try {
      const { data } = await this.gf.random({ tag, type: 'gifs' });
      return this.formatSingleGif(data);
    } catch (error) {
      return null;
    }
  }

  async getGifsByCategory(category, limit = 20, offset = 0) {
    try {
      // use search with category as query term
      const { data } = await this.gf.search(category, { limit, offset, type: 'gifs' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  async getStickersByCategory(category, limit = 20, offset = 0) {
    try {
      // use search with category as query term for stickers
      const { data } = await this.gf.search(category, { limit, offset, type: 'stickers' });
      return this.formatGifData(data);
    } catch (error) {
      return [];
    }
  }

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  // popular gif categories
  getPopularCategories() {
    return [
      { id: 'reactions', name: '😂 Reactions', emoji: '😂' },
      { id: 'love', name: '❤️ Love', emoji: '❤️' },
      { id: 'happy', name: '😊 Happy', emoji: '😊' },
      { id: 'sad', name: '😢 Sad', emoji: '😢' },
      { id: 'angry', name: '😠 Angry', emoji: '😠' },
      { id: 'surprised', name: '😮 Surprised', emoji: '😮' },
      { id: 'thumbs up', name: '👍 Thumbs Up', emoji: '👍' },
      { id: 'facepalm', name: '🤦 Facepalm', emoji: '🤦' },
      { id: 'dance', name: '💃 Dance', emoji: '💃' },
      { id: 'yes', name: '✅ Yes', emoji: '✅' },
      { id: 'no', name: '❌ No', emoji: '❌' },
      { id: 'thinking', name: '🤔 Thinking', emoji: '🤔' },
      { id: 'clap', name: '👏 Applause', emoji: '👏' },
      { id: 'shrug', name: '🤷 Shrug', emoji: '🤷' },
      { id: 'cool', name: '😎 Cool', emoji: '😎' },
      { id: 'wink', name: '😉 Wink', emoji: '😉' }
    ];
  }

  // ============================================================================
  // DATA FORMATTING
  // ============================================================================

  // format gif data for consistent usage
  formatGifData(gifs) {
    return gifs.map(gif => this.formatSingleGif(gif));
  }

  formatSingleGif(gif) {
    return {
      id: gif.id,
      title: gif.title || 'GIF',
      url: gif.images.fixed_height.url, // medium size for chat
      originalUrl: gif.images.original.url, // full size
      previewUrl: gif.images.fixed_height_small.url, // small preview for grid
      webpUrl: gif.images.fixed_height.webp, // webp format for better performance
      width: parseInt(gif.images.fixed_height.width),
      height: parseInt(gif.images.fixed_height.height),
      isSticker: gif.type === 'sticker'
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // check if a url is a giphy url - updated to handle all formats
  static isGiphyUrl(url) {
    const giphyPatterns = [
      // standard giphy media urls
      /https:\/\/media\d*\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.gif/i,
      /https:\/\/media\d*\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.webp/i,
      /https:\/\/i\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.gif/i,
      /https:\/\/i\.giphy\.com\/media\/[^\/\s]+\/[^\/\s]*\.webp/i,
      // new format with version and query parameters
      /https:\/\/media\d*\.giphy\.com\/media\/v\d+\.[^\/\s]+\/[^\/\s]+\/\d+\.gif/i,
      /https:\/\/media\d*\.giphy\.com\/media\/v\d+\.[^\/\s]+\/[^\/\s]+\/\d+\.webp/i,
      // more general pattern for any giphy domain with gif/webp extension
      /https:\/\/[^\/\s]*\.?giphy\.com\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\.(gif|webp)/i,
      // catch any url containing giphy.com and ending with gif or webp
      /https:\/\/[^\/\s]*giphy\.com[^\/\s]*\.(gif|webp)/i
    ];
    
    const trimmedUrl = url.trim();
    const isGiphyUrl = giphyPatterns.some(pattern => pattern.test(trimmedUrl));
    
    // additional check: if the url contains 'giphy.com' and ends with .gif or .webp
    const isLikelyGiphyUrl = trimmedUrl.includes('giphy.com') && 
                           (trimmedUrl.includes('.gif') || trimmedUrl.includes('.webp'));
    
    return isGiphyUrl || isLikelyGiphyUrl;
  }
}

export default new GiphyService();
