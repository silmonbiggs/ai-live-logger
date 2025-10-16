// CSP BYPASS SCRIPT - Uses postMessage instead of blocked Image requests
// COPY AND PASTE THIS INTO CLAUDE'S F12 CONSOLE

(function() {
  'use strict';
  
  const LOGGER_NAME = '[CSP BYPASS LOGGER]';
  console.log(`${LOGGER_NAME} 🚀 Starting CSP bypass logger...`);
  
  let lastLoggedContent = '';
  let lastLoggedTime = 0;
  
  // CSP bypass using iframe postMessage to a localhost page
  function logViaIframe(data) {
    const now = Date.now();
    
    // Prevent spam logging
    if (data.text === lastLoggedContent && (now - lastLoggedTime) < 3000) {
      console.log(`${LOGGER_NAME} ⏭️ Skipping duplicate within 3 seconds`);
      return;
    }
    
    lastLoggedContent = data.text;
    lastLoggedTime = now;
    
    // Method 1: Try fetch with no-cors mode
    try {
      fetch('http://localhost:8788/log', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'claude',
          role: data.role || 'user',
          text: data.text || '',
          urls: [],
          metadata: {
            method: 'csp_bypass_nocors',
            timestamp: new Date().toISOString()
          }
        })
      }).then(() => {
        console.log(`${LOGGER_NAME} 📡 LOGGED (no-cors): "${data.text?.slice(0, 40)}..." [${data.role}]`);
      }).catch(error => {
        console.log(`${LOGGER_NAME} ⚠️ No-cors failed: ${error.message}`);
      });
    } catch (error) {
      console.log(`${LOGGER_NAME} ⚠️ Fetch failed: ${error.message}`);
    }
    
    // Method 2: Use script tag injection (JSONP-style)
    setTimeout(() => {
      try {
        const script = document.createElement('script');
        const params = new URLSearchParams({
          platform: 'claude',
          role: data.role || 'user',
          text: data.text || '',
          method: 'csp_bypass_script',
          timestamp: new Date().toISOString(),
          callback: 'csp_callback_' + now
        });
        
        // Create callback function
        window['csp_callback_' + now] = function(response) {
          console.log(`${LOGGER_NAME} 📡 LOGGED (script): "${data.text?.slice(0, 40)}..." [${data.role}]`);
          document.head.removeChild(script);
          delete window['csp_callback_' + now];
        };
        
        script.src = `http://localhost:8788/log?${params.toString()}`;
        script.onerror = () => {
          console.log(`${LOGGER_NAME} ⚠️ Script method failed`);
          document.head.removeChild(script);
          delete window['csp_callback_' + now];
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.log(`${LOGGER_NAME} ⚠️ Script injection failed: ${error.message}`);
      }
    }, 100);
  }
  
  // Enhanced keyboard detection
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target;
      
      if (target.matches('textarea, input, [contenteditable="true"], [contenteditable=""], [role="textbox"]')) {
        setTimeout(() => {
          const content = target.value || target.textContent || target.innerText || '';
          
          if (content && content.trim() && content.length > 3) {
            console.log(`${LOGGER_NAME} 🎯 KEYBOARD INPUT: "${content.slice(0, 50)}..."`);
            logViaIframe({ role: 'user', text: content.trim() });
          }
        }, 100);
      }
    }
  }, true);
  
  // Enhanced click detection
  document.addEventListener('click', function(event) {
    const button = event.target.closest('button, [role="button"]');
    if (button) {
      setTimeout(() => {
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
              console.log(`${LOGGER_NAME} 🎯 SEND CLICK: "${content.slice(0, 50)}..."`);
              logViaIframe({ role: 'user', text: content.trim() });
              return;
            }
          }
        }
      }, 200);
    }
  }, true);
  
  // Watch for assistant responses (but filter out noise)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent || '';
            
            // Only log short, relevant responses
            if (text && text.length > 3 && text.length < 200) {
              // Filter for actual responses (not UI noise)
              if (text.includes('okay') && text.length < 50) {
                setTimeout(() => {
                  console.log(`${LOGGER_NAME} 🎯 RESPONSE: "${text.slice(0, 50)}..."`);
                  logViaIframe({ role: 'assistant', text: text.trim() });
                }, 1000); // Longer delay to avoid UI elements
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
  
  console.log(`${LOGGER_NAME} ✅ CSP BYPASS ACTIVE!`);
  console.log(`${LOGGER_NAME} 📋 Using no-cors fetch + script injection`);
  console.log(`${LOGGER_NAME} 📋 Test with: testmessage129, respond okay129`);
  
  // Test both methods
  setTimeout(() => {
    logViaIframe({ role: 'user', text: 'csp_bypass_test_' + Date.now() });
  }, 1000);
  
})();

console.log('🎯 CSP BYPASS READY: Test with testmessage129!');