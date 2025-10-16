// Inject persistence-filtered Claude logger via DevTools
const WebSocket = require('ws');
const fs = require('fs');

const CLAUDE_TAB_ID = 'E496815C76D0B562F7249C435E19F736';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('💉 Injecting persistence-filtered Claude logger...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab for persistence logger injection');
  
  // Read the persistence-filtered logger script
  const loggerScript = fs.readFileSync('C:\\dev\\chatgpt-live-logger\\debug\\tools\\persistence_filtered_logger.js', 'utf8');
  
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
      console.error('❌ Persistence logger injection failed:', response.error);
    } else {
      console.log('✅ Persistence-filtered logger injected successfully!');
      console.log('👻 Ghost message filtering active with 500ms persistence threshold');
      console.log('🧪 Ready to test against phantom DOM mutations!');
    }
    
    setTimeout(() => process.exit(0), 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Persistence logger injection connection closed');
});