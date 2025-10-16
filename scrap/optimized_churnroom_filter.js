/**
 * ChurnRoom Optimized Filtering Solution
 * 
 * Based on analysis of Claude's retransmission behavior:
 * - 66% duplication rate (23/35 transmissions were duplicates)  
 * - Retransmissions occur after 35+ minute delays
 * - Both user commands and Claude responses are retransmitted
 * - Need to preserve legitimate musical command repeats while blocking UI noise
 */

class ChurnRoomFilter {
  constructor() {
    this.messageHistory = new Map(); // content -> {timestamp, count, role}
    this.sessionStart = Date.now();
    this.lastUserActivity = 0;
    this.legitimateRepeatWindow = 60000; // 60 seconds for legitimate repeats
    this.retransmissionThreshold = 300000; // 5 minutes - anything older is likely retransmission
    
    // Musical command patterns that can legitimately repeat
    this.musicalCommands = new Set([
      'PLAY:', 'SEQUENCE:', 'VOLUME:', 'PAUSE:', 'STOP:', 'NEXT:', 'PREV:'
    ]);
  }

  /**
   * Core filtering logic - decides whether to log a message
   * @param {string} content - Message content
   * @param {string} role - 'user' or 'assistant' 
   * @param {string} platform - 'claude', 'chatgpt', etc.
   * @returns {Object} - {shouldLog: boolean, reason: string, metadata: object}
   */
  shouldLogMessage(content, role, platform = 'claude') {
    const now = Date.now();
    const normalizedContent = this.normalizeContent(content);
    
    // Always allow first occurrence
    if (!this.messageHistory.has(normalizedContent)) {
      this.recordMessage(normalizedContent, now, role);
      return {
        shouldLog: true,
        reason: 'first_occurrence',
        metadata: { isRetransmission: false }
      };
    }

    const history = this.messageHistory.get(normalizedContent);
    const timeSince = now - history.timestamp;
    
    // Update user activity tracking
    if (role === 'user') {
      this.lastUserActivity = now;
    }

    // LEGITIMATE REPEAT SCENARIOS (always allow)
    
    // 1. Recent musical commands (ChurnRoom's primary use case)
    if (this.isMusicalCommand(normalizedContent) && timeSince < this.legitimateRepeatWindow) {
      history.count++;
      return {
        shouldLog: true,
        reason: 'legitimate_musical_repeat',
        metadata: { 
          isRetransmission: false, 
          repeatCount: history.count,
          timeSince: timeSince 
        }
      };
    }
    
    // 2. Quick conversational back-and-forth (within 30 seconds)
    if (timeSince < 30000 && this.hasRecentUserActivity(now)) {
      history.count++;
      return {
        shouldLog: true,
        reason: 'conversational_flow',
        metadata: { 
          isRetransmission: false, 
          repeatCount: history.count,
          timeSince: timeSince 
        }
      };
    }

    // RETRANSMISSION SCENARIOS (block these)
    
    // 3. Old messages without recent user activity (Claude's retransmission pattern)
    if (timeSince > this.retransmissionThreshold && !this.hasRecentUserActivity(now)) {
      return {
        shouldLog: false,
        reason: 'historical_retransmission',
        metadata: { 
          isRetransmission: true, 
          timeSince: timeSince,
          ageMinutes: Math.round(timeSince / 60000)
        }
      };
    }
    
    // 4. Assistant responses without recent user interaction
    if (role === 'assistant' && (now - this.lastUserActivity) > 120000) {
      return {
        shouldLog: false,
        reason: 'orphaned_assistant_response',
        metadata: { 
          isRetransmission: true, 
          timeSinceUserActivity: now - this.lastUserActivity 
        }
      };
    }
    
    // 5. Exact duplicates within medium timeframe (likely UI retransmission)
    if (timeSince > 60000 && timeSince < this.retransmissionThreshold) {
      return {
        shouldLog: false,
        reason: 'medium_term_duplicate',
        metadata: { 
          isRetransmission: true, 
          timeSince: timeSince 
        }
      };
    }

    // Default: Allow with caution
    history.count++;
    return {
      shouldLog: true,
      reason: 'default_allow',
      metadata: { 
        isRetransmission: false, 
        repeatCount: history.count,
        timeSince: timeSince 
      }
    };
  }

  /**
   * Check if content represents a musical command that can legitimately repeat
   */
  isMusicalCommand(content) {
    const upperContent = content.toUpperCase();
    return Array.from(this.musicalCommands).some(cmd => upperContent.includes(cmd));
  }

  /**
   * Check if there has been recent user activity (indicating active session)
   */
  hasRecentUserActivity(now) {
    return (now - this.lastUserActivity) < 120000; // 2 minutes
  }

  /**
   * Normalize message content for comparison
   */
  normalizeContent(content) {
    return content
      .replace(/\u200B/g, '') // Remove zero-width spaces
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim();
  }

  /**
   * Record message in history
   */
  recordMessage(content, timestamp, role) {
    this.messageHistory.set(content, {
      timestamp: timestamp,
      count: 1,
      role: role
    });
  }

  /**
   * Clean up old history entries to prevent memory bloat
   */
  cleanupHistory() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [content, data] of this.messageHistory.entries()) {
      if (data.timestamp < cutoff) {
        this.messageHistory.delete(content);
      }
    }
  }

  /**
   * Get filtering statistics
   */
  getStats() {
    return {
      totalMessages: this.messageHistory.size,
      sessionDuration: Date.now() - this.sessionStart,
      lastUserActivity: this.lastUserActivity,
      memoryEntries: this.messageHistory.size
    };
  }
}

// Example usage for ChurnRoom integration:
/*
const filter = new ChurnRoomFilter();

// Musical command - should allow repeats
const playCmd = filter.shouldLogMessage('PLAY: song1.mp3', 'user', 'claude');
console.log(playCmd); // {shouldLog: true, reason: 'first_occurrence'}

// Same command 30 seconds later - should allow (legitimate repeat)
setTimeout(() => {
  const playRepeat = filter.shouldLogMessage('PLAY: song1.mp3', 'user', 'claude');
  console.log(playRepeat); // {shouldLog: true, reason: 'legitimate_musical_repeat'}
}, 30000);

// Same command 10 minutes later without user activity - should block (retransmission)
setTimeout(() => {
  const oldRetrans = filter.shouldLogMessage('PLAY: song1.mp3', 'user', 'claude');
  console.log(oldRetrans); // {shouldLog: false, reason: 'historical_retransmission'}
}, 600000);
*/

module.exports = ChurnRoomFilter;