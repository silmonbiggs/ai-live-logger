// Production Claude logger with DOM persistence filtering to eliminate ghost messages
(function() {
  'use strict';
  
  const LOGGER_NAME = '[PERSISTENCE FILTERED LOGGER]';
  console.log(`${LOGGER_NAME} Starting persistence-filtered DOM-based logger...`);
  
  // Storage for conversation state
  const state = {
    processedMessages: new Map(),
    pendingMessages: new Map(), // Messages waiting for persistence validation
    conversationHistory: [],
    lastUserInteraction: 0,
    sessionStart: Date.now(),
    messageSequence: 0
  };
  
  // Configuration
  const config = {
    persistenceThreshold: 500, // Messages must exist for 500ms to be considered real
    ghostDetectionDelay: 100,  // Wait 100ms before starting persistence check
    maxPendingMessages: 20     // Limit pending messages to prevent memory bloat
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
   * Check if a message element still exists and is visible in the DOM
   */
  function isElementPersistent(element, originalText) {
    try {
      // Check if element is still in DOM
      if (!document.body.contains(element)) {
        console.log(`${LOGGER_NAME} 👻 Element removed from DOM:`, originalText.slice(0, 30));
        return false;
      }
      
      // Check if text content is still the same
      const currentText = normText(element.textContent || element.innerText || '');
      if (currentText !== originalText) {
        console.log(`${LOGGER_NAME} 👻 Element text changed: "${originalText.slice(0, 30)}" -> "${currentText.slice(0, 30)}"`);
        return false;
      }
      
      // Check if element is visible (not just display:none)
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        console.log(`${LOGGER_NAME} 👻 Element hidden:`, originalText.slice(0, 30));
        return false;
      }
      
      return true;
    } catch (error) {
      console.log(`${LOGGER_NAME} 👻 Error checking persistence:`, error.message);
      return false;
    }
  }
  
  /**
   * Check if this message is a ghost retransmission by looking for duplicates in current DOM
   */
  function isGhostRetransmission(text, element) {
    try {
      // Look for other elements in the DOM with the same text
      const allElements = Array.from(document.querySelectorAll('*'));
      const matchingElements = allElements.filter(el => {
        const elText = normText(el.textContent || '');
        return elText === text && el !== element;
      });
      
      if (matchingElements.length > 0) {
        console.log(`${LOGGER_NAME} 👻 Found ${matchingElements.length} duplicate elements for:`, text.slice(0, 30));
        
        // Check if any of the matching elements are more "established" (have been around longer)
        const hasEstablishedDuplicate = matchingElements.some(el => {
          // If element is in a more stable container, it's likely the "real" one
          return el.closest('[data-message-author-role]') || 
                 el.closest('article') || 
                 el.closest('main');
        });
        
        if (hasEstablishedDuplicate) {
          console.log(`${LOGGER_NAME} 👻 Found established duplicate, marking as ghost:`, text.slice(0, 30));
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log(`${LOGGER_NAME} Error checking for ghost retransmission:`, error.message);
      return false;
    }
  }
  
  /**
   * PRODUCTION MESSAGE ROLE DETECTION (same as before)
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
    const now = Date.now();
    if (context.wasRecentlyTyped && (now - state.lastUserInteraction) < 5000) {
      state.lastUserInteraction = now;
      return 'user';
    }
    
    // Assistant messages typically appear after user messages
    const timeSinceLastUser = now - state.lastUserInteraction;
    if (timeSinceLastUser < 30000 && timeSinceLastUser > 1000) {
      return 'assistant';
    }
    
    // 3. DOM STRUCTURE ANALYSIS
    const hasArticleParent = element.closest('article') !== null;
    const hasMainParent = element.closest('main') !== null;
    const hasMessageClass = element.className && element.className.includes('message');
    
    if (hasArticleParent || hasMainParent || hasMessageClass) {
      const isEvenSequence = (state.messageSequence % 2) === 0;
      state.messageSequence++;
      return isEvenSequence ? 'user' : 'assistant';
    }
    
    // 4. CONTENT-BASED HEURISTICS (fallback only)
    if (text.length < 50 && (
      text.includes('_ok') || 
      text.match(/^(ok|yes|no|done|thanks|sure)$/i) ||
      text.match(/^\w+_\w+$/)
    )) {
      return 'assistant';
    }
    
    if (text.length > 20 && (
      text.includes('?') ||
      text.match(/^(can you|please|how|what|when|where|why)/i) ||
      text.match(/^[A-Z]/)
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
  
  /**
   * PERSISTENCE-VALIDATED MESSAGE LOGGING
   * Only logs messages that persist in the DOM for the threshold duration
   */
  function scheduleMessageForPersistenceCheck(element, role, text, context = {}) {
    const messageId = `${text}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`${LOGGER_NAME} 📋 Scheduling persistence check for ${role}:`, text.slice(0, 30));
    
    // Add to pending messages
    state.pendingMessages.set(messageId, {
      element: element,
      role: role,
      text: text,
      context: context,
      scheduledAt: Date.now(),
      persistenceCheckId: null
    });
    
    // Clean up old pending messages
    if (state.pendingMessages.size > config.maxPendingMessages) {
      const oldestKey = Array.from(state.pendingMessages.keys())[0];
      state.pendingMessages.delete(oldestKey);
    }
    
    // Schedule persistence check
    const persistenceCheckId = setTimeout(() => {
      validateMessagePersistence(messageId);
    }, config.persistenceThreshold);
    
    // Update the pending message with the timeout ID
    const pendingMessage = state.pendingMessages.get(messageId);
    if (pendingMessage) {
      pendingMessage.persistenceCheckId = persistenceCheckId;
    }
  }
  
  /**
   * Validate that a message has persisted and should be logged
   */
  function validateMessagePersistence(messageId) {
    const pendingMessage = state.pendingMessages.get(messageId);
    if (!pendingMessage) {
      console.log(`${LOGGER_NAME} ⚠️ Pending message not found:`, messageId);
      return;
    }
    
    const { element, role, text, context } = pendingMessage;
    
    // Remove from pending
    state.pendingMessages.delete(messageId);
    
    // Check if message is still persistent
    if (!isElementPersistent(element, text)) {
      console.log(`${LOGGER_NAME} 👻 GHOST MESSAGE filtered out:`, text.slice(0, 30));
      return;
    }
    
    // Check if this is a ghost retransmission
    if (isGhostRetransmission(text, element)) {
      console.log(`${LOGGER_NAME} 👻 GHOST RETRANSMISSION filtered out:`, text.slice(0, 30));
      return;
    }
    
    // Check if this is a new message worth logging
    if (!isNewMessage(text, role)) {
      console.log(`${LOGGER_NAME} 🚫 DUPLICATE filtered out:`, text.slice(0, 30));
      return;
    }
    
    // Message has passed all persistence checks - log it!
    logValidatedMessage(element, role, text, context);
  }
  
  /**
   * Log a message that has been validated for persistence
   */
  function logValidatedMessage(element, role, text, context = {}) {
    try {
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
          detectionMethod: context.detectionMethod || 'persistence_validated',
          persistenceValidated: true
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
      
      console.log(`${LOGGER_NAME} ✅ VALIDATED MESSAGE - ${role}:`, text.slice(0, 50));
      sendToServer(payload);
      
    } catch (error) {
      console.error(`${LOGGER_NAME} Error logging validated message:`, error);
    }
  }
  
  /**
   * PERSISTENCE-FILTERED MESSAGE CAPTURE SYSTEM
   */
  function setupMessageCapture() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              
              // Wait a brief moment to let DOM settle before analyzing
              setTimeout(() => {
                analyzeNodeForMessages(node);
              }, config.ghostDetectionDelay);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Persistence-filtered message capture observer active`);
  }
  
  /**
   * Analyze a DOM node for potential messages
   */
  function analyzeNodeForMessages(node) {
    try {
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
            const text = normText(node.textContent || '');
            detectedRole = detectMessageRole(node, text, { 
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
              const text = normText(foundElement.textContent || '');
              detectedRole = detectMessageRole(foundElement, text, { 
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
        const text = normText(node.textContent);
        if (text.length > 5 && text.length < 2000) {
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
        const text = normText(messageElement.textContent || '');
        
        console.log(`${LOGGER_NAME} 🔍 Found potential ${detectedRole} message, scheduling persistence check:`, text.slice(0, 50));
        
        // Schedule for persistence validation instead of immediate logging
        scheduleMessageForPersistenceCheck(messageElement, detectedRole, text, { 
          detectionMethod: 'dom_mutation_with_persistence' 
        });
      }
    } catch (error) {
      console.error(`${LOGGER_NAME} Error analyzing node:`, error);
    }
  }
  
  // Initialize the persistence-filtered logger
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing persistence-filtered Claude logger...`);
    
    // Set up message capture systems
    setupMessageCapture();
    
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
    
    console.log(`${LOGGER_NAME} ✅ Persistence-filtered logger initialized - Marked ${markedCount} existing elements as processed`);
    console.log(`${LOGGER_NAME} 🕐 Using ${config.persistenceThreshold}ms persistence threshold`);
  }
  
  // Start the persistence-filtered logger
  initialize();
  
  // Expose for debugging
  window.persistenceFilteredLogger = {
    getState: () => ({
      ...state,
      pendingMessages: Array.from(state.pendingMessages.entries()).map(([id, data]) => ({
        id,
        text: data.text.slice(0, 30),
        role: data.role,
        scheduledAt: data.scheduledAt
      }))
    }),
    testLog: (text, role = 'assistant') => {
      const fakeElement = { textContent: text };
      scheduleMessageForPersistenceCheck(fakeElement, role, text, { detectionMethod: 'manual_test' });
    },
    clearState: () => {
      state.processedMessages.clear();
      state.conversationHistory = [];
      state.messageSequence = 0;
      // Clear pending messages and their timeouts
      state.pendingMessages.forEach(pending => {
        if (pending.persistenceCheckId) {
          clearTimeout(pending.persistenceCheckId);
        }
      });
      state.pendingMessages.clear();
      console.log(`${LOGGER_NAME} State cleared including ${state.pendingMessages.size} pending messages`);
    }
  };
  
  console.log(`${LOGGER_NAME} ✅ Persistence-filtered Claude logger ready!`);
  console.log('Debug functions: window.persistenceFilteredLogger.getState(), .testLog(), .clearState()');
  
})();