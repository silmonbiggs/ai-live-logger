// Inject enhanced Claude logger via DevTools
const WebSocket = require('ws');
const fs = require('fs');

const CLAUDE_TAB_ID = 'E496815C76D0B562F7249C435E19F736';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('💉 Injecting enhanced Claude logger...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab for injection');
  
  // Read the enhanced logger script
  const loggerScript = fs.readFileSync('C:\\dev\\chatgpt-live-logger\\debug\\tools\\direct_claude_logger.js', 'utf8');
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: loggerScript,
      returnByValue: false
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Injection failed:', response.error);
    } else {
      console.log('✅ Enhanced logger injected successfully!');
      
      // Wait a moment then send a test message to trigger the logger
      setTimeout(() => {
        console.log('🧪 Sending test trigger to activate logger...');
        
        const testScript = `
          console.log('TEST: Looking for existing seq_ok...');
          const testElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.trim() === 'seq_ok'
          );
          console.log('Found seq_ok elements:', testElements.length);
          testElements.forEach(el => {
            console.log('seq_ok element:', el.tagName, el.className, el.textContent);
          });
          'TEST_COMPLETE';
        `;
        
        const testMessage = {
          id: 2,
          method: 'Runtime.evaluate', 
          params: {
            expression: testScript,
            returnByValue: true
          }
        };
        
        ws.send(JSON.stringify(testMessage));
      }, 2000);
    }
  } else if (response.id === 2) {
    console.log('🧪 Test result:', response.result?.value);
    setTimeout(() => process.exit(0), 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});