// Signal Processing Claude Logger - Multi-layer filtering for clean chat.log
(function() {
  'use strict';
  
  const LOGGER_NAME = '[SIGNAL PROCESSING LOGGER]';
  console.log(`${LOGGER_NAME} Initializing multi-layer signal processing filter...`);
  
  // Storage for conversation state and signal analysis
  const state = {
    // Message tracking
    processedMessages: new Map(),
    messageSequence: [],
    conversationHistory: [],
    
    // Signal processing buffers
    velocityBuffer: [], // Recent message timing analysis
    hashBuffer: [], // For autocorrelation pattern detection
    temporalWindow: [], // Conversation context window
    
    // User interaction tracking
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    
    // Filter statistics
    stats: {
      totalMessages: 0,
      filteredByVelocity: 0,
      filteredByTemporal: 0,
      filteredByEcho: 0,
      filteredByAutocorrelation: 0,
      preservedByContext: 0,
      cleanLogEntries: 0,
      verboseLogEntries: 0
    }
  };
  
  // Filter configuration
  const config = {
    // Velocity filter (bulk dump detection)
    velocityThreshold: 5, // Messages per second threshold
    velocityWindow: 1000, // 1 second window
    
    // Temporal filter (conversation window)
    conversationWindow: 300000, // 5 minutes
    userActivityWindow: 120000, // 2 minutes
    
    // Autocorrelation filter
    hashBufferSize: 20, // Track last 20 message hashes
    patternThreshold: 3, // 3+ consecutive old hashes = suspicious
    
    // Contextual preservation
    musicalCommandWindow: 60000, // 1 minute for musical repeats
    legitimateRepeatWindow: 30000, // 30 seconds for conversational repeats
    
    // Persistence validation
    persistenceThreshold: 500 // DOM persistence requirement
  };
  
  // Helper functions
  function normText(s) {
    return String(s || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Extract clean text avoiding phantom DOM elements like buttons/icons
   * This fixes the mysterious "J" prefix issue
   */
  function extractCleanText(element) {
    // If it's a direct text node or simple element, use textContent
    if (element.children.length === 0) {
      return normText(element.textContent || '');
    }
    
    // For complex elements, extract only visible text content
    let text = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip text from hidden elements or buttons
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_SKIP;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_SKIP;
          }
          
          // Skip button/icon elements that might contain single letters
          if (parent.tagName === 'BUTTON' || 
              parent.role === 'button' ||
              parent.classList.contains('icon') ||
              parent.classList.contains('btn') ||
              parent.getAttribute('aria-label') ||
              (parent.textContent && parent.textContent.trim().length === 1)) {
            return NodeFilter.FILTER_SKIP;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      text += node.textContent;
    }
    
    // Fallback to simple textContent if tree walker gave empty result
    if (!text.trim()) {
      text = element.textContent || '';
      // If we still get a single character that looks suspicious, try inner elements
      if (text.trim().length === 1 && /^[A-Z]$/.test(text.trim())) {
        const innerElements = element.querySelectorAll('div, p, span');
        if (innerElements.length > 0) {
          text = Array.from(innerElements)
            .map(el => el.textContent)
            .filter(t => t && t.length > 1)
            .join(' ');
        }
      }
    }
    
    return normText(text);
  }
  
  function getConvoId() {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const chatIndex = parts.indexOf('chat');
      if (chatIndex >= 0 && parts[chatIndex + 1]) return parts[chatIndex + 1];
      return parts[parts.length - 1] || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }
  
  function hashMessage(text, role) {
    // Simple hash function for message content
    let hash = 0;
    const str = `${role}:${text}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
  
  function extractUrls(text) {
    const urls = [];
    const matches = text.match(/https?:\/\/[^\s]+/g);
    if (matches) {
      matches.forEach(url => {
        const clean = url.replace(/[.,;!?)]+$/, '');
        if (!urls.includes(clean)) urls.push(clean);
      });
    }
    return urls;
  }
  
  /**
   * LAYER 1: VELOCITY FILTER - Detects bulk retransmission dumps
   * Flags suspiciously fast message bursts (>5 messages/second)
   */
  function velocityFilter(messageData) {
    const now = Date.now();
    
    // Add current message to velocity buffer
    state.velocityBuffer.push({
      timestamp: now,
      role: messageData.role,
      hash: messageData.hash
    });
    
    // Clean old entries (older than velocity window)
    state.velocityBuffer = state.velocityBuffer.filter(
      entry => now - entry.timestamp < config.velocityWindow
    );
    
    // Count messages in velocity window
    const messagesInWindow = state.velocityBuffer.length;
    const sameRoleInWindow = state.velocityBuffer.filter(
      entry => entry.role === messageData.role
    ).length;
    
    // Check for bulk dump pattern
    if (messagesInWindow > config.velocityThreshold) {
      console.log(`${LOGGER_NAME} 🚩 VELOCITY FILTER: ${messagesInWindow} messages in ${config.velocityWindow}ms`);
      
      // If most messages are from same role, likely bulk dump
      if (sameRoleInWindow >= config.velocityThreshold) {
        state.stats.filteredByVelocity++;
        return {
          filtered: true,
          reason: 'velocity_bulk_dump',
          details: `${messagesInWindow} messages in ${config.velocityWindow}ms, ${sameRoleInWindow} same role`
        };
      }
    }
    
    return { filtered: false };
  }
  
  /**
   * LAYER 2: TEMPORAL FILTER - Checks message age vs conversation context
   * Filters messages older than conversation window without recent user activity
   */
  function temporalFilter(messageData) {
    const now = Date.now();
    
    // Check if message relates to recent conversation context
    const timeSinceUserActivity = now - state.lastUserInteraction;
    const isOldMessage = state.processedMessages.has(messageData.text);
    
    if (isOldMessage) {
      const lastSeen = state.processedMessages.get(messageData.text);
      const messageAge = now - lastSeen;
      
      // If message is old and no recent user activity, likely historical
      if (messageAge > config.conversationWindow && 
          timeSinceUserActivity > config.userActivityWindow) {
        
        console.log(`${LOGGER_NAME} 🚩 TEMPORAL FILTER: Message age ${Math.round(messageAge/60000)}min, no user activity for ${Math.round(timeSinceUserActivity/60000)}min`);
        
        state.stats.filteredByTemporal++;
        return {
          filtered: true,
          reason: 'temporal_historical',
          details: `Message age: ${messageAge}ms, user inactive: ${timeSinceUserActivity}ms`
        };
      }
    }
    
    return { filtered: false };
  }
  
  /**
   * LAYER 2.5: ECHO DETECTION FILTER - Filters user input echoes
   * Detects when assistant messages exactly match recent user messages (Claude UI echo pattern)
   */
  function echoDetectionFilter(messageData) {
    const now = Date.now();
    
    // Only check assistant messages for echoes
    if (messageData.role !== 'assistant') {
      return { filtered: false };
    }
    
    // Look through recent conversation history for matching user messages
    for (const historyItem of state.conversationHistory.slice(-10)) {
      if (historyItem.role === 'user') {
        const timeDiff = now - historyItem.timestamp;
        
        // If assistant message exactly matches user message within 10 seconds, it's an echo
        if (timeDiff < 10000 && // 10 second window
            historyItem.text.trim() === messageData.text.trim()) {
          
          console.log(`${LOGGER_NAME} 🚩 ECHO FILTER: Assistant echoing user input from ${timeDiff}ms ago`);
          
          state.stats.filteredByEcho = (state.stats.filteredByEcho || 0) + 1;
          return {
            filtered: true,
            reason: 'user_input_echo',
            details: `Assistant message exactly matches user input from ${timeDiff}ms ago`
          };
        }
      }
    }
    
    return { filtered: false };
  }
  
  /**
   * LAYER 3: AUTOCORRELATION FILTER - Detects historical sequence patterns
   * Flags runs of consecutive old message hashes
   */
  function autocorrelationFilter(messageData) {
    // Add current hash to buffer
    state.hashBuffer.push({
      hash: messageData.hash,
      text: messageData.text.slice(0, 30),
      timestamp: Date.now(),
      isHistorical: state.processedMessages.has(messageData.text)
    });
    
    // Maintain buffer size
    if (state.hashBuffer.length > config.hashBufferSize) {
      state.hashBuffer = state.hashBuffer.slice(-config.hashBufferSize);
    }
    
    // Count consecutive historical messages in recent buffer
    let consecutiveHistorical = 0;
    let maxConsecutive = 0;
    
    for (let i = state.hashBuffer.length - 1; i >= 0; i--) {
      if (state.hashBuffer[i].isHistorical) {
        consecutiveHistorical++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveHistorical);
      } else {
        consecutiveHistorical = 0;
      }
    }
    
    // If we're in a run of historical messages, flag it
    if (maxConsecutive >= config.patternThreshold && messageData.isHistorical) {
      console.log(`${LOGGER_NAME} 🚩 AUTOCORRELATION FILTER: ${maxConsecutive} consecutive historical messages`);
      
      state.stats.filteredByAutocorrelation++;
      return {
        filtered: true,
        reason: 'autocorrelation_pattern',
        details: `Part of ${maxConsecutive} consecutive historical message sequence`
      };
    }
    
    return { filtered: false };
  }
  
  /**
   * LAYER 4: CONTEXTUAL PRESERVATION - Protects legitimate repeats
   * Preserves musical commands, user repeats, and intentional patterns
   */
  function contextualPreservation(messageData, filterResults) {
    const now = Date.now();
    
    // Don't override if not already filtered
    if (!filterResults.some(r => r.filtered)) {
      return { preserved: false };
    }
    
    // CRITICAL: NEVER preserve historical messages - they are Claude's retransmissions
    if (messageData.isHistorical) {
      console.log(`${LOGGER_NAME} 🚫 PRESERVATION BLOCKED: Historical message cannot be preserved`);
      return { preserved: false };
    }
    
    // Musical command patterns (ChurnRoom use case)
    const musicalCommands = ['PLAY:', 'SEQUENCE:', 'VOLUME:', 'PAUSE:', 'STOP:'];
    const isMusicalCommand = musicalCommands.some(cmd => 
      messageData.text.toUpperCase().includes(cmd)
    );
    
    if (isMusicalCommand) {
      const timeSinceUser = now - state.lastUserInteraction;
      if (timeSinceUser < config.musicalCommandWindow) {
        console.log(`${LOGGER_NAME} ✅ CONTEXTUAL PRESERVATION: Musical command within window`);
        state.stats.preservedByContext++;
        return {
          preserved: true,
          reason: 'musical_command',
          details: `Musical command within ${config.musicalCommandWindow}ms of user activity`
        };
      }
    }
    
    // User re-entering old commands (legitimate choice)
    if (messageData.role === 'user') {
      const timeSinceLastSeen = now - (state.processedMessages.get(messageData.text) || 0);
      if (timeSinceLastSeen < config.legitimateRepeatWindow) {
        console.log(`${LOGGER_NAME} ✅ CONTEXTUAL PRESERVATION: Legitimate user repeat`);
        state.stats.preservedByContext++;
        return {
          preserved: true,
          reason: 'legitimate_user_repeat',
          details: `User repeat within ${config.legitimateRepeatWindow}ms`
        };
      }
    }
    
    // Natural conversational echoes - ONLY for genuinely fresh content
    // CRITICAL: Never preserve historical bulk dumps, even if they look conversational
    if (messageData.text.length < 50 && 
        !messageData.isHistorical &&
        (now - state.lastUserInteraction) < config.legitimateRepeatWindow &&
        state.velocityBuffer.length < 3) {  // Added: Not during bulk operations
      console.log(`${LOGGER_NAME} ✅ CONTEXTUAL PRESERVATION: Fresh conversational echo`);
      state.stats.preservedByContext++;
      return {
        preserved: true,
        reason: 'conversational_echo',
        details: 'Short fresh message in active conversation'
      };
    }
    
    return { preserved: false };
  }
  
  /**
   * Send to server with signal processing metadata
   * Server handles dual logging automatically:
   * - chatverbose.log: Gets everything (always)
   * - chat.log: Gets only clean messages (filtered by server + our signal processing)
   */
  function sendToServer(payload, signalProcessingDecision) {
    // Mark as noise if filtered by signal processing
    // This will prevent it from reaching chat.log but allow it in chatverbose.log
    if (signalProcessingDecision.filtered) {
      payload.metadata.isSignalNoise = true;
      payload.metadata.signalProcessingFilter = signalProcessingDecision.filteredBy;
    }
    
    fetch('http://localhost:8788/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => response.text())
    .then(result => {
      if (signalProcessingDecision.filtered) {
        state.stats.verboseLogEntries++; // Only in verbose
        console.log(`${LOGGER_NAME} 📋 VERBOSE ONLY:`, payload.role, payload.text.slice(0, 30));
      } else {
        state.stats.cleanLogEntries++; // In both logs
        console.log(`${LOGGER_NAME} ✅ BOTH LOGS:`, payload.role, payload.text.slice(0, 30));
      }
    })
    .catch(error => {
      console.log(`${LOGGER_NAME} ❌ Server log failed:`, error.message);
    });
  }
  
  /**
   * MAIN SIGNAL PROCESSING PIPELINE
   */
  function processMessage(element, role, text, context = {}) {
    const now = Date.now();
    
    state.stats.totalMessages++;
    
    const messageData = {
      element: element,
      role: role,
      text: text,
      hash: hashMessage(text, role),
      timestamp: now,
      isHistorical: state.processedMessages.has(text)
    };
    
    console.log(`${LOGGER_NAME} 🔄 PROCESSING: ${role} - "${text.slice(0, 50)}" [len=${text.length}] [element=${element.tagName}]`);
    
    // Run through filter layers
    const filterResults = [
      velocityFilter(messageData),
      temporalFilter(messageData),
      echoDetectionFilter(messageData),
      autocorrelationFilter(messageData)
    ];
    
    // Check contextual preservation
    const preservation = contextualPreservation(messageData, filterResults);
    
    // Determine final disposition
    const isFiltered = filterResults.some(r => r.filtered) && !preservation.preserved;
    const filteredReasons = filterResults.filter(r => r.filtered).map(r => r.reason);
    
    // Create log payload
    const urls = extractUrls(text);
    const payload = {
      platform: 'claude',
      role: role,
      text: text,
      urls: urls,
      metadata: {
        artifacts: [],
        tools: [],
        streaming: false,
        messageLength: text.length,
        directLogger: true,
        timestamp: now,
        conversationId: getConvoId(),
        signalProcessing: {
          filtered: isFiltered,
          filteredBy: filteredReasons,
          preserved: preservation.preserved,
          preservedBy: preservation.reason || null,
          filterDetails: filterResults.filter(r => r.filtered).map(r => r.details),
          velocityBufferSize: state.velocityBuffer.length,
          isHistorical: messageData.isHistorical
        },
        detectionMethod: context.detectionMethod || 'signal_processing'
      }
    };
    
    // Update state
    state.processedMessages.set(text, now);
    state.conversationHistory.push({ text, role, timestamp: now, filtered: isFiltered });
    
    if (role === 'user') {
      state.lastUserInteraction = now;
    }
    
    // Log to appropriate destinations
    if (isFiltered) {
      console.log(`${LOGGER_NAME} 🚫 FILTERED (${filteredReasons.join(', ')}):`, text.slice(0, 50));
      sendToServer(payload, 'verbose'); // Only to verbose log
    } else {
      console.log(`${LOGGER_NAME} ✅ PASSED:`, text.slice(0, 50));
      sendToServer(payload, 'both'); // To both logs
    }
    
    // Maintenance
    if (state.conversationHistory.length > 50) {
      state.conversationHistory = state.conversationHistory.slice(-25);
    }
  }
  
  /**
   * Initialize DOM monitoring (same as before but with signal processing)
   */
  function setupMessageCapture() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              setTimeout(() => {
                analyzeNodeForMessages(node);
              }, config.persistenceThreshold);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Signal processing message capture active`);
  }
  
  function analyzeNodeForMessages(node) {
    try {
      const messageSelectors = [
        '[data-message-author-role]',
        '[data-message-id]',
        'article',
        '[role="article"]'
      ];
      
      let messageElement = null;
      let detectedRole = null;
      
      for (const selector of messageSelectors) {
        try {
          if (node.matches && node.matches(selector)) {
            messageElement = node;
            detectedRole = detectMessageRole(node);
            break;
          }
          
          const foundElement = node.querySelector(selector);
          if (foundElement) {
            messageElement = foundElement;
            detectedRole = detectMessageRole(foundElement);
            break;
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      
      // Fallback content analysis
      if (!messageElement && node.textContent) {
        const text = normText(node.textContent);
        if (text.length > 5 && text.length < 2000) {
          const role = detectMessageRole(node);
          if (role !== 'unknown') {
            messageElement = node;
            detectedRole = role;
          }
        }
      }
      
      if (messageElement && detectedRole && detectedRole !== 'unknown') {
        // FIXED: Extract text more carefully to avoid phantom elements
        let text = extractCleanText(messageElement);
        
        // DEBUG: Log raw text extraction
        console.log(`${LOGGER_NAME} RAW DOM TEXT: "${text}" from element:`, messageElement.tagName, messageElement.className);
        
        if (text) {
          processMessage(messageElement, detectedRole, text, { 
            detectionMethod: 'signal_processing_dom_mutation' 
          });
        }
      }
    } catch (error) {
      console.error(`${LOGGER_NAME} Error analyzing node:`, error);
    }
  }
  
  // Basic role detection (simplified for now)
  function detectMessageRole(element) {
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;
    
    const text = normText(element.textContent || '');
    
    // Pattern-based fallback
    if (text.includes('JSEQUENCE:') || text.includes('JPLAY:') || text.includes('testmessage')) {
      return 'user';
    }
    
    // More flexible assistant response detection
    if (text.match(/(seq_ok|play_ok|vol_ok|okay\d+)/i) || text.includes('_ok')) {
      return 'assistant';
    }
    
    // Check if this looks like an assistant response (short, follows user message)
    if (text.length < 100 && timeSinceUser < 30000 && timeSinceUser > 500) {
      // Exclude obvious user patterns
      if (!text.includes('testmessage') && !text.toLowerCase().includes('respond')) {
        return 'assistant';
      }
    }
    
    // Conversation flow heuristic
    const timeSinceUser = Date.now() - state.lastUserInteraction;
    if (timeSinceUser < 30000 && timeSinceUser > 1000) {
      return 'assistant';
    }
    
    return 'unknown';
  }
  
  // Initialize
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing signal processing logger...`);
    console.log(`${LOGGER_NAME} Filter thresholds:`);
    console.log(`  - Velocity: ${config.velocityThreshold} msgs/${config.velocityWindow}ms`);
    console.log(`  - Temporal: ${config.conversationWindow}ms conversation window`);
    console.log(`  - Pattern: ${config.patternThreshold}+ consecutive = suspicious`);
    console.log(`  - Contextual: Musical commands preserved for ${config.musicalCommandWindow}ms`);
    
    setupMessageCapture();
    
    // Mark existing messages to avoid processing history
    const existingElements = document.querySelectorAll('*');
    let markedCount = 0;
    
    existingElements.forEach(el => {
      const text = normText(el.textContent || '');
      if (text && text.length > 3 && text.length < 500) {
        state.processedMessages.set(text, state.sessionStart - 1000);
        markedCount++;
      }
    });
    
    console.log(`${LOGGER_NAME} ✅ Initialized - marked ${markedCount} existing elements`);
  }
  
  // Start the signal processing logger
  initialize();
  
  // Expose for debugging and monitoring
  window.signalProcessingLogger = {
    getState: () => ({
      ...state,
      config: config,
      velocityBuffer: state.velocityBuffer.map(v => ({ 
        timestamp: v.timestamp, 
        role: v.role, 
        age: Date.now() - v.timestamp 
      }))
    }),
    getStats: () => state.stats,
    clearState: () => {
      state.processedMessages.clear();
      state.conversationHistory = [];
      state.velocityBuffer = [];
      state.hashBuffer = [];
      state.temporalWindow = [];
      Object.keys(state.stats).forEach(key => state.stats[key] = 0);
      console.log(`${LOGGER_NAME} State and stats cleared`);
    }
  };
  
  console.log(`${LOGGER_NAME} ✅ Signal processing logger ready!`);
  console.log('Debug: window.signalProcessingLogger.getState(), .getStats(), .clearState()');
  
})();