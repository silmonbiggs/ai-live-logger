// Enhanced User Detection Logger - Fixes broken user send detection in Claude interface
// This fixes the core issue where onUserSendMessage() never gets called
// Copy this entire content and paste it into Claude's F12 console

(function() {
  'use strict';
  
  const LOGGER_NAME = '[ENHANCED USER DETECTION]';
  console.log(`${LOGGER_NAME} Initializing comprehensive user send detection...`);
  
  // Storage for user interaction tracking
  const state = {
    // Message tracking
    processedMessages: new Map(),
    messageSequence: [],
    conversationHistory: [],
    
    // User interaction detection
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    
    // Enhanced user send detection
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
    
    // User send detection statistics
    detectionStats: {
      sendButtonClicks: 0,
      keyboardSubmissions: 0,
      inputDetections: 0,
      webSocketMessages: 0,
      formSubmissions: 0,
      successfulDetections: 0,
      missedDetections: 0
    },
    
    // Grace period handling for legitimate repeats
    gracePeriod: 10000, // 10 seconds grace period for legitimate repeats
    lastProcessedContent: '',
    lastProcessedTime: 0
  };
  
  /**
   * MAIN FIX: Multi-layered user send detection
   * This replaces the broken setupUserSendDetection() function
   */
  function setupComprehensiveUserSendDetection() {
    console.log(`${LOGGER_NAME} 🔧 Setting up comprehensive user send detection...`);
    
    // LAYER 1: Send Button Click Detection
    setupSendButtonDetection();
    
    // LAYER 2: Keyboard Submission Detection (Enter key)
    setupKeyboardDetection();
    
    // LAYER 3: Input Field Monitoring
    setupInputFieldMonitoring();
    
    // LAYER 4: Form Submission Detection
    setupFormSubmissionDetection();
    
    // LAYER 5: WebSocket Message Interception
    setupWebSocketInterception();
    
    // LAYER 6: MutationObserver for Send Button State Changes
    setupSendButtonStateMonitoring();
    
    console.log(`${LOGGER_NAME} ✅ All detection layers initialized`);
  }
  
  /**
   * LAYER 1: Send Button Click Detection
   * Monitors clicks on potential send buttons using multiple selectors
   */
  function setupSendButtonDetection() {
    const sendButtonSelectors = [
      // Common send button selectors
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[type="submit"]',
      'button:contains("Send")',
      '[data-testid="send-button"]',
      '[data-cy="send-button"]',
      '.send-button',
      '.submit-button',
      // Claude-specific selectors (discovered via inspection)
      'button[aria-label*="send"]',
      'button[aria-label*="Submit"]',
      'button svg[data-icon="send"]',
      // Generic button detection near input areas
      'form button',
      'div[contenteditable] + button',
      'textarea + button',
      'input[type="text"] + button'
    ];
    
    // Use event delegation to catch all button clicks
    document.addEventListener('click', function(event) {
      const target = event.target;
      
      // Check if clicked element matches any send button selector
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
        
        // Capture user input content
        const userContent = captureUserInputContent();
        if (userContent && userContent.trim()) {
          onUserSendMessage(userContent, 'send_button_click');
        }
      }
      
      // Also check for any button near input fields
      const nearbyInput = findNearbyInputElement(target);
      if (nearbyInput) {
        const inputContent = getInputElementValue(nearbyInput);
        if (inputContent && inputContent.trim() && target.tagName === 'BUTTON') {
          console.log(`${LOGGER_NAME} 🎯 BUTTON NEAR INPUT DETECTED:`, target, 'input:', inputContent.slice(0, 30));
          state.detectionStats.sendButtonClicks++;
          onUserSendMessage(inputContent, 'button_near_input');
        }
      }
    }, true); // Use capture phase
    
    console.log(`${LOGGER_NAME} ✅ Send button detection active with ${sendButtonSelectors.length} selectors`);
  }
  
  /**
   * LAYER 2: Keyboard Submission Detection
   * Monitors Enter key presses and Ctrl+Enter combinations
   */
  function setupKeyboardDetection() {
    document.addEventListener('keydown', function(event) {
      // Check for submission key combinations
      const isSubmissionKey = (
        (event.key === 'Enter' && !event.shiftKey) ||  // Enter without Shift
        (event.key === 'Enter' && event.ctrlKey) ||    // Ctrl+Enter
        (event.key === 'Enter' && event.metaKey)       // Cmd+Enter (Mac)
      );
      
      if (isSubmissionKey) {
        const target = event.target;
        
        // Check if we're in an input element
        if (target.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')) {
          console.log(`${LOGGER_NAME} 🎯 KEYBOARD SUBMISSION DETECTED:`, target.tagName, event.key);
          state.detectionStats.keyboardSubmissions++;
          
          const userContent = getInputElementValue(target);
          if (userContent && userContent.trim()) {
            // Add small delay to ensure content is captured
            setTimeout(() => {
              onUserSendMessage(userContent, 'keyboard_submission');
            }, 50);
          }
        }
      }
    }, true);
    
    console.log(`${LOGGER_NAME} ✅ Keyboard submission detection active`);
  }
  
  /**
   * LAYER 3: Input Field Monitoring
   * Tracks changes in input fields and potential submissions
   */
  function setupInputFieldMonitoring() {
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ];
    
    // Monitor input changes
    document.addEventListener('input', function(event) {
      const target = event.target;
      
      if (inputSelectors.some(selector => {
        try { return target.matches(selector); } catch(e) { return false; }
      })) {
        const content = getInputElementValue(target);
        state.userSendTracking.lastInputContent = content;
        state.detectionStats.inputDetections++;
        
        // Track that user is actively typing
        state.lastUserInteraction = Date.now();
        state.userSendTracking.inputTrackingActive = true;
      }
    });
    
    // Monitor focus events to identify active input
    document.addEventListener('focusin', function(event) {
      const target = event.target;
      
      if (inputSelectors.some(selector => {
        try { return target.matches(selector); } catch(e) { return false; }
      })) {
        console.log(`${LOGGER_NAME} 📍 Input field focused:`, target.tagName);
        
        // Set up observer for this specific input element
        if (state.userSendTracking.inputElementObserver) {
          state.userSendTracking.inputElementObserver.disconnect();
        }
        
        // Monitor for value changes on the focused element
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
  
  /**
   * LAYER 4: Form Submission Detection
   * Monitors form submissions that might contain user messages
   */
  function setupFormSubmissionDetection() {
    document.addEventListener('submit', function(event) {
      console.log(`${LOGGER_NAME} 🎯 FORM SUBMISSION DETECTED:`, event.target);
      state.detectionStats.formSubmissions++;
      
      const form = event.target;
      const formData = new FormData(form);
      
      // Try to find user input in form data
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string' && value.trim() && value.length > 2) {
          console.log(`${LOGGER_NAME} Form field "${key}":`, value.slice(0, 50));
          onUserSendMessage(value, 'form_submission');
          break; // Take first meaningful value
        }
      }
      
      // Also check input elements within the form
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
  
  /**
   * LAYER 5: WebSocket Message Interception
   * Intercepts WebSocket messages to catch user submissions
   */
  function setupWebSocketInterception() {
    try {
      // Store original WebSocket constructor
      const OriginalWebSocket = window.WebSocket;
      
      // Override WebSocket constructor
      window.WebSocket = function(url, protocols) {
        console.log(`${LOGGER_NAME} 🔗 WebSocket connection detected:`, url);
        
        const ws = new OriginalWebSocket(url, protocols);
        
        // Override send method
        const originalSend = ws.send;
        ws.send = function(data) {
          console.log(`${LOGGER_NAME} 📡 WebSocket message sent:`, typeof data, data ? data.toString().slice(0, 100) : 'empty');
          state.detectionStats.webSocketMessages++;
          
          // Try to parse and extract user content
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.message || parsed.content || parsed.text) {
                const userContent = parsed.message || parsed.content || parsed.text;
                console.log(`${LOGGER_NAME} 🎯 User content in WebSocket:`, userContent.slice(0, 50));
                onUserSendMessage(userContent, 'websocket_message');
              }
            } catch (e) {
              // Not JSON, check if it looks like user input
              if (data.length > 5 && data.length < 2000) {
                onUserSendMessage(data, 'websocket_raw');
              }
            }
          }
          
          return originalSend.call(this, data);
        };
        
        return ws;
      };
      
      // Copy static properties
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
  
  /**
   * LAYER 6: Send Button State Monitoring
   * Monitors for send button state changes (disabled -> enabled) which often indicates ready to send
   */
  function setupSendButtonStateMonitoring() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
          const target = mutation.target;
          
          // Check if this is potentially a send button
          if (target.tagName === 'BUTTON') {
            const wasDisabled = mutation.oldValue === 'disabled' || mutation.oldValue === '';
            const isNowEnabled = !target.disabled;
            
            if (wasDisabled && isNowEnabled) {
              console.log(`${LOGGER_NAME} 🔄 Send button enabled:`, target);
              
              // Button just became enabled - user might have entered content
              const userContent = captureUserInputContent();
              if (userContent && userContent.trim()) {
                // Don't immediately trigger, wait for actual click/submit
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
  
  /**
   * Helper function to capture user input content from various sources
   */
  function captureUserInputContent() {
    // Try multiple strategies to find user input content
    
    // 1. Check tracked input content
    if (state.userSendTracking.lastInputContent && 
        state.userSendTracking.lastInputContent.trim()) {
      return state.userSendTracking.lastInputContent;
    }
    
    // 2. Find focused input element
    const focused = document.activeElement;
    if (focused && focused.matches('input, textarea, [contenteditable]')) {
      const content = getInputElementValue(focused);
      if (content && content.trim()) {
        return content;
      }
    }
    
    // 3. Find input elements with content
    const inputElements = document.querySelectorAll('input, textarea, [contenteditable="true"], [contenteditable=""]');
    for (const element of inputElements) {
      const content = getInputElementValue(element);
      if (content && content.trim() && content.length > 2) {
        return content;
      }
    }
    
    return null;
  }
  
  /**
   * Helper function to get value from various input element types
   */
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
  
  /**
   * Helper function to find nearby input elements
   */
  function findNearbyInputElement(target) {
    // Check parent elements for input fields
    let current = target.parentElement;
    let depth = 0;
    
    while (current && depth < 5) {
      const inputs = current.querySelectorAll('input, textarea, [contenteditable]');
      if (inputs.length > 0) {
        return inputs[inputs.length - 1]; // Return the last (most recent) input
      }
      current = current.parentElement;
      depth++;
    }
    
    // Check siblings
    const siblings = target.parentElement ? target.parentElement.querySelectorAll('input, textarea, [contenteditable]') : [];
    return siblings.length > 0 ? siblings[siblings.length - 1] : null;
  }
  
  /**
   * ENHANCED USER SEND DETECTION - Fixed implementation
   * This is the function that was broken in the original code
   */
  function onUserSendMessage(userContent, detectionMethod) {
    const now = Date.now();
    
    if (!userContent || !userContent.trim()) {
      console.log(`${LOGGER_NAME} ⚠️ Empty user content, skipping detection`);
      return;
    }
    
    console.log(`${LOGGER_NAME} 🎯 USER SEND DETECTED via ${detectionMethod}: "${userContent.slice(0, 50)}..."`);
    
    // Check for duplicate detection within grace period
    if (state.lastProcessedContent === userContent && 
        (now - state.lastProcessedTime) < state.gracePeriod) {
      console.log(`${LOGGER_NAME} 🔄 Ignoring duplicate detection within grace period (${now - state.lastProcessedTime}ms)`);
      return;
    }
    
    // Update tracking
    state.lastProcessedContent = userContent;
    state.lastProcessedTime = now;
    state.detectionStats.successfulDetections++;
    
    // Check if we're already awaiting a response (prevent multiple triggers)
    if (state.userSendTracking.awaitingResponse) {
      const timeSinceLastSend = now - state.userSendTracking.userSentAt;
      if (timeSinceLastSend < 2000) {
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
    console.log(`${LOGGER_NAME} 📍 Detection method: ${detectionMethod}`);
    console.log(`${LOGGER_NAME} 📍 User message window: 5s, Response window: ${state.userSendTracking.responseWindow}ms`);
    
    // Mark this as a genuine user input for bypass filtering
    markAsGenuineUserInput(userContent, detectionMethod);
  }
  
  /**
   * Mark content as genuine user input to bypass filtering
   */
  function markAsGenuineUserInput(content, detectionMethod) {
    // Store this as a genuine user input with timestamp
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
    
    // Store in global scope for signal processing logger to access
    window.genuineUserInputs = window.genuineUserInputs || new Map();
    window.genuineUserInputs.set(content, marker);
    
    console.log(`${LOGGER_NAME} ✅ Marked as genuine user input: "${content.slice(0, 30)}..." via ${detectionMethod}`);
    
    // Clean up old markers (older than 30 seconds)
    for (const [key, value] of window.genuineUserInputs.entries()) {
      if (timestamp - value.timestamp > 30000) {
        window.genuineUserInputs.delete(key);
      }
    }
  }
  
  /**
   * Get detection statistics
   */
  function getDetectionStats() {
    return {
      ...state.detectionStats,
      uptime: Date.now() - state.sessionStart,
      genuineInputsMarked: window.genuineUserInputs ? window.genuineUserInputs.size : 0
    };
  }
  
  /**
   * Initialize the enhanced user detection system
   */
  function initialize() {
    console.log(`${LOGGER_NAME} 🚀 Starting enhanced user detection system...`);
    
    setupComprehensiveUserSendDetection();
    
    console.log(`${LOGGER_NAME} ✅ Enhanced user detection system ready!`);
    console.log(`${LOGGER_NAME} Monitoring for user inputs via:`)
    console.log(`  - Send button clicks`);
    console.log(`  - Keyboard submissions (Enter, Ctrl+Enter)`);
    console.log(`  - Input field monitoring`);
    console.log(`  - Form submissions`);
    console.log(`  - WebSocket message interception`);
    console.log(`  - Send button state changes`);
  }
  
  // Start the enhanced detection system
  initialize();
  
  // Expose for debugging
  window.enhancedUserDetection = {
    getStats: getDetectionStats,
    getState: () => state,
    markAsGenuine: markAsGenuineUserInput,
    testDetection: (content) => onUserSendMessage(content, 'manual_test')
  };
  
  console.log(`${LOGGER_NAME} 🔧 Debug available: window.enhancedUserDetection.getStats(), .getState(), .testDetection()`);
  
})();