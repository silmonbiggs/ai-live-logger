// Inject production Claude logger via DevTools
const WebSocket = require('ws');
const fs = require('fs');

const CLAUDE_TAB_ID = 'E496815C76D0B562F7249C435E19F736';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('💉 Injecting production Claude logger...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab for production injection');
  
  // Read the production logger script
  const loggerScript = fs.readFileSync('C:\\dev\\chatgpt-live-logger\\debug\\tools\\production_claude_logger.js', 'utf8');
  
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
      console.error('❌ Production injection failed:', response.error);
    } else {
      console.log('✅ Production logger injected successfully!');
      console.log('🎯 Ready for real-world message testing!');
    }
    
    setTimeout(() => process.exit(0), 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Production injection connection closed');
});