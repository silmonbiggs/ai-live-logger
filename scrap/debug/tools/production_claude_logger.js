// Production-ready Claude logger with proper message detection
(function() {
  'use strict';
  
  const LOGGER_NAME = '[PRODUCTION CLAUDE LOGGER]';
  console.log(`${LOGGER_NAME} Starting production DOM-based logger...`);
  
  // Storage for conversation state
  const state = {
    processedMessages: new Map(),
    conversationHistory: [],
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    messageSequence: 0
  };
  
  // Helper functions
  function normText(s) {
    return String(s || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
  
  function sendToServer(payload) {
    fetch('http://localhost:8788/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => response.text())
    .then(result => {
      console.log(`${LOGGER_NAME} ✅ Logged:`, payload.role, payload.text.slice(0, 50), '-> Server:', result);
    })
    .catch(error => {
      console.log(`${LOGGER_NAME} ❌ Log failed:`, error.message);
    });
  }
  
  /**
   * PRODUCTION MESSAGE ROLE DETECTION
   * Uses DOM structure and conversation flow instead of artificial patterns
   */
  function detectMessageRole(element, text, context = {}) {
    // 1. EXPLICIT ATTRIBUTES (most reliable)
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr && (roleAttr === 'user' || roleAttr === 'assistant')) {
      return roleAttr;
    }
    
    // Check parent elements for role attributes
    let parent = element.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentRole = parent.getAttribute('data-message-author-role');
      if (parentRole && (parentRole === 'user' || parentRole === 'assistant')) {
        return parentRole;
      }
      parent = parent.parentElement;
    }
    
    // 2. CONVERSATION FLOW ANALYSIS
    // User messages typically appear right after input submission
    const now = Date.now();
    if (context.wasRecentlyTyped && (now - state.lastUserInteraction) < 5000) {
      state.lastUserInteraction = now;
      return 'user';
    }
    
    // Assistant messages typically appear after user messages
    const timeSinceLastUser = now - state.lastUserInteraction;
    if (timeSinceLastUser < 30000 && timeSinceLastUser > 1000) {
      // This looks like a response to recent user activity
      return 'assistant';
    }
    
    // 3. DOM STRUCTURE ANALYSIS
    // Check if element is in a message-like container
    const hasArticleParent = element.closest('article') !== null;
    const hasMainParent = element.closest('main') !== null;
    const hasMessageClass = element.className && element.className.includes('message');
    
    if (hasArticleParent || hasMainParent || hasMessageClass) {
      // Use sequence to alternate roles (conversation pattern)
      const isEvenSequence = (state.messageSequence % 2) === 0;
      state.messageSequence++;
      
      // In most conversations: user starts (even), assistant responds (odd)
      return isEvenSequence ? 'user' : 'assistant';
    }
    
    // 4. CONTENT-BASED HEURISTICS (fallback only)
    // Short responses that look like confirmations/responses
    if (text.length < 50 && (
      text.includes('_ok') || 
      text.match(/^(ok|yes|no|done|thanks|sure)$/i) ||
      text.match(/^\w+_\w+$/) // pattern_like_responses
    )) {
      return 'assistant';
    }
    
    // Longer text that looks like questions/requests
    if (text.length > 20 && (
      text.includes('?') ||
      text.match(/^(can you|please|how|what|when|where|why)/i) ||
      text.match(/^[A-Z]/) // Capitalized sentences (user input style)
    )) {
      return 'user';
    }
    
    console.warn(`${LOGGER_NAME} Could not determine role for:`, text.slice(0, 30));
    return 'unknown';
  }
  
  function isNewMessage(text, role) {
    const now = Date.now();
    
    // Check if we've seen this exact text recently
    if (state.processedMessages.has(text)) {
      const lastSeen = state.processedMessages.get(text);
      const timeSince = now - lastSeen;
      
      // Allow legitimate repeats within reasonable timeframe
      if (role === 'user' && timeSince < 60000) {
        console.log(`${LOGGER_NAME} Allowing user repeat (${timeSince}ms ago):`, text.slice(0, 30));
        return true;
      }
      
      // Allow assistant responses if there was recent user activity
      if (role === 'assistant' && timeSince < 30000 && (now - state.lastUserInteraction) < 60000) {
        console.log(`${LOGGER_NAME} Allowing assistant response (${timeSince}ms ago):`, text.slice(0, 30));
        return true;
      }
      
      // Block old duplicates (likely retransmission)
      if (timeSince > 300000) { // 5 minutes
        console.log(`${LOGGER_NAME} 🚫 BLOCKING old duplicate (${Math.round(timeSince/60000)}min ago):`, text.slice(0, 30));
        return false;
      }
    }
    
    return true;
  }
  
  function logMessage(element, role, context = {}) {
    try {
      const text = normText(element.textContent || element.innerText || '');
      
      if (!text || text.length < 1) return;
      
      // Check if this is a new message worth logging
      if (!isNewMessage(text, role)) {
        return;
      }
      
      const now = Date.now();
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
          sequence: state.messageSequence,
          detectionMethod: context.detectionMethod || 'dom_mutation'
        }
      };
      
      // Update state
      state.processedMessages.set(text, now);
      state.conversationHistory.push({ text, role, timestamp: now });
      
      if (role === 'user') {
        state.lastUserInteraction = now;
      }
      
      // Keep history manageable
      if (state.conversationHistory.length > 50) {
        state.conversationHistory = state.conversationHistory.slice(-25);
      }
      
      console.log(`${LOGGER_NAME} 📝 Capturing ${role} message (${context.detectionMethod || 'mutation'}):`, text.slice(0, 50));
      sendToServer(payload);
      
    } catch (error) {
      console.error(`${LOGGER_NAME} Error logging message:`, error);
    }
  }
  
  /**
   * PRODUCTION MESSAGE CAPTURE SYSTEM
   * Monitors for real message additions to the DOM
   */
  function setupMessageCapture() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              
              // Check for direct message elements
              const messageSelectors = [
                '[data-message-author-role]',
                '[data-message-id]',
                'article',
                '[role="article"]'
              ];
              
              let messageElement = null;
              let detectedRole = null;
              
              // Check if node itself is a message
              for (const selector of messageSelectors) {
                try {
                  if (node.matches && node.matches(selector)) {
                    messageElement = node;
                    detectedRole = detectMessageRole(node, node.textContent || '', { 
                      detectionMethod: 'direct_match',
                      wasRecentlyTyped: false 
                    });
                    break;
                  }
                } catch (e) {
                  // Skip invalid selectors
                }
              }
              
              // Check if node contains message elements
              if (!messageElement) {
                for (const selector of messageSelectors) {
                  try {
                    const foundElement = node.querySelector(selector);
                    if (foundElement) {
                      messageElement = foundElement;
                      detectedRole = detectMessageRole(foundElement, foundElement.textContent || '', { 
                        detectionMethod: 'nested_match',
                        wasRecentlyTyped: false 
                      });
                      break;
                    }
                  } catch (e) {
                    // Skip invalid selectors
                  }
                }
              }
              
              // Fallback: any element with substantial text content
              if (!messageElement && node.textContent) {
                const text = node.textContent.trim();
                if (text.length > 5 && text.length < 2000) {
                  // This might be a message - analyze it
                  const role = detectMessageRole(node, text, { 
                    detectionMethod: 'content_analysis',
                    wasRecentlyTyped: false 
                  });
                  
                  if (role !== 'unknown') {
                    messageElement = node;
                    detectedRole = role;
                  }
                }
              }
              
              if (messageElement && detectedRole && detectedRole !== 'unknown') {
                console.log(`${LOGGER_NAME} 🔍 Found ${detectedRole} message element:`, messageElement.textContent?.slice(0, 50));
                
                // Small delay to allow for streaming completion
                setTimeout(() => {
                  logMessage(messageElement, detectedRole, { detectionMethod: 'dom_mutation' });
                }, 100);
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
    
    console.log(`${LOGGER_NAME} ✅ Production message capture observer active`);
  }
  
  /**
   * INPUT MONITORING for real-time user message detection
   */
  function setupInputMonitoring() {
    // Find and monitor the input field
    const inputSelectors = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="message"]',
      '[contenteditable="true"]',
      'textarea'
    ];
    
    let inputElement = null;
    for (const selector of inputSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        inputElement = elements[0];
        break;
      }
    }
    
    if (inputElement) {
      console.log(`${LOGGER_NAME} 📝 Found input element:`, inputElement.tagName, inputElement.placeholder);
      
      // Monitor for message submission
      inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const text = inputElement.value || inputElement.textContent;
          if (text && text.trim()) {
            console.log(`${LOGGER_NAME} 🎯 User submitting message:`, text.slice(0, 30));
            state.lastUserInteraction = Date.now();
            
            // Wait for DOM to update with the user message
            setTimeout(() => {
              // Look for the recently added user message in DOM
              const recentMessages = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent && el.textContent.includes(text.trim()));
              
              recentMessages.forEach(el => {
                if (el.textContent.trim() === text.trim()) {
                  logMessage(el, 'user', { 
                    detectionMethod: 'input_submission',
                    wasRecentlyTyped: true 
                  });
                }
              });
            }, 500);
          }
        }
      });
    }
  }
  
  // Initialize the production logger
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing production Claude logger...`);
    
    // Set up message capture systems
    setupMessageCapture();
    setupInputMonitoring();
    
    // Mark existing messages to avoid duplicating history
    const existingElements = document.querySelectorAll('*');
    let markedCount = 0;
    
    existingElements.forEach(el => {
      const text = normText(el.textContent || '');
      if (text && text.length > 3 && text.length < 500) {
        // Mark as already processed to avoid logging old history
        state.processedMessages.set(text, state.sessionStart - 1000);
        markedCount++;
      }
    });
    
    console.log(`${LOGGER_NAME} ✅ Production logger initialized - Marked ${markedCount} existing elements as processed`);
  }
  
  // Start the production logger
  initialize();
  
  // Expose for debugging
  window.productionClaudeLogger = {
    getState: () => state,
    testLog: (text, role = 'assistant') => {
      const fakeElement = { textContent: text };
      logMessage(fakeElement, role, { detectionMethod: 'manual_test' });
    },
    clearState: () => {
      state.processedMessages.clear();
      state.conversationHistory = [];
      state.messageSequence = 0;
      console.log(`${LOGGER_NAME} State cleared`);
    }
  };
  
  console.log(`${LOGGER_NAME} ✅ Production Claude logger ready!`);
  console.log('Debug functions: window.productionClaudeLogger.getState(), .testLog(), .clearState()');
  
})();