// Direct Claude logger that bypasses extension and logs via DevTools
(function() {
  'use strict';
  
  const LOGGER_NAME = '[DIRECT CLAUDE LOGGER]';
  console.log(`${LOGGER_NAME} Starting direct DOM-based logger...`);
  
  // Storage for conversation state
  const state = {
    processedMessages: new Map(), // text -> timestamp
    conversationHistory: [],
    lastUserInteraction: 0,
    sessionStart: Date.now()
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
  
  function isNewMessage(text, role) {
    const now = Date.now();
    
    // Check if we've seen this exact text recently
    if (state.processedMessages.has(text)) {
      const lastSeen = state.processedMessages.get(text);
      const timeSince = now - lastSeen;
      
      // Allow legitimate repeats within 30 seconds (user might repeat same message)
      if (timeSince < 30000) {
        console.log(`${LOGGER_NAME} Allowing recent repeat (${timeSince}ms ago):`, text.slice(0, 30));
        return true;
      }
      
      // Block old duplicates (likely Claude retransmission)
      if (timeSince > 60000) {
        console.log(`${LOGGER_NAME} 🚫 BLOCKING old duplicate (${timeSince}ms ago):`, text.slice(0, 30));
        return false;
      }
    }
    
    // For assistant messages, check if there was recent user interaction
    if (role === 'assistant') {
      const timeSinceUser = now - state.lastUserInteraction;
      if (timeSinceUser > 120000 && state.lastUserInteraction > 0) {
        console.log(`${LOGGER_NAME} 🚫 BLOCKING assistant message without recent user interaction (${timeSinceUser}ms):`, text.slice(0, 30));
        return false;
      }
    }
    
    return true;
  }
  
  function logMessage(element, role) {
    try {
      const text = normText(element.textContent || element.innerText || '');
      
      if (!text || text.length < 3) return;
      
      // Check if this is a new message
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
          artifacts: [], // TODO: Add artifact detection
          tools: [], // TODO: Add tool detection  
          streaming: false,
          messageLength: text.length,
          directLogger: true, // Mark as coming from direct logger
          timestamp: now,
          conversationId: getConvoId()
        }
      };
      
      // Update state
      state.processedMessages.set(text, now);
      state.conversationHistory.push({ text, role, timestamp: now });
      
      // Keep history manageable
      if (state.conversationHistory.length > 50) {
        state.conversationHistory = state.conversationHistory.slice(-25);
      }
      
      // Clean old processed messages
      if (state.processedMessages.size > 100) {
        const tenMinutesAgo = now - 600000;
        for (const [key, timestamp] of state.processedMessages.entries()) {
          if (timestamp < tenMinutesAgo) {
            state.processedMessages.delete(key);
          }
        }
      }
      
      if (role === 'user') {
        state.lastUserInteraction = now;
      }
      
      console.log(`${LOGGER_NAME} 📝 Capturing ${role} message:`, text.slice(0, 50));
      sendToServer(payload);
      
    } catch (error) {
      console.error(`${LOGGER_NAME} Error logging message:`, error);
    }
  }
  
  // Enhanced message detection with comprehensive selectors
  function detectMessageRole(element) {
    // Try to determine role from element attributes
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;
    
    // Check parent elements for role information
    let parent = element.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentRole = parent.getAttribute('data-message-author-role');
      if (parentRole) return parentRole;
      parent = parent.parentElement;
    }
    
    // Analyze text content to determine role
    const text = element.textContent?.trim() || '';
    
    // User patterns (commands/requests)
    if (text.match(/^J[A-Z]/)) return 'user'; // Our test pattern
    if (text.includes('JSEQUENCE:') || text.includes('JPLAY:') || text.includes('JVOLUME:')) return 'user';
    if (text.includes('testmessage') && text.includes('respond')) return 'user';
    
    // Assistant patterns (responses)
    if (text.match(/^(seq_ok|play_ok|vol_ok|okay\d+)$/)) return 'assistant';
    if (text === 'seq_ok' || text.includes('_ok')) return 'assistant';
    
    // Check element position/structure (Claude typically has assistant messages in certain containers)
    const hasArticleParent = element.closest('article') !== null;
    const hasMainParent = element.closest('main') !== null;
    
    if (hasArticleParent || hasMainParent) {
      // In Claude, assistant messages often come after user messages in DOM order
      const prevSibling = element.previousElementSibling;
      if (prevSibling && prevSibling.textContent?.includes('JSEQUENCE:')) {
        return 'assistant';
      }
    }
    
    return 'unknown';
  }

  // Set up message capture for different Claude UI patterns
  function setupMessageCapture() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Look for added nodes that might be messages
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              
              // Comprehensive message selectors for Claude
              const messageSelectors = [
                // Explicit message attributes
                '[data-message-author-role]',
                '[data-message-id]',
                '[data-testid*="message"]',
                '[data-testid*="conversation"]',
                '[data-testid*="assistant"]',
                
                // Common HTML5 semantic elements
                'article',
                '[role="article"]',
                '[role="group"]',
                
                // Class-based selectors
                '[class*="message"]',
                '[class*="response"]',
                '[class*="assistant"]',
                '[class*="conversation"]',
                '[class*="chat"]',
                
                // Structural selectors (Claude often uses divs with specific structures)
                'main > div > div',
                'div[class*="flex"]',
                'div[class*="space"]'
              ];
              
              let isMessage = false;
              let role = null;
              
              // First, check if node itself matches any selector
              for (const selector of messageSelectors) {
                try {
                  if (node.matches && node.matches(selector)) {
                    isMessage = true;
                    role = detectMessageRole(node);
                    break;
                  }
                } catch (e) {
                  // Skip invalid selectors
                }
              }
              
              // Then check if node contains message elements
              if (!isMessage) {
                for (const selector of messageSelectors) {
                  try {
                    const msgElement = node.querySelector(selector);
                    if (msgElement) {
                      isMessage = true;
                      role = detectMessageRole(msgElement);
                      node = msgElement; // Use the found message element
                      break;
                    }
                  } catch (e) {
                    // Skip invalid selectors
                  }
                }
              }
              
              // Final fallback: check text content patterns
              if (!isMessage && node.textContent) {
                const text = node.textContent.trim();
                
                // Look for our specific test responses
                if (text === 'seq_ok' || text === 'play_ok' || text === 'vol_ok' || 
                    text.match(/^okay\d+$/) || text.includes('_ok')) {
                  isMessage = true;
                  role = 'assistant';
                  console.log(`${LOGGER_NAME} 🎯 FOUND ASSISTANT RESPONSE BY TEXT PATTERN:`, text);
                }
                // Look for user test messages  
                else if (text.includes('JSEQUENCE:') || text.includes('JPLAY:') || 
                         text.includes('JVOLUME:') || text.includes('testmessage')) {
                  isMessage = true;
                  role = 'user';
                  console.log(`${LOGGER_NAME} 🎯 FOUND USER MESSAGE BY TEXT PATTERN:`, text.slice(0, 50));
                }
              }
              
              if (isMessage && role && role !== 'unknown') {
                console.log(`${LOGGER_NAME} 🔍 Found ${role} message element:`, node.textContent?.slice(0, 50));
                
                // Wait a moment for streaming to complete
                setTimeout(() => {
                  logMessage(node, role);
                }, 500);
              }
            }
          });
        }
      });
    });
    
    // Also observe text changes (for streaming messages)
    const textObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          const target = mutation.target.nodeType === Node.TEXT_NODE ? 
                        mutation.target.parentElement : mutation.target;
          
          if (target && target.textContent) {
            const text = target.textContent.trim();
            // Check for completed responses
            if (text === 'seq_ok' || text === 'play_ok' || text === 'vol_ok') {
              console.log(`${LOGGER_NAME} 📝 DETECTED STREAMING COMPLETE:`, text);
              setTimeout(() => {
                logMessage(target, 'assistant');
              }, 100);
            }
          }
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    textObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Enhanced message capture observers active`);
  }
  
  // Initialize the logger
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing enhanced direct Claude logger...`);
    
    // Set up message capture
    setupMessageCapture();
    
    // Analyze existing messages on the page with comprehensive selectors
    const existingSelectors = [
      '[data-message-author-role]',
      'article',
      '[role="article"]',
      '[data-testid*="message"]',
      '[class*="message"]'
    ];
    
    let totalFound = 0;
    existingSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`${LOGGER_NAME} Selector "${selector}": ${elements.length} elements`);
        
        elements.forEach(msg => {
          const text = normText(msg.textContent || '');
          if (text && text.length > 3) {
            const role = detectMessageRole(msg);
            console.log(`${LOGGER_NAME} Existing ${role} message:`, text.slice(0, 50));
            
            // Mark existing messages as already processed to avoid duplicates
            state.processedMessages.set(text, state.sessionStart - 1000); // Mark as old
            totalFound++;
          }
        });
      } catch (e) {
        console.log(`${LOGGER_NAME} Selector "${selector}" failed:`, e.message);
      }
    });
    
    // Special scan for our test responses that might be missed
    console.log(`${LOGGER_NAME} Scanning for test response patterns...`);
    const allElements = document.querySelectorAll('*');
    let responseCount = 0;
    
    allElements.forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text === 'seq_ok' || text === 'play_ok' || text === 'vol_ok' || 
          text.match(/^okay\d+$/)) {
        console.log(`${LOGGER_NAME} 🎯 FOUND EXISTING RESPONSE:`, text, 'in', el.tagName, el.className);
        state.processedMessages.set(text, state.sessionStart - 1000);
        responseCount++;
      }
    });
    
    console.log(`${LOGGER_NAME} ✅ Enhanced logger initialized - Found ${totalFound} existing messages, ${responseCount} test responses`);
  }
  
  // Start the logger
  initialize();
  
  // Expose for debugging
  window.directClaudeLogger = {
    getState: () => state,
    testLog: (text, role = 'assistant') => {
      const fakeElement = { textContent: text };
      logMessage(fakeElement, role);
    },
    clearState: () => {
      state.processedMessages.clear();
      state.conversationHistory = [];
      console.log(`${LOGGER_NAME} State cleared`);
    }
  };
  
  console.log(`${LOGGER_NAME} ✅ Direct Claude logger ready!`);
  console.log('Debug functions: window.directClaudeLogger.getState(), .testLog(), .clearState()');
  
})();