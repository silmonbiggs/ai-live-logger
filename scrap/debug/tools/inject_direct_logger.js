// Inject the direct Claude logger
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

// Read the direct logger script
const loggerScript = fs.readFileSync(
  path.join(__dirname, 'direct_claude_logger.js'), 
  'utf8'
);

console.log('🔌 Connecting to Claude tab to inject direct logger...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: loggerScript,
      returnByValue: true
    }
  };
  
  console.log('💉 Injecting direct Claude logger...');
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Error injecting direct logger:', response.error);
    } else {
      console.log('✅ Direct logger injected successfully!');
      
      // Test the logger
      setTimeout(() => {
        console.log('🧪 Testing direct logger...');
        const testScript = `
          window.directClaudeLogger.testLog('okay99 - direct logger test', 'assistant');
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
    console.log('✅ Direct logger test completed');
    console.log('👀 Monitor server logs for captured messages');
    console.log('🔄 Logger is now active and monitoring DOM changes');
    
    // Keep connection alive to monitor
    setInterval(() => {
      // Send heartbeat to keep connection alive
      const heartbeat = {
        id: Date.now(),
        method: 'Runtime.evaluate',
        params: {
          expression: '"heartbeat"',
          returnByValue: true
        }
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(heartbeat));
      }
    }, 30000); // Every 30 seconds
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Direct logger connection closed');
});