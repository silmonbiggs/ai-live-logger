// COMPLETE SOLUTION: Fixed User Send Detection + Signal Processing Logger
// This solves the core issue where repeated user messages were never logged
// Copy this entire content and paste it into Claude's F12 console

console.log('🚀 Loading Complete Solution for Claude User Detection + Signal Processing...');

// First, load the Enhanced User Detection System
(function() {
  'use strict';
  
  const LOGGER_NAME = '[ENHANCED USER DETECTION]';
  console.log(`${LOGGER_NAME} Initializing comprehensive user send detection...`);
  
  // Storage for user interaction tracking
  const state = {
    processedMessages: new Map(),
    messageSequence: [],
    conversationHistory: [],
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    userSendTracking: {
      awaitingResponse: false,
      responseToContent: null,
      userSentAt: 0,
      seenUserMessageInStream: false,
      genuineResponseCaptured: false,
      responseWindow: 15000,
      inputTrackingActive: false,
      lastInputContent: '',
      inputElementObserver: null
    },
    detectionStats: {
      sendButtonClicks: 0,
      keyboardSubmissions: 0,
      inputDetections: 0,
      webSocketMessages: 0,
      formSubmissions: 0,
      successfulDetections: 0,
      missedDetections: 0
    },
    gracePeriod: 10000,
    lastProcessedContent: '',
    lastProcessedTime: 0
  };
  
  function setupComprehensiveUserSendDetection() {
    console.log(`${LOGGER_NAME} 🔧 Setting up comprehensive user send detection...`);
    setupSendButtonDetection();
    setupKeyboardDetection();
    setupInputFieldMonitoring();
    setupFormSubmissionDetection();
    setupWebSocketInterception();
    setupSendButtonStateMonitoring();
    console.log(`${LOGGER_NAME} ✅ All detection layers initialized`);
  }
  
  function setupSendButtonDetection() {
    const sendButtonSelectors = [
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[type="submit"]',
      'button:contains("Send")',
      '[data-testid="send-button"]',
      '[data-cy="send-button"]',
      '.send-button',
      '.submit-button',
      'button[aria-label*="send"]',
      'button[aria-label*="Submit"]',
      'button svg[data-icon="send"]',
      'form button',
      'div[contenteditable] + button',
      'textarea + button',
      'input[type="text"] + button'
    ];
    
    document.addEventListener('click', function(event) {
      const target = event.target;
      
      const isSendButton = sendButtonSelectors.some(selector => {
        try {
          return target.matches(selector) || target.closest(selector);
        } catch (e) {
          return false;
        }
      });
      
      if (isSendButton) {
        console.log(`${LOGGER_NAME} 🎯 SEND BUTTON CLICK DETECTED:`, target);
        state.detectionStats.sendButtonClicks++;
        
        const userContent = captureUserInputContent();
        if (userContent && userContent.trim()) {
          onUserSendMessage(userContent, 'send_button_click');
        }
      }
      
      const nearbyInput = findNearbyInputElement(target);
      if (nearbyInput) {
        const inputContent = getInputElementValue(nearbyInput);
        if (inputContent && inputContent.trim() && target.tagName === 'BUTTON') {
          console.log(`${LOGGER_NAME} 🎯 BUTTON NEAR INPUT DETECTED:`, target, 'input:', inputContent.slice(0, 30));
          state.detectionStats.sendButtonClicks++;
          onUserSendMessage(inputContent, 'button_near_input');
        }
      }
    }, true);
    
    console.log(`${LOGGER_NAME} ✅ Send button detection active with ${sendButtonSelectors.length} selectors`);
  }
  
  function setupKeyboardDetection() {
    document.addEventListener('keydown', function(event) {
      const isSubmissionKey = (
        (event.key === 'Enter' && !event.shiftKey) ||
        (event.key === 'Enter' && event.ctrlKey) ||
        (event.key === 'Enter' && event.metaKey)
      );
      
      if (isSubmissionKey) {
        const target = event.target;
        
        if (target.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')) {
          console.log(`${LOGGER_NAME} 🎯 KEYBOARD SUBMISSION DETECTED:`, target.tagName, event.key);
          state.detectionStats.keyboardSubmissions++;
          
          const userContent = getInputElementValue(target);
          if (userContent && userContent.trim()) {
            setTimeout(() => {
              onUserSendMessage(userContent, 'keyboard_submission');
            }, 50);
          }
        }
      }
    }, true);
    
    console.log(`${LOGGER_NAME} ✅ Keyboard submission detection active`);
  }
  
  function setupInputFieldMonitoring() {
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ];
    
    document.addEventListener('input', function(event) {
      const target = event.target;
      
      if (inputSelectors.some(selector => {
        try { return target.matches(selector); } catch(e) { return false; }
      })) {
        const content = getInputElementValue(target);
        state.userSendTracking.lastInputContent = content;
        state.detectionStats.inputDetections++;
        state.lastUserInteraction = Date.now();
        state.userSendTracking.inputTrackingActive = true;
      }
    });
    
    document.addEventListener('focusin', function(event) {
      const target = event.target;
      
      if (inputSelectors.some(selector => {
        try { return target.matches(selector); } catch(e) { return false; }
      })) {
        console.log(`${LOGGER_NAME} 📍 Input field focused:`, target.tagName);
        
        if (state.userSendTracking.inputElementObserver) {
          state.userSendTracking.inputElementObserver.disconnect();
        }
        
        state.userSendTracking.inputElementObserver = new MutationObserver(() => {
          const content = getInputElementValue(target);
          if (content !== state.userSendTracking.lastInputContent) {
            state.userSendTracking.lastInputContent = content;
            state.lastUserInteraction = Date.now();
          }
        });
        
        state.userSendTracking.inputElementObserver.observe(target, {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    });
    
    console.log(`${LOGGER_NAME} ✅ Input field monitoring active`);
  }
  
  function setupFormSubmissionDetection() {
    document.addEventListener('submit', function(event) {
      console.log(`${LOGGER_NAME} 🎯 FORM SUBMISSION DETECTED:`, event.target);
      state.detectionStats.formSubmissions++;
      
      const form = event.target;
      const formData = new FormData(form);
      
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string' && value.trim() && value.length > 2) {
          console.log(`${LOGGER_NAME} Form field "${key}":`, value.slice(0, 50));
          onUserSendMessage(value, 'form_submission');
          break;
        }
      }
      
      const inputs = form.querySelectorAll('input, textarea, [contenteditable]');
      for (const input of inputs) {
        const content = getInputElementValue(input);
        if (content && content.trim()) {
          onUserSendMessage(content, 'form_input_element');
          break;
        }
      }
    }, true);
    
    console.log(`${LOGGER_NAME} ✅ Form submission detection active`);
  }
  
  function setupWebSocketInterception() {
    try {
      const OriginalWebSocket = window.WebSocket;
      
      window.WebSocket = function(url, protocols) {
        console.log(`${LOGGER_NAME} 🔗 WebSocket connection detected:`, url);
        
        const ws = new OriginalWebSocket(url, protocols);
        
        const originalSend = ws.send;
        ws.send = function(data) {
          console.log(`${LOGGER_NAME} 📡 WebSocket message sent:`, typeof data, data ? data.toString().slice(0, 100) : 'empty');
          state.detectionStats.webSocketMessages++;
          
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.message || parsed.content || parsed.text) {
                const userContent = parsed.message || parsed.content || parsed.text;
                console.log(`${LOGGER_NAME} 🎯 User content in WebSocket:`, userContent.slice(0, 50));
                onUserSendMessage(userContent, 'websocket_message');
              }
            } catch (e) {
              if (data.length > 5 && data.length < 2000) {
                onUserSendMessage(data, 'websocket_raw');
              }
            }
          }
          
          return originalSend.call(this, data);
        };
        
        return ws;
      };
      
      Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
      Object.defineProperty(window.WebSocket, 'prototype', {
        value: OriginalWebSocket.prototype,
        writable: false
      });
      
      console.log(`${LOGGER_NAME} ✅ WebSocket interception active`);
    } catch (error) {
      console.log(`${LOGGER_NAME} ⚠️ WebSocket interception failed:`, error.message);
    }
  }
  
  function setupSendButtonStateMonitoring() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
          const target = mutation.target;
          
          if (target.tagName === 'BUTTON') {
            const wasDisabled = mutation.oldValue === 'disabled' || mutation.oldValue === '';
            const isNowEnabled = !target.disabled;
            
            if (wasDisabled && isNowEnabled) {
              console.log(`${LOGGER_NAME} 🔄 Send button enabled:`, target);
              
              const userContent = captureUserInputContent();
              if (userContent && userContent.trim()) {
                state.userSendTracking.lastInputContent = userContent;
              }
            }
          }
        }
      });
    });
    
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['disabled'],
      attributeOldValue: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Send button state monitoring active`);
  }
  
  function captureUserInputContent() {
    if (state.userSendTracking.lastInputContent && 
        state.userSendTracking.lastInputContent.trim()) {
      return state.userSendTracking.lastInputContent;
    }
    
    const focused = document.activeElement;
    if (focused && focused.matches('input, textarea, [contenteditable]')) {
      const content = getInputElementValue(focused);
      if (content && content.trim()) {
        return content;
      }
    }
    
    const inputElements = document.querySelectorAll('input, textarea, [contenteditable="true"], [contenteditable=""]');
    for (const element of inputElements) {
      const content = getInputElementValue(element);
      if (content && content.trim() && content.length > 2) {
        return content;
      }
    }
    
    return null;
  }
  
  function getInputElementValue(element) {
    if (!element) return '';
    
    if (element.value !== undefined) {
      return element.value;
    }
    
    if (element.contentEditable === 'true' || element.contentEditable === '') {
      return element.textContent || element.innerText || '';
    }
    
    return element.textContent || element.innerText || '';
  }
  
  function findNearbyInputElement(target) {
    let current = target.parentElement;
    let depth = 0;
    
    while (current && depth < 5) {
      const inputs = current.querySelectorAll('input, textarea, [contenteditable]');
      if (inputs.length > 0) {
        return inputs[inputs.length - 1];
      }
      current = current.parentElement;
      depth++;
    }
    
    const siblings = target.parentElement ? target.parentElement.querySelectorAll('input, textarea, [contenteditable]') : [];
    return siblings.length > 0 ? siblings[siblings.length - 1] : null;
  }
  
  function onUserSendMessage(userContent, detectionMethod) {
    const now = Date.now();
    
    if (!userContent || !userContent.trim()) {
      console.log(`${LOGGER_NAME} ⚠️ Empty user content, skipping detection`);
      return;
    }
    
    console.log(`${LOGGER_NAME} 🎯 USER SEND DETECTED via ${detectionMethod}: "${userContent.slice(0, 50)}..."`);
    
    if (state.lastProcessedContent === userContent && 
        (now - state.lastProcessedTime) < state.gracePeriod) {
      console.log(`${LOGGER_NAME} 🔄 Ignoring duplicate detection within grace period (${now - state.lastProcessedTime}ms)`);
      return;
    }
    
    state.lastProcessedContent = userContent;
    state.lastProcessedTime = now;
    state.detectionStats.successfulDetections++;
    
    if (state.userSendTracking.awaitingResponse) {
      const timeSinceLastSend = now - state.userSendTracking.userSentAt;
      if (timeSinceLastSend < 2000) {
        console.log(`${LOGGER_NAME} ⚠️ Ignoring duplicate send event (${timeSinceLastSend}ms since last)`);
        return;
      }
    }
    
    state.userSendTracking.awaitingResponse = true;
    state.userSendTracking.responseToContent = userContent;
    state.userSendTracking.userSentAt = now;
    state.userSendTracking.seenUserMessageInStream = false;
    state.userSendTracking.genuineResponseCaptured = false;
    state.lastUserInteraction = now;
    
    console.log(`${LOGGER_NAME} 📍 Tracking genuine user-assistant exchange for: "${userContent.slice(0, 30)}..."`);
    console.log(`${LOGGER_NAME} 📍 Detection method: ${detectionMethod}`);
    console.log(`${LOGGER_NAME} 📍 User message window: 5s, Response window: ${state.userSendTracking.responseWindow}ms`);
    
    markAsGenuineUserInput(userContent, detectionMethod);
  }
  
  function markAsGenuineUserInput(content, detectionMethod) {
    if (!window.signalProcessingLogger) {
      console.log(`${LOGGER_NAME} ⚠️ Signal processing logger not found, creating bypass marker`);
      window.genuineUserInputs = window.genuineUserInputs || new Map();
    }
    
    const timestamp = Date.now();
    const marker = {
      content: content,
      timestamp: timestamp,
      detectionMethod: detectionMethod,
      genuine: true
    };
    
    window.genuineUserInputs = window.genuineUserInputs || new Map();
    window.genuineUserInputs.set(content, marker);
    
    console.log(`${LOGGER_NAME} ✅ Marked as genuine user input: "${content.slice(0, 30)}..." via ${detectionMethod}`);
    
    for (const [key, value] of window.genuineUserInputs.entries()) {
      if (timestamp - value.timestamp > 30000) {
        window.genuineUserInputs.delete(key);
      }
    }
  }
  
  function getDetectionStats() {
    return {
      ...state.detectionStats,
      uptime: Date.now() - state.sessionStart,
      genuineInputsMarked: window.genuineUserInputs ? window.genuineUserInputs.size : 0
    };
  }
  
  function initialize() {
    console.log(`${LOGGER_NAME} 🚀 Starting enhanced user detection system...`);
    
    setupComprehensiveUserSendDetection();
    
    console.log(`${LOGGER_NAME} ✅ Enhanced user detection system ready!`);
    console.log(`${LOGGER_NAME} Monitoring for user inputs via:`);
    console.log(`  - Send button clicks`);
    console.log(`  - Keyboard submissions (Enter, Ctrl+Enter)`);
    console.log(`  - Input field monitoring`);
    console.log(`  - Form submissions`);
    console.log(`  - WebSocket message interception`);
    console.log(`  - Send button state changes`);
  }
  
  initialize();
  
  window.enhancedUserDetection = {
    getStats: getDetectionStats,
    getState: () => state,
    markAsGenuine: markAsGenuineUserInput,
    testDetection: (content) => onUserSendMessage(content, 'manual_test')
  };
  
  console.log(`${LOGGER_NAME} 🔧 Debug available: window.enhancedUserDetection.getStats(), .getState(), .testDetection()`);
  
})();

console.log('✅ Enhanced User Detection loaded. Now loading Signal Processing Logger...');

// Now load the updated Signal Processing Logger
(function() {
  'use strict';
  
  const LOGGER_NAME = '[SIGNAL PROCESSING LOGGER]';
  console.log(`${LOGGER_NAME} Initializing with enhanced user detection integration...`);
  
  const state = {
    processedMessages: new Map(),
    messageSequence: [],
    conversationHistory: [],
    
    velocityBuffer: [],
    hashBuffer: [],
    temporalWindow: [],
    
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    
    userSendTracking: {
      awaitingResponse: false,
      responseToContent: null,
      userSentAt: 0,
      seenUserMessageInStream: false,
      genuineResponseCaptured: false,
      responseWindow: 15000
    },
    
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
  
  const config = {
    velocityThreshold: 5,
    velocityWindow: 1000,
    conversationWindow: 300000,
    userActivityWindow: 120000,
    hashBufferSize: 20,
    patternThreshold: 3,
    musicalCommandWindow: 60000,
    legitimateRepeatWindow: 30000,
    persistenceThreshold: 500
  };
  
  function normText(s) {
    return String(s || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  function extractCleanText(element) {
    if (element.children.length === 0) {
      return normText(element.textContent || '');
    }
    
    let text = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_SKIP;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_SKIP;
          }
          
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
    
    if (!text.trim()) {
      text = element.textContent || '';
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
    let hash = 0;
    const str = `${role}:${text}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
  
  function extractUrls(text) {
    const urls = [];
    const matches = text.match(/https?:\\/\\/[^\\s]+/g);
    if (matches) {
      matches.forEach(url => {
        const clean = url.replace(/[.,;!?]+$/, '');
        if (!urls.includes(clean)) urls.push(clean);
      });
    }
    return urls;
  }
  
  function velocityFilter(messageData) {
    const now = Date.now();
    
    state.velocityBuffer.push({
      timestamp: now,
      role: messageData.role,
      hash: messageData.hash
    });
    
    state.velocityBuffer = state.velocityBuffer.filter(
      entry => now - entry.timestamp < config.velocityWindow
    );
    
    const messagesInWindow = state.velocityBuffer.length;
    const sameRoleInWindow = state.velocityBuffer.filter(
      entry => entry.role === messageData.role
    ).length;
    
    if (messagesInWindow > config.velocityThreshold) {
      console.log(`${LOGGER_NAME} 🚩 VELOCITY FILTER: ${messagesInWindow} messages in ${config.velocityWindow}ms`);
      
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
  
  function temporalFilter(messageData) {
    const now = Date.now();
    
    const timeSinceUserActivity = now - state.lastUserInteraction;
    const isOldMessage = state.processedMessages.has(messageData.text);
    
    if (isOldMessage) {
      const lastSeen = state.processedMessages.get(messageData.text);
      const messageAge = now - lastSeen;
      
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
  
  function echoDetectionFilter(messageData) {
    const now = Date.now();
    
    if (messageData.role !== 'assistant') {
      return { filtered: false };
    }
    
    for (const historyItem of state.conversationHistory.slice(-10)) {
      if (historyItem.role === 'user') {
        const timeDiff = now - historyItem.timestamp;
        
        if (timeDiff < 10000 &&
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
  
  function autocorrelationFilter(messageData) {
    state.hashBuffer.push({
      hash: messageData.hash,
      text: messageData.text.slice(0, 30),
      timestamp: Date.now(),
      isHistorical: state.processedMessages.has(messageData.text)
    });
    
    if (state.hashBuffer.length > config.hashBufferSize) {
      state.hashBuffer = state.hashBuffer.slice(-config.hashBufferSize);
    }
    
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
  
  function contextualPreservation(messageData, filterResults) {
    const now = Date.now();
    
    if (!filterResults.some(r => r.filtered)) {
      return { preserved: false };
    }
    
    if (messageData.isHistorical) {
      console.log(`${LOGGER_NAME} 🚫 PRESERVATION BLOCKED: Historical message cannot be preserved`);
      return { preserved: false };
    }
    
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
    
    if (messageData.text.length < 50 && 
        !messageData.isHistorical &&
        (now - state.lastUserInteraction) < config.legitimateRepeatWindow &&
        state.velocityBuffer.length < 3) {
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
  
  function checkGenuineResponse(messageData) {
    const { userSendTracking } = state;
    const now = messageData.timestamp;
    
    // FIRST: Check enhanced user detection system
    if (window.genuineUserInputs && messageData.role === 'user') {
      const genuineMarker = window.genuineUserInputs.get(messageData.text);
      if (genuineMarker) {
        const timeSinceMarked = now - genuineMarker.timestamp;
        if (timeSinceMarked < 30000) {
          console.log(`${LOGGER_NAME} 🎯 ENHANCED GENUINE USER INPUT: "${messageData.text.slice(0, 50)}..." via ${genuineMarker.detectionMethod}`);
          console.log(`${LOGGER_NAME} ✅ Bypassing all filters due to enhanced detection`);
          
          userSendTracking.awaitingResponse = true;
          userSendTracking.responseToContent = messageData.text;
          userSendTracking.userSentAt = now;
          userSendTracking.seenUserMessageInStream = true;
          userSendTracking.genuineResponseCaptured = false;
          
          return true;
        } else {
          console.log(`${LOGGER_NAME} ⏰ Genuine marker expired (${timeSinceMarked}ms), falling back to original detection`);
        }
      }
    }
    
    // FALLBACK: Original genuine response detection logic
    if (!userSendTracking.awaitingResponse) {
      return false;
    }
    
    const timeSinceSend = now - userSendTracking.userSentAt;
    if (timeSinceSend > userSendTracking.responseWindow) {
      console.log(`${LOGGER_NAME} ⏰ Response window expired (${timeSinceSend}ms)`);
      return false;
    }
    
    if (messageData.role === 'user' && 
        messageData.text === userSendTracking.responseToContent &&
        !userSendTracking.seenUserMessageInStream &&
        timeSinceSend <= 5000) {
      
      userSendTracking.seenUserMessageInStream = true;
      console.log(`${LOGGER_NAME} 🎯 GENUINE USER INPUT DETECTED: "${messageData.text.slice(0, 50)}..." bypassing filters`);
      return true;
    }
    
    if (messageData.role === 'user' && messageData.text === userSendTracking.responseToContent) {
      if (!userSendTracking.seenUserMessageInStream) {
        userSendTracking.seenUserMessageInStream = true;
        console.log(`${LOGGER_NAME} 👤 Detected our user message in stream (historical)`);
      }
    }
    
    if (messageData.role === 'assistant' && 
        userSendTracking.seenUserMessageInStream && 
        !userSendTracking.genuineResponseCaptured &&
        timeSinceSend >= 500) {
      
      userSendTracking.genuineResponseCaptured = true;
      userSendTracking.awaitingResponse = false;
      
      console.log(`${LOGGER_NAME} 🎉 GENUINE RESPONSE DETECTED: "${messageData.text.slice(0, 50)}..." after ${timeSinceSend}ms`);
      console.log(`${LOGGER_NAME} ✅ User-Assistant exchange complete, resetting tracking`);
      return true;
    }
    
    return false;
  }
  
  function sendToServer(payload, signalProcessingDecision) {
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
        state.stats.verboseLogEntries++;
        console.log(`${LOGGER_NAME} 📋 VERBOSE ONLY:`, payload.role, payload.text.slice(0, 30));
      } else {
        state.stats.cleanLogEntries++;
        console.log(`${LOGGER_NAME} ✅ BOTH LOGS:`, payload.role, payload.text.slice(0, 30));
      }
    })
    .catch(error => {
      console.log(`${LOGGER_NAME} ❌ Server log failed:`, error.message);
    });
  }
  
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
    
    const filterResults = [
      velocityFilter(messageData),
      temporalFilter(messageData),
      echoDetectionFilter(messageData),
      autocorrelationFilter(messageData)
    ];
    
    const isGenuineResponse = checkGenuineResponse(messageData);
    
    const preservation = contextualPreservation(messageData, filterResults);
    
    let isFiltered, filteredReasons;
    if (isGenuineResponse) {
      isFiltered = false;
      filteredReasons = [];
      console.log(`${LOGGER_NAME} 🎯 GENUINE RESPONSE OVERRIDE: Bypassing all filters`);
    } else {
      isFiltered = filterResults.some(r => r.filtered) && !preservation.preserved;
      filteredReasons = filterResults.filter(r => r.filtered).map(r => r.reason);
    }
    
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
    
    state.processedMessages.set(text, now);
    state.conversationHistory.push({ text, role, timestamp: now, filtered: isFiltered });
    
    if (role === 'user') {
      state.lastUserInteraction = now;
    }
    
    if (isFiltered) {
      console.log(`${LOGGER_NAME} 🚫 FILTERED (${filteredReasons.join(', ')}):`, text.slice(0, 50));
      sendToServer(payload, { filtered: true, filteredBy: filteredReasons });
    } else {
      console.log(`${LOGGER_NAME} ✅ PASSED:`, text.slice(0, 50));
      sendToServer(payload, { filtered: false });
    }
    
    if (state.conversationHistory.length > 50) {
      state.conversationHistory = state.conversationHistory.slice(-25);
    }
  }
  
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
        let text = extractCleanText(messageElement);
        
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
  
  function detectMessageRole(element) {
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;
    
    const text = normText(element.textContent || '');
    const timeSinceUser = Date.now() - state.lastUserInteraction;
    
    if (text.includes('JSEQUENCE:') || text.includes('JPLAY:') || text.includes('testmessage')) {
      return 'user';
    }
    
    if (text.match(/(seq_ok|play_ok|vol_ok|okay\\d+)/i) || text.includes('_ok')) {
      return 'assistant';
    }
    
    if (text.length < 100 && timeSinceUser < 30000 && timeSinceUser > 500) {
      if (!text.includes('testmessage') && !text.toLowerCase().includes('respond')) {
        return 'assistant';
      }
    }
    
    if (timeSinceUser < 30000 && timeSinceUser > 1000) {
      return 'assistant';
    }
    
    return 'unknown';
  }
  
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing with enhanced user detection integration...`);
    
    if (window.enhancedUserDetection) {
      console.log(`${LOGGER_NAME} ✅ Enhanced user detection found and integrated`);
    } else {
      console.log(`${LOGGER_NAME} ⚠️ Enhanced user detection not found - some features may be limited`);
    }
    
    console.log(`${LOGGER_NAME} Filter thresholds:`);
    console.log(`  - Velocity: ${config.velocityThreshold} msgs/${config.velocityWindow}ms`);
    console.log(`  - Temporal: ${config.conversationWindow}ms conversation window`);
    console.log(`  - Pattern: ${config.patternThreshold}+ consecutive = suspicious`);
    console.log(`  - Contextual: Musical commands preserved for ${config.musicalCommandWindow}ms`);
    
    setupMessageCapture();
    
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
  
  initialize();
  
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
  
  console.log(`${LOGGER_NAME} ✅ Signal processing logger with enhanced user detection ready!`);
  
})();

console.log('🎉 COMPLETE SOLUTION LOADED SUCCESSFULLY!');
console.log('');
console.log('🔧 DEBUG COMMANDS:');
console.log('window.enhancedUserDetection.getStats()    - User detection statistics');
console.log('window.signalProcessingLogger.getStats()   - Signal processing statistics');
console.log('window.genuineUserInputs                   - Current genuine input markers');
console.log('');
console.log('🧪 TEST COMMAND:');
console.log('window.enhancedUserDetection.testDetection("test message")');
console.log('');
console.log('📋 To test the fix:');
console.log('1. Type: "testmessage150, respond okay150"');
console.log('2. Wait 15+ seconds');
console.log('3. Type the EXACT same message again');
console.log('4. Both should now appear in chat.log');
console.log('');