// Check extension status and force reload if needed
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔍 Checking extension status in Claude tab...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Check if our content script is loaded
  const checkScript = `
    (function() {
      console.log('🔍 Checking extension status...');
      
      // Check if extension global variables exist
      const hasExtension = typeof window.processedMessageTexts !== 'undefined' || 
                          typeof window.claudeMessageHistory !== 'undefined';
      const hasLogger = typeof console.log === 'function';
      
      // Check if diagnostic is loaded
      const hasDiagnostic = typeof window.claudeDiagnostic !== 'undefined' && 
                           typeof window.transmissionDiagnostic !== 'undefined';
      
      // Try to find the extension in Chrome runtime
      let extensionLoaded = false;
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          extensionLoaded = true;
        }
      } catch (e) {
        console.log('Chrome runtime not available:', e.message);
      }
      
      console.log('📊 Extension Status:', {
        hasExtension,
        hasLogger,
        hasDiagnostic,
        extensionLoaded,
        userAgent: navigator.userAgent.slice(0, 50),
        url: window.location.href
      });
      
      // Try to manually trigger the extension loading
      if (!hasExtension) {
        console.log('⚠️ Extension not detected, trying to reload...');
        
        // Try to reload the page's extension context
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            console.log('🔄 Extension context available, sending test message...');
            chrome.runtime.sendMessage({type: 'TEST', payload: {test: true}}, (response) => {
              console.log('Extension test response:', response);
            });
          }
        } catch (e) {
          console.log('Extension reload failed:', e.message);
        }
      }
      
      return {
        hasExtension,
        hasDiagnostic,
        extensionLoaded,
        timestamp: Date.now()
      };
    })();
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: checkScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Error checking extension:', response.error);
    } else {
      console.log('📋 Extension check result:', response.result?.value);
      
      const status = response.result?.value;
      if (status && !status.hasExtension) {
        console.log('🚨 Extension not loaded! Need to reload manually or check chrome://extensions/');
      } else if (status && status.hasExtension) {
        console.log('✅ Extension is loaded and working');
        
        // Try to trigger a test log
        setTimeout(() => {
          console.log('🧪 Triggering test log...');
          const testLogScript = `
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({
                type: 'LOG',
                payload: {
                  id: 'test-' + Date.now(),
                  ts: new Date().toISOString(),
                  platform: 'claude',
                  convo: 'test',
                  role: 'assistant',
                  text: 'okay99 - extension test',
                  urls: [],
                  metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: 21
                  }
                }
              }, (response) => {
                console.log('Test log response:', response);
              });
            }
          `;
          
          const testMessage = {
            id: 2,
            method: 'Runtime.evaluate',
            params: {
              expression: testLogScript,
              returnByValue: true
            }
          };
          
          ws.send(JSON.stringify(testMessage));
        }, 2000);
      }
    }
  } else if (response.id === 2) {
    console.log('📤 Test log sent:', response.result?.value);
    setTimeout(() => {
      console.log('✅ Extension status check complete');
      process.exit(0);
    }, 2000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});