// CORS Bypass Injector - Alternative logging method that bypasses CORS issues
// Copy this into Claude's F12 console

(function() {
  'use strict';
  
  const CORS_LOGGER_NAME = '[CORS BYPASS LOGGER]';
  console.log(`${CORS_LOGGER_NAME} Initializing CORS bypass logger...`);
  
  // Alternative 1: Use Image element to send data (bypasses CORS)
  function logViaImage(data) {
    const img = new Image();
    const params = new URLSearchParams({
      platform: 'claude',
      role: data.role || 'user',
      text: data.text || '',
      method: 'image_bypass',
      timestamp: new Date().toISOString()
    });
    
    img.src = `http://localhost:8788/log?${params.toString()}`;
    console.log(`${CORS_LOGGER_NAME} 📡 Logged via image method: "${data.text?.slice(0, 30)}..."`);
  }
  
  // Alternative 2: Use WebSocket if available (bypasses CORS)
  function logViaWebSocket(data) {
    try {
      const ws = new WebSocket('ws://localhost:8788/ws');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          platform: 'claude',
          role: data.role || 'user',
          text: data.text || '',
          method: 'websocket_bypass',
          timestamp: new Date().toISOString()
        }));
        console.log(`${CORS_LOGGER_NAME} 📡 Logged via WebSocket: "${data.text?.slice(0, 30)}..."`);
        ws.close();
      };
      ws.onerror = () => {
        console.log(`${CORS_LOGGER_NAME} WebSocket failed, falling back to image method`);
        logViaImage(data);
      };
    } catch (error) {
      console.log(`${CORS_LOGGER_NAME} WebSocket not available, using image method`);
      logViaImage(data);
    }
  }
  
  // Alternative 3: Use JSONP-style callback (GET request with callback)
  function logViaJSONP(data) {
    const script = document.createElement('script');
    const callbackName = `cors_callback_${Date.now()}`;
    
    window[callbackName] = function(response) {
      console.log(`${CORS_LOGGER_NAME} 📡 JSONP response:`, response);
      document.head.removeChild(script);
      delete window[callbackName];
    };
    
    const params = new URLSearchParams({
      platform: 'claude',
      role: data.role || 'user', 
      text: data.text || '',
      method: 'jsonp_bypass',
      timestamp: new Date().toISOString(),
      callback: callbackName
    });
    
    script.src = `http://localhost:8788/jsonp?${params.toString()}`;
    document.head.appendChild(script);
    
    console.log(`${CORS_LOGGER_NAME} 📡 Logged via JSONP: "${data.text?.slice(0, 30)}..."`);
  }
  
  // Simple user input detection focused on Claude's structure
  function setupSimpleDetection() {
    console.log(`${CORS_LOGGER_NAME} Setting up simple user input detection...`);
    
    // Method 1: Monitor all keyboard events globally
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        const target = event.target;
        
        // Check if we're in an input element
        if (target.matches('textarea, input, [contenteditable="true"], [contenteditable=""]')) {
          const content = target.value || target.textContent || '';
          
          if (content && content.trim() && content.includes('testmessage')) {
            console.log(`${CORS_LOGGER_NAME} 🎯 USER INPUT DETECTED: "${content.slice(0, 50)}..."`);
            
            // Try all bypass methods
            const data = { role: 'user', text: content.trim() };
            logViaImage(data);
            
            setTimeout(() => logViaJSONP(data), 100);
            setTimeout(() => logViaWebSocket(data), 200);
          }
        }
      }
    }, true);
    
    // Method 2: Monitor all button clicks
    document.addEventListener('click', function(event) {
      const target = event.target;
      const button = target.closest('button');
      
      if (button) {
        // Look for nearby input content
        const inputs = document.querySelectorAll('textarea, input, [contenteditable="true"], [contenteditable=""]');
        
        for (const input of inputs) {
          const content = input.value || input.textContent || '';
          if (content && content.trim() && content.includes('testmessage')) {
            console.log(`${CORS_LOGGER_NAME} 🎯 SEND BUTTON CLICKED with content: "${content.slice(0, 50)}..."`);
            
            const data = { role: 'user', text: content.trim() };
            logViaImage(data);
            break;
          }
        }
      }
    }, true);
    
    // Method 3: Watch for new message elements (Claude responses)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || '';
              
              // Look for response patterns
              if (text.includes('okay') && text.length < 100) {
                console.log(`${CORS_LOGGER_NAME} 🎯 ASSISTANT RESPONSE DETECTED: "${text.slice(0, 50)}..."`);
                
                const data = { role: 'assistant', text: text.trim() };
                logViaImage(data);
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
    
    console.log(`${CORS_LOGGER_NAME} ✅ Simple detection active - will bypass CORS using image/JSONP/WebSocket`);
  }
  
  // Test all methods
  function testBypassMethods() {
    console.log(`${CORS_LOGGER_NAME} Testing all CORS bypass methods...`);
    
    const testData = { 
      role: 'user', 
      text: 'cors_bypass_test_' + Date.now()
    };
    
    logViaImage(testData);
    setTimeout(() => logViaJSONP(testData), 500);
    setTimeout(() => logViaWebSocket(testData), 1000);
  }
  
  // Initialize
  setupSimpleDetection();
  testBypassMethods();
  
  // Expose for manual testing
  window.corsLogger = {
    logViaImage,
    logViaJSONP, 
    logViaWebSocket,
    testBypassMethods
  };
  
  console.log(`${CORS_LOGGER_NAME} ✅ CORS bypass logger ready!`);
  console.log(`${CORS_LOGGER_NAME} Available: window.corsLogger.testBypassMethods()`);
  
})();