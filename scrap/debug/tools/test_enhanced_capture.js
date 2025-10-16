// Test the enhanced logger by sending a message and monitoring logs
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🧪 Testing enhanced Claude logger response capture...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab for testing');
  
  // First, check if our logger is active
  const checkScript = `
    if (window.directClaudeLogger) {
      console.log('[TEST] Enhanced logger is active!');
      console.log('[TEST] Current state:', window.directClaudeLogger.getState());
      'LOGGER_ACTIVE';
    } else {
      console.log('[TEST] Logger not found!');
      'LOGGER_NOT_FOUND';
    }
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
    console.log('Logger status:', response.result?.value);
    
    if (response.result?.value === 'LOGGER_ACTIVE') {
      console.log('✅ Logger is active, proceeding with test...');
      
      // Now simulate finding and triggering a response
      setTimeout(() => {
        const testScript = `
          // Test the logger by simulating a response detection
          console.log('[TEST] Simulating response detection...');
          
          // Look for existing seq_ok response
          const seqElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent?.trim() || '';
            return text === 'seq_ok';
          });
          
          console.log('[TEST] Found seq_ok elements:', seqElements.length);
          
          if (seqElements.length > 0) {
            const element = seqElements[0];
            console.log('[TEST] Testing direct logging of seq_ok...');
            window.directClaudeLogger.testLog('seq_ok', 'assistant');
            
            'TEST_LOGGED_RESPONSE';
          } else {
            'NO_RESPONSE_FOUND';
          }
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
      }, 1000);
    }
  } else if (response.id === 2) {
    console.log('Test result:', response.result?.value);
    
    // Check the server logs after a moment
    setTimeout(() => {
      console.log('🔍 Checking server logs for captured messages...');
      process.exit(0);
    }, 2000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Testing connection closed');
});