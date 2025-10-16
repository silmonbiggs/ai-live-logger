// Updated signal processing logger with J prefix and preservation fixes
// Copy this entire content and paste it into Claude's F12 console// Signal Processing Claude Logger - Multi-layer filtering for clean chat.log
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
    
    // Enhanced user send detection for sequence tracking
    userSendTracking: {
      awaitingResponse: false,
      responseToContent: null,
      userSentAt: 0,
      seenUserMessageInStream: false,
      genuineResponseCaptured: false,
      responseWindow: 15000 // 15 seconds max for response
    },
    
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
   * Enhanced user send detection - triggered when user actually sends a message
   */
  function onUserSendMessage(userContent) {
    const now = Date.now();
    console.log(`${LOGGER_NAME} 🎯 USER SEND DETECTED: "${userContent.slice(0, 50)}..."`);
    
    // Check if we're already awaiting a response (prevent multiple triggers)
    if (state.userSendTracking.awaitingResponse) {
      const timeSinceLastSend = now - state.userSendTracking.userSentAt;
      if (timeSinceLastSend < 1000) {
        console.log(`${LOGGER_NAME} ⚠️ Ignoring duplicate send event (${timeSinceLastSend}ms since last)`);
        return;
      }
    }
    
    // Set up tracking for genuine message and response detection
    state.userSendTracking.awaitingResponse = true;
    state.userSendTracking.responseToContent = userContent;
    state.userSendTracking.userSentAt = now;
    state.userSendTracking.seenUserMessageInStream = false;
    state.userSendTracking.genuineResponseCaptured = false;
    
    // Update lastUserInteraction as well
    state.lastUserInteraction = now;
    
    console.log(`${LOGGER_NAME} 📍 Tracking genuine user-assistant exchange for: "${userContent.slice(0, 30)}..."`);
    console.log(`${LOGGER_NAME} 📍 User message window: 5s, Response window: ${state.userSendTracking.responseWindow}ms`);
  }
  
  /**
   * ENHANCED: Check if a message is a genuine response vs historical retransmission
   */
  function checkGenuineResponse(messageData) {
    const { userSendTracking } = state;
    const now = messageData.timestamp;
    
    // FIRST: Check enhanced user detection system
    if (window.genuineUserInputs && messageData.role === 'user') {
      const genuineMarker = window.genuineUserInputs.get(messageData.text);
      if (genuineMarker) {
        const timeSinceMarked = now - genuineMarker.timestamp;
        if (timeSinceMarked < 30000) { // Within 30 seconds of being marked genuine
          console.log(`${LOGGER_NAME} 🎯 ENHANCED GENUINE USER INPUT: "${messageData.text.slice(0, 50)}..." via ${genuineMarker.detectionMethod}`);
          console.log(`${LOGGER_NAME} ✅ Bypassing all filters due to enhanced detection`);
          
          // Set up response tracking
          userSendTracking.awaitingResponse = true;
          userSendTracking.responseToContent = messageData.text;
          userSendTracking.userSentAt = now;
          userSendTracking.seenUserMessageInStream = true;
          userSendTracking.genuineResponseCaptured = false;
          
          return true; // Mark as genuine, bypass all filtering
        } else {
          console.log(`${LOGGER_NAME} ⏰ Genuine marker expired (${timeSinceMarked}ms), falling back to original detection`);
        }
      }
    }
    
    // FALLBACK: Original genuine response detection logic
    if (!userSendTracking.awaitingResponse) {
      return false; // Not expecting any response
    }
    
    // Check if we're within the response time window
    const timeSinceSend = now - userSendTracking.userSentAt;
    if (timeSinceSend > userSendTracking.responseWindow) {
      console.log(`${LOGGER_NAME} ⏰ Response window expired (${timeSinceSend}ms)`);
      return false;
    }
    
    // For user messages: check if this matches our tracked genuine send
    if (messageData.role === 'user' && 
        messageData.text === userSendTracking.responseToContent &&
        !userSendTracking.seenUserMessageInStream &&
        timeSinceSend <= 5000) { // Conservative 5-second window for user messages
      
      userSendTracking.seenUserMessageInStream = true;
      console.log(`${LOGGER_NAME} 🎯 GENUINE USER INPUT DETECTED: "${messageData.text.slice(0, 50)}..." bypassing filters`);
      return true; // Mark as genuine, bypass all filtering
    }
    
    // Track when we see our user message in stream (for assistant response detection)
    if (messageData.role === 'user' && messageData.text === userSendTracking.responseToContent) {
      if (!userSendTracking.seenUserMessageInStream) {
        userSendTracking.seenUserMessageInStream = true;
        console.log(`${LOGGER_NAME} 👤 Detected our user message in stream (historical)`);
      }
    }
    
    // For assistant messages: check if this is the genuine response
    if (messageData.role === 'assistant' && 
        userSendTracking.seenUserMessageInStream && 
        !userSendTracking.genuineResponseCaptured &&
        timeSinceSend >= 500) { // Minimum 500ms delay for genuine response
      
      userSendTracking.genuineResponseCaptured = true;
      userSendTracking.awaitingResponse = false; // Stop waiting
      
      console.log(`${LOGGER_NAME} 🎉 GENUINE RESPONSE DETECTED: "${messageData.text.slice(0, 50)}..." after ${timeSinceSend}ms`);
      console.log(`${LOGGER_NAME} ✅ User-Assistant exchange complete, resetting tracking`);
      return true;
    }
    
    return false;
  }
  
  /**
   * FIXED: Set up integration with enhanced user detection system
   */
  function setupUserSendDetection() {
    console.log(`${LOGGER_NAME} 🔧 Setting up enhanced user send detection integration...`);
    
    // Check if enhanced user detection is available
    if (window.enhancedUserDetection) {
      console.log(`${LOGGER_NAME} ✅ Found enhanced user detection system, integrating...`);
      
      // The enhanced detection system will populate window.genuineUserInputs
      // Our checkGenuineResponse function will use this data
      
    } else {
      console.log(`${LOGGER_NAME} ⚠️ Enhanced user detection not found. To fix user send detection:`);
      console.log(`${LOGGER_NAME} 1. Run the enhanced_user_detection_logger.js first`);
      console.log(`${LOGGER_NAME} 2. Then run this signal processing logger`);
      console.log(`${LOGGER_NAME} ℹ️ Falling back to enhanced genuine input checking...`);
      
      // Enhanced fallback: use timing and pattern analysis
      setupFallbackUserDetection();
    }
    
    console.log(`${LOGGER_NAME} ✅ User send detection integration active`);
  }
  
  /**
   * Fallback user detection when enhanced detection isn't available
   */
  function setupFallbackUserDetection() {
    // Monitor for rapid DOM changes that might indicate user input
    let recentDOMChanges = [];
    
    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // Clean old entries
      recentDOMChanges = recentDOMChanges.filter(change => now - change.timestamp < 5000);
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || '';
              if (text.trim() && text.length > 5 && text.length < 500) {
                recentDOMChanges.push({
                  text: text,
                  timestamp: now,
                  element: node
                });
                
                // If this looks like a fresh user message, mark it as potentially genuine
                if (text.includes('testmessage') || text.match(/^[A-Z].*[.!?]$/) || text.length < 100) {
                  console.log(`${LOGGER_NAME} 🔍 Potential genuine user input detected: "${text.slice(0, 30)}..."`);
                  
                  // Mark as genuine with high confidence if timing is right
                  const timeSinceLastInteraction = now - state.lastUserInteraction;
                  if (timeSinceLastInteraction < 10000) { // Within 10 seconds of interaction
                    markContentAsGenuine(text, 'fallback_timing_analysis');
                  }
                }
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Fallback user detection active`);
  }
  
  /**
   * Mark content as genuine user input
   */
  function markContentAsGenuine(content, method) {
    window.genuineUserInputs = window.genuineUserInputs || new Map();
    window.genuineUserInputs.set(content, {
      content: content,
      timestamp: Date.now(),
      detectionMethod: method,
      genuine: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Marked as genuine: "${content.slice(0, 30)}..." via ${method}`);
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
    
    // Check if this is a genuine response (overrides filtering)
    const isGenuineResponse = checkGenuineResponse(messageData);
    
    // Check contextual preservation
    const preservation = contextualPreservation(messageData, filterResults);
    
    // Determine final disposition - genuine responses bypass filtering
    let isFiltered, filteredReasons;
    if (isGenuineResponse) {
      isFiltered = false; // Genuine responses are never filtered
      filteredReasons = [];
      console.log(`${LOGGER_NAME} 🎯 GENUINE RESPONSE OVERRIDE: Bypassing all filters`);
    } else {
      isFiltered = filterResults.some(r => r.filtered) && !preservation.preserved;
      filteredReasons = filterResults.filter(r => r.filtered).map(r => r.reason);
    }
    
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
          isHistorical: messageData.isHistorical,
          isGenuineResponse: isGenuineResponse,
          isGenuineUserInput: isGenuineResponse && messageData.role === 'user'
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
   * Initialize DOM monitoring with debounced streaming completion detection
   */
  function setupMessageCapture() {
    // Debounce storage for pending messages
    const pendingMessages = new Map();
    const DEBOUNCE_DELAY = 1000; // 1000ms debounce for streaming completion

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Basic persistence check first
              setTimeout(() => {
                handleNodeWithDebounce(node);
              }, config.persistenceThreshold);
            }
          });
        }
      });
    });

    function handleNodeWithDebounce(node) {
      try {
        const messageSelectors = [
          '[data-message-author-role]',
          '[data-message-id]',
          'article',
          '[role="article"]'
        ];

        let messageElement = null;
        let detectedRole = null;

        // Find message element
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
          const text = extractCleanText(messageElement);

          if (text && text.length > 0) {
            console.log(`${LOGGER_NAME} 🔄 DEBOUNCE: Detected content "${text.slice(0, 30)}..." - setting up ${DEBOUNCE_DELAY}ms timer`);

            // Create unique key for this message location
            const messageKey = `${detectedRole}-${text.slice(0, 50)}-${messageElement.className}`;

            // Clear any existing timer for this message
            if (pendingMessages.has(messageKey)) {
              clearTimeout(pendingMessages.get(messageKey).timer);
            }

            // Set new debounce timer
            const timer = setTimeout(() => {
              console.log(`${LOGGER_NAME} ⏰ DEBOUNCE COMPLETE: Processing "${text.slice(0, 30)}..." after ${DEBOUNCE_DELAY}ms`);

              // Re-extract text in case it changed during debounce period
              const finalText = extractCleanText(messageElement);
              if (finalText && finalText.length > 0) {
                processMessage(messageElement, detectedRole, finalText, {
                  detectionMethod: 'debounced_dom_mutation',
                  debounceDelay: DEBOUNCE_DELAY,
                  originalText: text,
                  finalText: finalText,
                  textChanged: text !== finalText
                });
              }

              // Clean up
              pendingMessages.delete(messageKey);
            }, DEBOUNCE_DELAY);

            // Store the pending message
            pendingMessages.set(messageKey, {
              timer: timer,
              element: messageElement,
              role: detectedRole,
              originalText: text,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        console.error(`${LOGGER_NAME} Error in debounced handler:`, error);
      }
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log(`${LOGGER_NAME} ✅ Debounced message capture active (${DEBOUNCE_DELAY}ms delay)`);

    // Expose debounce state for debugging
    window.debouncedCapture = {
      getPendingMessages: () => Array.from(pendingMessages.entries()).map(([key, data]) => ({
        key,
        role: data.role,
        text: data.originalText.slice(0, 50),
        age: Date.now() - data.timestamp
      })),
      clearPending: () => {
        pendingMessages.forEach(data => clearTimeout(data.timer));
        pendingMessages.clear();
        console.log(`${LOGGER_NAME} 🧹 Cleared all pending debounced messages`);
      }
    };
  }
  
  
  // Basic role detection (simplified for now)
  function detectMessageRole(element) {
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;
    
    const text = normText(element.textContent || '');
    const timeSinceUser = Date.now() - state.lastUserInteraction;
    
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
    setupUserSendDetection(); // Set up DOM event listeners for user send detection
    
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