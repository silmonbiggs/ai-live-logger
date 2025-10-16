// Claude Transmission Diagnostic Tool
// Injected into Claude tab via DevTools to analyze retransmission behavior

(function() {
  'use strict';
  
  console.log('🔍 CLAUDE TRANSMISSION DIAGNOSTIC STARTING...');
  
  // Storage for diagnostic data
  window.transmissionDiagnostic = {
    rawMutations: [],
    transmissionLog: [],
    conversationState: {
      messageCount: 0,
      lastUserInput: null,
      lastAssistantResponse: null,
      sessionStartTime: Date.now()
    }
  };
  
  const diagnostic = window.transmissionDiagnostic;
  
  // Helper function to get element signature
  function getElementSignature(element) {
    if (!element) return 'null';
    
    return {
      tag: element.tagName,
      id: element.id || null,
      classes: element.className || null,
      textLength: (element.textContent || '').length,
      textPreview: (element.textContent || '').slice(0, 100),
      dataAttrs: Array.from(element.attributes || [])
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}="${attr.value}"`),
      position: element.getBoundingClientRect ? {
        x: Math.round(element.getBoundingClientRect().x),
        y: Math.round(element.getBoundingClientRect().y),
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height)
      } : null
    };
  }
  
  // Function to detect if element contains conversation content
  function isConversationElement(element) {
    if (!element || !element.textContent) return false;
    
    const text = element.textContent.trim();
    if (text.length < 3) return false;
    
    // Look for message-like structures
    const hasMessageRole = element.querySelector('[data-message-author-role]') || 
                          element.closest('[data-message-author-role]') ||
                          element.hasAttribute('data-message-author-role');
    
    const hasMessageContent = text.length > 10 && (
      text.includes('okay') ||
      text.includes('testmessage') ||
      text.includes('respond') ||
      /^[A-Z]/.test(text) // Starts with capital letter
    );
    
    const isInChatArea = element.closest('[class*="chat"]') ||
                        element.closest('[class*="message"]') ||
                        element.closest('[class*="conversation"]');
    
    return hasMessageRole || (hasMessageContent && isInChatArea);
  }
  
  // Function to log transmission events
  function logTransmission(type, element, details = {}) {
    const timestamp = Date.now();
    const signature = getElementSignature(element);
    
    const logEntry = {
      timestamp,
      timeSinceStart: timestamp - diagnostic.conversationState.sessionStartTime,
      type, // 'mutation', 'add', 'remove', 'textChange'
      element: signature,
      isConversationElement: isConversationElement(element),
      details
    };
    
    diagnostic.transmissionLog.push(logEntry);
    
    // Log to console with formatting
    if (logEntry.isConversationElement) {
      console.log(`🟢 [${logEntry.timeSinceStart}ms] ${type.toUpperCase()}:`, 
        signature.textPreview, signature);
    } else {
      console.log(`⚪ [${logEntry.timeSinceStart}ms] ${type.toUpperCase()}:`, 
        signature.textPreview?.slice(0, 30) || 'no text', signature.tag);
    }
    
    // Send important conversation events to server for analysis
    if (logEntry.isConversationElement && signature.textLength > 10) {
      fetch('http://localhost:8788/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'raw_transmission',
          timestamp: timestamp,
          elementSignature: signature,
          conversationContext: diagnostic.conversationState,
          transmissionType: type
        })
      }).catch(e => console.log('Failed to send diagnostic data:', e.message));
    }
  }
  
  // Set up comprehensive mutation observer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      diagnostic.rawMutations.push({
        type: mutation.type,
        target: getElementSignature(mutation.target),
        timestamp: Date.now()
      });
      
      // Log the mutation
      logTransmission('mutation', mutation.target, {
        mutationType: mutation.type,
        addedNodes: mutation.addedNodes.length,
        removedNodes: mutation.removedNodes.length,
        attributeName: mutation.attributeName,
        oldValue: mutation.oldValue
      });
      
      // Track added nodes
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            logTransmission('add', node);
            
            // Check if this contains conversation content
            if (isConversationElement(node)) {
              diagnostic.conversationState.messageCount++;
              console.log(`📨 NEW CONVERSATION ELEMENT #${diagnostic.conversationState.messageCount}:`, 
                         node.textContent?.slice(0, 100));
            }
          }
        });
      }
      
      // Track removed nodes
      if (mutation.removedNodes) {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            logTransmission('remove', node);
          }
        });
      }
      
      // Track text changes
      if (mutation.type === 'characterData') {
        logTransmission('textChange', mutation.target, {
          oldValue: mutation.oldValue,
          newValue: mutation.target.textContent
        });
      }
    });
  });
  
  // Observe everything
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true
  });
  
  // Function to analyze current conversation state
  function analyzeCurrentState() {
    console.log('🔍 ANALYZING CURRENT CONVERSATION STATE...');
    
    // Find all message elements
    const messageSelectors = [
      '[data-message-author-role]',
      '[class*="message"]',
      '[class*="chat"]'
    ];
    
    let allMessages = [];
    messageSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.textContent && el.textContent.trim().length > 5) {
          allMessages.push({
            element: getElementSignature(el),
            role: el.getAttribute('data-message-author-role') || 'unknown',
            text: el.textContent.trim()
          });
        }
      });
    });
    
    console.log(`📊 Found ${allMessages.length} message elements:`, allMessages);
    diagnostic.conversationState.currentMessages = allMessages;
    
    return allMessages;
  }
  
  // Function to trigger test sequence
  function runTestSequence() {
    console.log('🧪 STARTING TEST SEQUENCE...');
    
    // Analyze baseline
    analyzeCurrentState();
    
    // Find input field
    const inputSelectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      '[contenteditable="true"]',
      'textarea',
      '[role="textbox"]'
    ];
    
    let input = null;
    for (const selector of inputSelectors) {
      const found = document.querySelector(selector);
      if (found && found.offsetHeight > 0 && found.offsetWidth > 100) {
        input = found;
        console.log(`✅ Found input field:`, selector);
        break;
      }
    }
    
    if (!input) {
      console.log('❌ No input field found');
      return false;
    }
    
    // Send a test message
    const testMessage = `testmessage_diagnostic_${Date.now()}, respond okay_diagnostic_${Date.now()}`;
    console.log(`📝 Sending test message: ${testMessage}`);
    
    // Set the message
    if (input.tagName === 'TEXTAREA') {
      input.value = testMessage;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.innerText = testMessage;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Find and click send button
    setTimeout(() => {
      const sendSelectors = [
        'button[aria-label*="send"]',
        'button[data-testid*="send"]',
        'button[type="submit"]',
        'button:has(svg)',
        'button[aria-label*="Send"]'
      ];
      
      let sendButton = null;
      for (const selector of sendSelectors) {
        const found = document.querySelector(selector);
        if (found && found.offsetHeight > 0) {
          sendButton = found;
          console.log(`✅ Found send button:`, selector);
          break;
        }
      }
      
      if (sendButton) {
        console.log('🚀 Clicking send button...');
        sendButton.click();
        diagnostic.conversationState.lastUserInput = testMessage;
        diagnostic.conversationState.testSequenceStarted = Date.now();
      } else {
        console.log('❌ No send button found');
        // Try Enter key
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
      }
    }, 500);
    
    return true;
  }
  
  // Expose functions globally for console access
  window.claudeDiagnostic = {
    analyzeCurrentState,
    runTestSequence,
    getData: () => diagnostic,
    clearLog: () => {
      diagnostic.transmissionLog = [];
      diagnostic.rawMutations = [];
      console.log('🧹 Diagnostic log cleared');
    }
  };
  
  console.log('✅ CLAUDE TRANSMISSION DIAGNOSTIC READY!');
  console.log('📋 Available functions:');
  console.log('  - claudeDiagnostic.analyzeCurrentState() - Analyze current messages');
  console.log('  - claudeDiagnostic.runTestSequence() - Send test message and monitor');
  console.log('  - claudeDiagnostic.getData() - Get all diagnostic data');
  console.log('  - claudeDiagnostic.clearLog() - Clear diagnostic log');
  
  // Auto-analyze current state
  setTimeout(() => {
    analyzeCurrentState();
  }, 1000);
  
})();