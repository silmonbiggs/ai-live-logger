// Check console logs to see if enhanced logger is working
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('📋 Checking console logs for enhanced logger activity...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to check console logs');
  
  // Enable console domain to receive console messages
  const enableConsole = {
    id: 1,
    method: 'Console.enable'
  };
  
  ws.send(JSON.stringify(enableConsole));
  
  // Check logger status
  setTimeout(() => {
    const checkScript = `
      console.log('=== LOGGER STATUS CHECK ===');
      if (typeof window.directClaudeLogger !== 'undefined') {
        console.log('[LOGGER] Enhanced logger is active!');
        const state = window.directClaudeLogger.getState();
        console.log('[LOGGER] Processed messages count:', state.processedMessages.size);
        console.log('[LOGGER] Conversation history:', state.conversationHistory.length);
        
        // Check if seq_ok was found
        const found = state.processedMessages.has('seq_ok');
        console.log('[LOGGER] seq_ok found in processed messages:', found);
        
        // Manual scan for seq_ok
        const allElements = document.querySelectorAll('*');
        let seqOkElements = 0;
        allElements.forEach(el => {
          if (el.textContent && el.textContent.trim() === 'seq_ok') {
            seqOkElements++;
            console.log('[LOGGER] Found seq_ok element:', el.tagName, el.className, el.id);
          }
        });
        console.log('[LOGGER] Manual scan found seq_ok elements:', seqOkElements);
        
        'LOGGER_ACTIVE';
      } else {
        console.log('[LOGGER] Enhanced logger NOT FOUND!');
        'LOGGER_NOT_FOUND';
      }
    `;
    
    const message = {
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: checkScript,
        returnByValue: true
      }
    };
    
    ws.send(JSON.stringify(message));
  }, 1000);
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  // Handle console messages
  if (response.method === 'Console.messageAdded') {
    const msg = response.params.message;
    console.log(`[CONSOLE] ${msg.level}: ${msg.text}`);
  }
  
  // Handle our check result
  if (response.id === 2) {
    console.log('Status check result:', response.result?.value);
    setTimeout(() => process.exit(0), 2000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Console check connection closed');
});