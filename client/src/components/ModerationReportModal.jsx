import React, { useState, useEffect } from 'react';
import { FaTimes, FaFlag, FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

const ModerationReportModal = ({ 
  isOpen, 
  onClose, 
  moderationData, 
  chatHistory,
  currentUser,
  isRandomChatActive,
  onReport,
  hasAlreadyReported = false
}) => {
  const [isReporting, setIsReporting] = useState(false);
  const [reportCompleted, setReportCompleted] = useState(false);
  const [hasReported, setHasReported] = useState(hasAlreadyReported);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // update hasReported when prop changes
  useEffect(() => {
    setHasReported(hasAlreadyReported);
    if (hasAlreadyReported) {
      setReportCompleted(true);
    }
  }, [hasAlreadyReported]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  if (!isOpen || !moderationData) {
    return null;
  }

  // check if this is a per-user analysis report or old format
  const isPerUserAnalysis = moderationData.currentUserAnalysis && moderationData.otherUserAnalysis;
  
  // for backward compatibility, handle both formats
  const displayData = isPerUserAnalysis ? moderationData.otherUserAnalysis : moderationData;
  const { flagged, categories, categoryScores, allScores, severity, recommendation } = displayData;
  
  // get the other user from chat history
  const otherUser = chatHistory?.username;
  
  // check if content is toxic (flagged)
  const isToxic = flagged || severity > 0.7;
  
  // determine if user can report - use per-user analysis if available
  const canReport = isPerUserAnalysis ? 
    (moderationData.canReport && !isRandomChatActive && !hasReported && !reportCompleted) :
    (isToxic && !isRandomChatActive && !hasReported && !reportCompleted);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleReport = async () => {
    if (!canReport || isReporting || hasAlreadyReported) return;
    
    setIsReporting(true);
    try {
      await onReport({
        reportedUser: otherUser,
        chatHistory: chatHistory,
        moderationData: moderationData
      });
      setReportCompleted(true);
      setHasReported(true);
    } catch (error) {
      // failed to report user
    } finally {
      setIsReporting(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getScoreColor = (score) => {
    if (score > 0.8) return 'text-red-400';
    if (score > 0.6) return 'text-yellow-400';
    if (score > 0.4) return 'text-orange-400';
    return 'text-green-400';
  };

  const getScoreBg = (score) => {
    if (score > 0.8) return 'bg-red-500/20 border-red-500/30';
    if (score > 0.6) return 'bg-yellow-500/20 border-yellow-500/30';
    if (score > 0.4) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-green-500/20 border-green-500/30';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${isToxic ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {isToxic ? (
                <FaExclamationTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <FaCheck className="w-5 h-5 text-green-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Moderation Report</h2>
              <p className="text-sm text-gray-400">
                Chat with {otherUser} • {new Date(chatHistory?.timestamp).toLocaleDateString()}
                {isPerUserAnalysis ? (
                  <span className="ml-2">• Analyzed messages from both users</span>
                ) : moderationData.batchMode && (
                  <span className="ml-2">• {moderationData.totalMessages} messages analyzed</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* per-user analysis section */}
          {isPerUserAnalysis && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">User Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* current user analysis */}
                <div className={`p-4 rounded-lg border ${
                  moderationData.currentUserAnalysis.severity > 0.3 
                    ? 'bg-yellow-500/10 border-yellow-500/30' 
                    : 'bg-green-500/10 border-green-500/30'
                }`}>
                  <h4 className="font-medium text-gray-300 mb-2">Your Messages</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {moderationData.currentUserAnalysis.totalMessages} messages
                    </span>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        moderationData.currentUserAnalysis.severity > 0.3 
                          ? 'text-yellow-400' 
                          : 'text-green-400'
                      }`}>
                        {Math.round(moderationData.currentUserAnalysis.severity * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">Toxicity</div>
                    </div>
                  </div>
                  {moderationData.currentUserAnalysis.flaggedCount > 0 && (
                    <p className="text-xs text-yellow-400 mt-2">
                      {moderationData.currentUserAnalysis.flaggedCount} flagged messages
                    </p>
                  )}
                </div>
                
                {/* other user analysis */}
                <div className={`p-4 rounded-lg border ${
                  moderationData.otherUserAnalysis.severity > 0.6 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : moderationData.otherUserAnalysis.severity > 0.3
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}>
                  <h4 className="font-medium text-gray-300 mb-2">{otherUser}'s Messages</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {moderationData.otherUserAnalysis.totalMessages} messages
                    </span>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        moderationData.otherUserAnalysis.severity > 0.6 
                          ? 'text-red-400' 
                          : moderationData.otherUserAnalysis.severity > 0.3
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }`}>
                        {Math.round(moderationData.otherUserAnalysis.severity * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">Toxicity</div>
                    </div>
                  </div>
                  {moderationData.otherUserAnalysis.flaggedCount > 0 && (
                    <p className="text-xs text-red-400 mt-2">
                      {moderationData.otherUserAnalysis.flaggedCount} flagged messages
                    </p>
                  )}
                </div>
              </div>
              
              {/* report eligibility status */}
              {moderationData.canReport ? (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                  <p className="text-sm text-blue-300">
                    ✓ You can report this user: {moderationData.reportReason}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-gray-600/20 border border-gray-600/30 rounded-lg mb-4">
                  <p className="text-sm text-gray-400">
                    Cannot report: {moderationData.reportReason}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* overall status (for other user's content) */}
          <div className={`p-4 rounded-lg border mb-6 ${
            isToxic ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold ${isToxic ? 'text-red-300' : 'text-green-300'}`}>
                  {isPerUserAnalysis ? 
                    `${otherUser}'s Content ${isToxic ? 'Flagged' : 'Clean'}` :
                    `${isToxic ? 'Content Flagged' : 'Content Clean'}`
                  }
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {recommendation || (isToxic ? 'This content may violate community guidelines.' : 'This content appears to be appropriate.')}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${isToxic ? 'text-red-400' : 'text-green-400'}`}>
                  {Math.round((severity || 0) * 100)}%
                </div>
                <div className="text-xs text-gray-500">Severity</div>
              </div>
            </div>
          </div>

          {/* flagged messages summary */}
          {displayData.flaggedMessages && displayData.flaggedMessages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                {isPerUserAnalysis ? `${otherUser}'s Flagged Messages` : 'Flagged Messages'}
              </h3>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-3">
                  {displayData.flaggedCount} of {displayData.totalMessages} messages were flagged
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {displayData.flaggedMessages.slice(0, 3).map((msg, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="text-gray-400">{msg.sender}:</span>
                      <span className="text-gray-300 ml-2">"{msg.message.substring(0, 50)}..."</span>
                    </div>
                  ))}
                  {displayData.flaggedMessages.length > 3 && (
                    <p className="text-gray-500 text-xs">
                      ...and {displayData.flaggedMessages.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              {isPerUserAnalysis ? `${otherUser}'s Category Analysis` : 'Category Analysis'}
            </h3>
            
            {/* define all possible categories */}
            {(() => {
              const allCategories = [
                'harassment',
                'harassment/threatening',
                'hate',
                'hate/threatening',
                'self-harm',
                'self-harm/intent',
                'self-harm/instructions',
                'sexual',
                'sexual/minors',
                'violence',
                'violence/graphic'
              ];
              
              return allCategories.map((category) => {
                const flagged = categories?.[category] || false;
                const score = (categoryScores || allScores)?.[category] || 0;
                const percentage = Math.round(score * 100);
                
                return (
                <div key={category} className={`p-4 rounded-lg border ${getScoreBg(score)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h4 className="font-medium text-white">
                          {category.split('/').map(part => 
                            part.charAt(0).toUpperCase() + part.slice(1)
                          ).join(' / ')}
                        </h4>
                        <p className="text-xs text-gray-400">
                          {flagged ? 'Flagged' : 'Not flagged'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                        {percentage}%
                      </div>
                      <div className="flex items-center space-x-2">
                        {flagged && (
                          <FaFlag className="w-3 h-3 text-red-400" />
                        )}
                        <div className={`w-12 h-2 bg-gray-700 rounded-full overflow-hidden`}>
                          <div 
                            className={`h-full transition-all duration-300 ${
                              score > 0.8 ? 'bg-red-500' :
                              score > 0.6 ? 'bg-yellow-500' :
                              score > 0.4 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })})()}
          </div>
        </div>

        {/* footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </div>
            
            {/* report button - show based on analysis */}
            {(isPerUserAnalysis ? moderationData.canReport : isToxic) && (
              <button
                onClick={handleReport}
                disabled={!canReport || isReporting}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  reportCompleted
                    ? 'bg-green-600 text-white cursor-default'
                    : !canReport
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500'
                }`}
              >
                {isReporting ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Reporting...</span>
                  </>
                ) : reportCompleted ? (
                  <>
                    <FaCheck className="w-4 h-4" />
                    <span>Reported</span>
                  </>
                ) : (
                  <>
                    <FaFlag className="w-4 h-4" />
                    <span>
                      {!canReport && isRandomChatActive 
                        ? 'Cannot report during active chat' 
                        : !canReport && isPerUserAnalysis
                        ? 'Cannot Report'
                        : 'Report User'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModerationReportModal;