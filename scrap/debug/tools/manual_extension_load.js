// Manually load extension content script via DevTools
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

// Read the content script
const contentScript = fs.readFileSync(
  path.join(__dirname, '..', '..', 'extension', 'content.js'), 
  'utf8'
);

console.log('🔌 Connecting to Claude tab to manually load extension...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // First, check if extension is already loaded
  const checkMessage = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: 'typeof window.processedMessageTexts !== "undefined" ? "ALREADY_LOADED" : "NOT_LOADED"',
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(checkMessage));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    const status = response.result?.value;
    console.log('📋 Extension status:', status);
    
    if (status === 'NOT_LOADED') {
      console.log('💉 Loading extension content script manually...');
      
      const loadMessage = {
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: contentScript,
          returnByValue: true
        }
      };
      
      ws.send(JSON.stringify(loadMessage));
    } else {
      console.log('✅ Extension already loaded, testing logging...');
      
      // Test logging directly
      const testLogMessage = {
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            // Test the extension's logging directly
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              const testPayload = {
                id: 'manual-test-' + Date.now(),
                ts: new Date().toISOString(),
                platform: 'claude',
                convo: window.location.pathname.split('/').pop() || 'test',
                role: 'assistant',
                text: 'okay99',
                urls: [],
                metadata: {
                  artifacts: [],
                  tools: [],
                  streaming: false,
                  messageLength: 6
                }
              };
              
              chrome.runtime.sendMessage({ type: "LOG", payload: testPayload }, (response) => {
                console.log('Extension test result:', response);
              });
              
              'TEST_SENT';
            } else {
              'CHROME_RUNTIME_NOT_AVAILABLE';
            }
          `,
          returnByValue: true
        }
      };
      
      ws.send(JSON.stringify(testLogMessage));
    }
  } else if (response.id === 2) {
    if (response.error) {
      console.error('❌ Error loading extension:', response.error);
    } else {
      console.log('✅ Extension content script loaded!');
      
      // Now test the logging
      setTimeout(() => {
        console.log('🧪 Testing logging after manual load...');
        const testMessage = {
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              if (typeof chrome !== 'undefined' && chrome.runtime) {
                const testPayload = {
                  id: 'manual-test-' + Date.now(),
                  ts: new Date().toISOString(),
                  platform: 'claude',
                  convo: window.location.pathname.split('/').pop() || 'test',
                  role: 'assistant',
                  text: 'okay99',
                  urls: [],
                  metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: 6
                  }
                };
                
                chrome.runtime.sendMessage({ type: "LOG", payload: testPayload }, (response) => {
                  console.log('Manual test result:', response);
                });
                
                'MANUAL_TEST_SENT';
              } else {
                'CHROME_RUNTIME_NOT_AVAILABLE';
              }
            `,
            returnByValue: true
          }
        };
        
        ws.send(JSON.stringify(testMessage));
      }, 2000);
    }
  } else if (response.id === 3) {
    console.log('📤 Test log result:', response.result?.value);
    
    setTimeout(() => {
      console.log('✅ Manual extension load complete');
      process.exit(0);
    }, 3000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});