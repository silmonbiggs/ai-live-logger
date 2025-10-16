// Enhanced analytics logger for comprehensive Claude retransmission analysis
(function() {
  'use strict';
  
  const LOGGER_NAME = '[ANALYTICS LOGGER]';
  console.log(`${LOGGER_NAME} Starting comprehensive transmission analytics...`);
  
  // Enhanced analytics storage
  window.claudeAnalytics = {
    // Core data structures
    transmissionEvents: [], // Every transmission event with detailed metadata
    duplicateEvents: [], // When duplicates are detected with context
    conversationEvents: [], // Page loads, navigations, UI events
    timingData: [], // Response timing and pattern data
    domMutations: [], // Raw DOM mutations for pattern analysis
    
    // Test tracking
    currentTest: null,
    testResults: {},
    sessionStart: Date.now(),
    
    // State tracking  
    processedMessages: new Map(),
    conversationHistory: [],
    lastUserInteraction: 0,
    pageLoadCount: 0,
    navigationEvents: []
  };
  
  const analytics = window.claudeAnalytics;
  
  // Enhanced helper functions
  function createEventRecord(type, data) {
    return {
      timestamp: Date.now(),
      sessionTime: Date.now() - analytics.sessionStart,
      type: type,
      testPhase: analytics.currentTest,
      url: window.location.href,
      conversationId: getConvoId(),
      data: data
    };
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
  
  function normText(s) {
    return String(s || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
  
  function detectMessageRole(element) {
    // Enhanced role detection
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;
    
    // Context-based role detection
    const text = normText(element.textContent || '');
    
    // User patterns
    if (text.includes('test') && text.includes('respond')) return 'user';
    if (text.startsWith('PLAY:') || text.startsWith('SEQUENCE:')) return 'user';
    
    // Assistant patterns  
    if (text.match(/^okay\d+/) || text.includes('okay_')) return 'assistant';
    
    // Look at parent/sibling elements for context
    const parent = element.closest('[data-message-author-role]');
    if (parent) return parent.getAttribute('data-message-author-role');
    
    return 'unknown';
  }
  
  function logTransmissionEvent(element, eventType) {
    try {
      const text = normText(element.textContent || '');
      if (!text || text.length < 3) return null;
      
      const role = detectMessageRole(element);
      const now = Date.now();
      
      // Check for duplicates with detailed analysis
      let isDuplicate = false;
      let duplicateInfo = null;
      
      if (analytics.processedMessages.has(text)) {
        const lastSeen = analytics.processedMessages.get(text);
        const timeSince = now - lastSeen.timestamp;
        
        isDuplicate = true;
        duplicateInfo = {
          lastSeen: lastSeen.timestamp,
          timeSince: timeSince,
          lastRole: lastSeen.role,
          lastTest: lastSeen.testPhase,
          pattern: timeSince < 1000 ? 'immediate' : 
                  timeSince < 30000 ? 'recent' : 'historical'
        };
        
        // Log duplicate event
        analytics.duplicateEvents.push(createEventRecord('duplicate_detected', {
          text: text.slice(0, 100),
          role: role,
          duplicateInfo: duplicateInfo,
          elementInfo: getElementInfo(element)
        }));
        
        console.log(`${LOGGER_NAME} 🔍 DUPLICATE (${duplicateInfo.pattern}):`, text.slice(0, 50), `(${timeSince}ms ago)`);
      }
      
      // Log transmission event regardless of duplicate status
      const transmissionEvent = createEventRecord('transmission', {
        text: text,
        role: role,
        eventType: eventType,
        isDuplicate: isDuplicate,
        duplicateInfo: duplicateInfo,
        messageLength: text.length,
        urls: extractUrls(text),
        elementInfo: getElementInfo(element),
        timingInfo: {
          timeSinceLastUser: now - analytics.lastUserInteraction,
          timeSincePageLoad: now - (analytics.pageLoadTime || analytics.sessionStart)
        }
      });
      
      analytics.transmissionEvents.push(transmissionEvent);
      
      // Update processed messages
      analytics.processedMessages.set(text, {
        timestamp: now,
        role: role,
        testPhase: analytics.currentTest
      });
      
      // Update conversation history
      analytics.conversationHistory.push({
        text: text,
        role: role,
        timestamp: now,
        isDuplicate: isDuplicate
      });
      
      if (role === 'user') {
        analytics.lastUserInteraction = now;
      }
      
      // Send to server with analytics flag
      sendToAnalyticsServer(transmissionEvent);
      
      console.log(`${LOGGER_NAME} 📊 Logged ${eventType}:`, role, text.slice(0, 50), isDuplicate ? '(DUPLICATE)' : '(NEW)');
      
      return transmissionEvent;
      
    } catch (error) {
      console.error(`${LOGGER_NAME} Error logging transmission:`, error);
      return null;
    }
  }
  
  function getElementInfo(element) {
    if (!element) return null;
    
    return {
      tagName: element.tagName,
      id: element.id || null,
      className: element.className || null,
      dataAttributes: Array.from(element.attributes || [])
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}="${attr.value}"`),
      textLength: (element.textContent || '').length,
      position: element.getBoundingClientRect ? {
        x: Math.round(element.getBoundingClientRect().x),
        y: Math.round(element.getBoundingClientRect().y),
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height)
      } : null,
      parentInfo: element.parentElement ? {
        tagName: element.parentElement.tagName,
        className: element.parentElement.className
      } : null
    };
  }
  
  function sendToAnalyticsServer(eventData) {
    fetch('http://localhost:8788/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    })
    .then(response => response.text())
    .then(result => {
      console.log(`${LOGGER_NAME} 📤 Analytics sent:`, eventData.data?.role || 'event');
    })
    .catch(error => {
      console.log(`${LOGGER_NAME} ❌ Analytics failed:`, error.message);
    });
  }
  
  function logConversationEvent(eventType, details) {
    const event = createEventRecord('conversation_event', {
      eventType: eventType,
      details: details,
      currentMessageCount: analytics.conversationHistory.length,
      currentUrl: window.location.href
    });
    
    analytics.conversationEvents.push(event);
    sendToAnalyticsServer(event);
    
    console.log(`${LOGGER_NAME} 🎯 Conversation event:`, eventType, details);
  }
  
  // Enhanced DOM observation
  function setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Log raw mutation for pattern analysis
        if (analytics.domMutations.length < 1000) { // Limit to prevent memory issues
          analytics.domMutations.push({
            timestamp: Date.now(),
            type: mutation.type,
            targetTag: mutation.target.tagName,
            addedCount: mutation.addedNodes?.length || 0,
            removedCount: mutation.removedNodes?.length || 0,
            testPhase: analytics.currentTest
          });
        }
        
        // Process added nodes for message detection
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for message patterns
              const messageSelectors = [
                '[data-message-author-role]',
                '[class*="message"]',
                '[data-testid*="message"]'
              ];
              
              let messageElement = null;
              
              // Check if the node itself is a message
              for (const selector of messageSelectors) {
                if (node.matches && node.matches(selector)) {
                  messageElement = node;
                  break;
                }
              }
              
              // Check if node contains a message
              if (!messageElement) {
                for (const selector of messageSelectors) {
                  const found = node.querySelector && node.querySelector(selector);
                  if (found) {
                    messageElement = found;
                    break;
                  }
                }
              }
              
              // Also check for text-based message detection
              if (!messageElement && node.textContent && node.textContent.trim().length > 10) {
                const text = node.textContent.trim();
                if ((text.includes('test') && text.includes('respond')) ||
                    text.match(/^okay\d+/) ||
                    text.includes('okay_') ||
                    text.startsWith('PLAY:') ||
                    text.startsWith('SEQUENCE:')) {
                  messageElement = node;
                }
              }
              
              if (messageElement) {
                // Wait for potential streaming completion
                setTimeout(() => {
                  logTransmissionEvent(messageElement, 'dom_mutation');
                }, 500);
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    console.log(`${LOGGER_NAME} ✅ Enhanced DOM observer active`);
    return observer;
  }
  
  // Page navigation tracking
  function setupNavigationTracking() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      logConversationEvent('navigation_pushstate', { url: args[2] });
      return originalPushState.apply(history, args);
    };
    
    history.replaceState = function(...args) {
      logConversationEvent('navigation_replacestate', { url: args[2] });
      return originalReplaceState.apply(history, args);
    };
    
    window.addEventListener('popstate', () => {
      logConversationEvent('navigation_popstate', { url: window.location.href });
    });
    
    window.addEventListener('beforeunload', () => {
      logConversationEvent('page_beforeunload', { 
        messageCount: analytics.conversationHistory.length,
        sessionDuration: Date.now() - analytics.sessionStart
      });
    });
    
    console.log(`${LOGGER_NAME} ✅ Navigation tracking active`);
  }
  
  // Test management functions
  function startTest(testName) {
    analytics.currentTest = testName;
    const startEvent = createEventRecord('test_start', {
      testName: testName,
      priorMessageCount: analytics.conversationHistory.length
    });
    
    analytics.testResults[testName] = {
      startTime: Date.now(),
      startEvent: startEvent,
      transmissions: [],
      duplicates: [],
      completed: false
    };
    
    logConversationEvent('test_start', { testName: testName });
    console.log(`${LOGGER_NAME} 🧪 STARTED TEST:`, testName);
  }
  
  function endTest(testName) {
    if (analytics.testResults[testName]) {
      const endTime = Date.now();
      const testResult = analytics.testResults[testName];
      
      testResult.endTime = endTime;
      testResult.duration = endTime - testResult.startTime;
      testResult.completed = true;
      
      // Gather test-specific data
      testResult.transmissions = analytics.transmissionEvents
        .filter(e => e.testPhase === testName);
      testResult.duplicates = analytics.duplicateEvents
        .filter(e => e.testPhase === testName);
      
      analytics.currentTest = null;
      
      logConversationEvent('test_end', { 
        testName: testName,
        duration: testResult.duration,
        transmissionCount: testResult.transmissions.length,
        duplicateCount: testResult.duplicates.length
      });
      
      console.log(`${LOGGER_NAME} ✅ COMPLETED TEST:`, testName, 
                 `(${testResult.transmissions.length} transmissions, ${testResult.duplicates.length} duplicates)`);
      
      return testResult;
    }
    
    return null;
  }
  
  // Initialize analytics system
  function initialize() {
    console.log(`${LOGGER_NAME} Initializing comprehensive analytics system...`);
    
    analytics.pageLoadTime = Date.now();
    analytics.pageLoadCount++;
    
    // Set up observers and tracking
    setupDOMObserver();
    setupNavigationTracking();
    
    // Log page initialization
    logConversationEvent('page_initialized', {
      url: window.location.href,
      pageLoadCount: analytics.pageLoadCount,
      userAgent: navigator.userAgent.slice(0, 100)
    });
    
    // Analyze existing page content
    const existingMessages = document.querySelectorAll('[data-message-author-role]');
    console.log(`${LOGGER_NAME} Found ${existingMessages.length} existing messages on page`);
    
    existingMessages.forEach((msg, index) => {
      const role = msg.getAttribute('data-message-author-role');
      const text = normText(msg.textContent || '');
      
      if (text) {
        // Mark as baseline (pre-existing)
        analytics.processedMessages.set(text, {
          timestamp: analytics.sessionStart - (1000 * (existingMessages.length - index)), // Stagger timestamps
          role: role,
          testPhase: 'baseline'
        });
        
        console.log(`${LOGGER_NAME} Baseline ${role} message:`, text.slice(0, 50));
      }
    });
    
    console.log(`${LOGGER_NAME} ✅ Analytics system ready`);
  }
  
  // Public API for test runner
  window.claudeAnalyticsAPI = {
    startTest: startTest,
    endTest: endTest,
    getAnalytics: () => analytics,
    getCurrentTest: () => analytics.currentTest,
    clearAnalytics: () => {
      analytics.transmissionEvents = [];
      analytics.duplicateEvents = [];
      analytics.domMutations = [];
      analytics.processedMessages.clear();
      analytics.conversationHistory = [];
      analytics.testResults = {};
      console.log(`${LOGGER_NAME} 🧹 Analytics cleared`);
    },
    exportAnalytics: () => {
      const exportData = {
        summary: {
          sessionDuration: Date.now() - analytics.sessionStart,
          totalTransmissions: analytics.transmissionEvents.length,
          totalDuplicates: analytics.duplicateEvents.length,
          totalTests: Object.keys(analytics.testResults).length,
          conversationEvents: analytics.conversationEvents.length
        },
        testResults: analytics.testResults,
        transmissionEvents: analytics.transmissionEvents,
        duplicateEvents: analytics.duplicateEvents,
        conversationEvents: analytics.conversationEvents,
        exportTimestamp: Date.now()
      };
      
      console.log(`${LOGGER_NAME} 📋 Analytics export:`, exportData.summary);
      return exportData;
    }
  };
  
  // Start the analytics system
  initialize();
  
  console.log(`${LOGGER_NAME} ✅ Enhanced analytics logger ready!`);
  console.log('Available API: window.claudeAnalyticsAPI');
  
})();