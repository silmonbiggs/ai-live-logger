// FINAL CLEAN SCRIPT - Single method, reduced noise
// COPY THIS INTO CLAUDE'S F12 CONSOLE (replace previous script)

(function() {
  'use strict';
  
  const LOGGER_NAME = '[FINAL LOGGER]';
  console.log(`${LOGGER_NAME} 🚀 Starting final clean logger...`);
  
  let lastLoggedContent = '';
  let lastLoggedTime = 0;
  let messageCount = 0;
  
  // Use only the working no-cors method (most reliable)
  function logMessage(data) {
    const now = Date.now();
    
    // Enhanced duplicate prevention (5 second window)
    if (data.text === lastLoggedContent && (now - lastLoggedTime) < 5000) {
      console.log(`${LOGGER_NAME} ⏭️ Skip duplicate: "${data.text?.slice(0, 30)}..."`);
      return;
    }
    
    lastLoggedContent = data.text;
    lastLoggedTime = now;
    messageCount++;
    
    // Use only no-cors fetch (most reliable method)
    fetch('http://localhost:8788/log', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'claude',
        role: data.role || 'user',
        text: data.text || '',
        urls: [],
        metadata: {
          method: 'final_clean_logger',
          timestamp: new Date().toISOString(),
          messageNum: messageCount
        }
      })
    }).then(() => {
      console.log(`${LOGGER_NAME} 📡 LOGGED [${messageCount}]: "${data.text?.slice(0, 40)}..." [${data.role}]`);
    }).catch(error => {
      console.log(`${LOGGER_NAME} ❌ Log failed: ${error.message}`);
    });
  }
  
  // Clean user input detection
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target;
      
      if (target.matches('textarea, [contenteditable="true"], [role="textbox"]')) {
        setTimeout(() => {
          const content = target.value || target.textContent || '';
          
          // Only log testmessage patterns (filter out other typing)
          if (content && content.trim() && content.includes('testmessage') && content.length > 10) {
            console.log(`${LOGGER_NAME} 🎯 USER INPUT: "${content.slice(0, 50)}..."`);
            logMessage({ role: 'user', text: content.trim() });
          }
        }, 150);
      }
    }
  }, true);
  
  // Clean assistant response detection - only capture final responses
  let responseTimeout;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent || '';
            
            // Only capture short, final responses that match our test pattern
            if (text && text.length > 3 && text.length < 50 && text.includes('okay')) {
              // Clear previous timeout and set new one (debounce rapid updates)
              clearTimeout(responseTimeout);
              responseTimeout = setTimeout(() => {
                // Only log if this looks like a genuine final response
                if (text.match(/^okay\d+$/)) {
                  console.log(`${LOGGER_NAME} 🎯 FINAL RESPONSE: "${text}"`);
                  logMessage({ role: 'assistant', text: text.trim() });
                }
              }, 2000); // Wait 2 seconds for response to stabilize
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
  
  console.log(`${LOGGER_NAME} ✅ FINAL CLEAN LOGGER READY!`);
  console.log(`${LOGGER_NAME} 📋 Will only log testmessage inputs and okay responses`);
  console.log(`${LOGGER_NAME} 📋 5-second duplicate protection active`);
  console.log(`${LOGGER_NAME} 📋 Test: Type same testmessage twice, 15+ seconds apart`);
  
  // Expose for testing
  window.finalLogger = {
    logMessage: logMessage,
    getStats: () => ({ messageCount, lastLoggedContent, lastLoggedTime })
  };
  
})();

console.log('🎯 FINAL LOGGER READY - Test with duplicate testmessage130!');