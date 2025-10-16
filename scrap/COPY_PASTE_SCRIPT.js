// COPY AND PASTE THIS ENTIRE SCRIPT INTO CLAUDE'S F12 CONSOLE
// Go to claude.ai tab -> F12 -> Console -> paste this entire script -> press Enter

(function() {
  'use strict';
  
  const LOGGER_NAME = '[CLAUDE DIRECT LOGGER]';
  console.log(`${LOGGER_NAME} 🚀 Starting direct injection in Claude tab...`);
  
  let lastLoggedContent = '';
  let lastLoggedTime = 0;
  
  // CORS bypass using Image element
  function logViaImage(data) {
    const now = Date.now();
    
    // Prevent spam logging
    if (data.text === lastLoggedContent && (now - lastLoggedTime) < 3000) {
      console.log(`${LOGGER_NAME} ⏭️ Skipping duplicate within 3 seconds`);
      return;
    }
    
    lastLoggedContent = data.text;
    lastLoggedTime = now;
    
    const img = new Image();
    const params = new URLSearchParams({
      platform: 'claude',
      role: data.role || 'user',
      text: data.text || '',
      method: 'direct_injection_cors_bypass',
      timestamp: new Date().toISOString()
    });
    
    img.src = `http://localhost:8788/log?${params.toString()}`;
    console.log(`${LOGGER_NAME} 📡 LOGGED: "${data.text?.slice(0, 40)}..." [${data.role}]`);
  }
  
  // Test server connection
  function testConnection() {
    console.log(`${LOGGER_NAME} 🔗 Testing server connection...`);
    logViaImage({ role: 'user', text: 'connection_test_' + Date.now() });
  }
  
  // Enhanced keyboard detection
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target;
      
      // Check multiple input types
      if (target.matches('textarea, input, [contenteditable="true"], [contenteditable=""], [role="textbox"]')) {
        setTimeout(() => {
          const content = target.value || target.textContent || target.innerText || '';
          
          if (content && content.trim() && content.length > 3) {
            console.log(`${LOGGER_NAME} 🎯 KEYBOARD INPUT DETECTED: "${content.slice(0, 50)}..."`);
            logViaImage({ role: 'user', text: content.trim() });
          }
        }, 100); // Small delay to capture final content
      }
    }
  }, true);
  
  // Enhanced click detection
  document.addEventListener('click', function(event) {
    const button = event.target.closest('button, [role="button"]');
    if (button) {
      console.log(`${LOGGER_NAME} 🖱️ Button clicked:`, button.getAttribute('aria-label') || button.textContent?.slice(0, 20) || 'unlabeled');
      
      setTimeout(() => {
        // Find all potential input elements
        const selectors = [
          'textarea',
          'input[type="text"]', 
          '[contenteditable="true"]',
          '[contenteditable=""]',
          '[role="textbox"]'
        ];
        
        for (const selector of selectors) {
          const inputs = document.querySelectorAll(selector);
          for (const input of inputs) {
            const content = input.value || input.textContent || input.innerText || '';
            if (content && content.trim() && content.length > 3) {
              console.log(`${LOGGER_NAME} 🎯 CLICK+INPUT DETECTED: "${content.slice(0, 50)}..."`);
              logViaImage({ role: 'user', text: content.trim() });
              return; // Only log first found content
            }
          }
        }
      }, 200);
    }
  }, true);
  
  // Watch for new content (assistant responses)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent || '';
            
            // Look for assistant response patterns
            if (text && text.length > 5 && text.length < 500) {
              // Check if this looks like an assistant response
              if (text.includes('okay') || 
                  text.match(/^[A-Z][a-z].+[.!?]$/) ||
                  (text.length < 100 && !text.includes('testmessage'))) {
                
                setTimeout(() => {
                  console.log(`${LOGGER_NAME} 🎯 ASSISTANT RESPONSE: "${text.slice(0, 50)}..."`);
                  logViaImage({ role: 'assistant', text: text.trim() });
                }, 500);
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
  
  // Test connection immediately
  testConnection();
  
  console.log(`${LOGGER_NAME} ✅ DIRECT INJECTION COMPLETE!`);
  console.log(`${LOGGER_NAME} 📋 Now type: testmessage127, respond okay127`);
  console.log(`${LOGGER_NAME} 📋 Wait 15+ seconds, then type the same message again`);
  console.log(`${LOGGER_NAME} 📋 Watch this console for detection messages`);
  
  // Expose for manual testing
  window.claudeDirectLogger = {
    logViaImage: logViaImage,
    testConnection: testConnection
  };
  
})();

console.log('🎯 READY FOR TESTING: Type testmessage127, respond okay127 in Claude!');