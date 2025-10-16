// Node.js script to inject diagnostic code into Claude tab via DevTools Protocol
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Claude tab ID from DevTools API
const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

// Read the diagnostic script
const diagnosticScript = fs.readFileSync(
  path.join(__dirname, 'claude_transmission_diagnostic.js'), 
  'utf8'
);

console.log('🔌 Connecting to Claude tab via WebSocket...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Inject the diagnostic script
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: diagnosticScript,
      returnByValue: true
    }
  };
  
  console.log('💉 Injecting diagnostic script...');
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Error injecting script:', response.error);
    } else {
      console.log('✅ Diagnostic script injected successfully!');
      console.log('🎯 Result:', response.result?.value || 'Script executed');
      
      // Wait a moment, then trigger test sequence
      setTimeout(() => {
        console.log('🧪 Triggering test sequence...');
        const testMessage = {
          id: 2,
          method: 'Runtime.evaluate',
          params: {
            expression: 'claudeDiagnostic.runTestSequence()',
            returnByValue: true
          }
        };
        ws.send(JSON.stringify(testMessage));
      }, 2000);
    }
  } else if (response.id === 2) {
    if (response.error) {
      console.error('❌ Error running test sequence:', response.error);
    } else {
      console.log('✅ Test sequence triggered:', response.result?.value);
      
      // Keep connection alive to monitor
      console.log('👀 Monitoring transmission patterns...');
      console.log('💡 Check Chrome DevTools Console for live diagnostic output');
    }
  } else {
    // Runtime events
    console.log('📡 Runtime event:', response.method);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

// Keep alive
process.on('SIGINT', () => {
  console.log('\n👋 Closing diagnostic connection...');
  ws.close();
  process.exit(0);
});