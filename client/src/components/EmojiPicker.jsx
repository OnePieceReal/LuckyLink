import React, { useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';

const CustomEmojiPicker = ({ isOpen, onClose, onEmojiSelect, inputRef }) => {
  const pickerRef = useRef(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // handle clicking outside to close picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        // check if click was on the emoji button itself
        if (!event.target.closest('[data-emoji-button]')) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleEmojiClick = (emojiObject) => {
    // get the emoji character
    const emoji = emojiObject.emoji;
    
    // call the callback with the emoji
    onEmojiSelect(emoji);
    
    // keep focus on input after emoji selection
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-lg shadow-xl border border-gray-300"
      style={{ 
        // position above the input field
        transform: 'translateY(-8px)',
      }}
    >
      {/* client-side only rendering */}
      {typeof window !== "undefined" && (
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          searchPlaceholder="Search emojis..."
          theme="dark"
          emojiStyle="native"
          width={350}
          height={400}
          previewConfig={{
            showPreview: false
          }}
          skinTonesDisabled={true}
          searchDisabled={false}
          autoFocusSearch={true}
          lazyLoadEmojis={true}
          categories={[
            'smileys_people',
            'animals_nature', 
            'food_drink',
            'travel_places',
            'activities',
            'objects',
            'symbols',
            'flags'
          ]}
        />
      )}
    </div>
  );
};

export default CustomEmojiPicker;
