// Send test message to trigger Claude retransmission analysis
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🧪 Starting Claude retransmission analysis test...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Clear the direct logger state first
  const clearScript = `
    if (window.directClaudeLogger) {
      window.directClaudeLogger.clearState();
      console.log('🧹 Direct logger state cleared');
    }
  `;
  
  const clearMessage = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: clearScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(clearMessage));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    console.log('✅ Logger state cleared, sending retransmission test...');
    
    // Send a message that should trigger retransmission analysis
    const testScript = `
      (function() {
        console.log('🧪 Sending retransmission analysis message...');
        
        // Find input field
        const inputSelectors = [
          'textarea[placeholder*="message"]',
          'textarea[placeholder*="Message"]',
          '[contenteditable="true"]',
          'textarea',
          '[role="textbox"]'
        ];
        
        let input = null;
        for (const selector of inputSelectors) {
          const found = document.querySelector(selector);
          if (found && found.offsetHeight > 0 && found.offsetWidth > 100) {
            input = found;
            break;
          }
        }
        
        if (!input) {
          return 'NO_INPUT_FOUND';
        }
        
        // Send a message designed to test retransmission
        const testMessage = 'Test retransmission analysis. Please respond with: okay_retrans_test_' + Date.now();
        console.log('📝 Test message:', testMessage);
        
        // Clear and set message
        if (input.tagName === 'TEXTAREA') {
          input.value = '';
          input.focus();
          input.value = testMessage;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          input.innerText = '';
          input.focus();
          input.innerText = testMessage;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Send the message
        setTimeout(() => {
          const sendSelectors = [
            'button[aria-label*="send"]',
            'button[aria-label*="Send"]',
            'button[data-testid*="send"]',
            'button[type="submit"]',
            'button:has(svg)'
          ];
          
          let sendButton = null;
          for (const selector of sendSelectors) {
            try {
              const found = document.querySelector(selector);
              if (found && found.offsetHeight > 0 && !found.disabled) {
                sendButton = found;
                break;
              }
            } catch (e) {}
          }
          
          if (sendButton) {
            console.log('🚀 Sending message...');
            sendButton.click();
          } else {
            console.log('⌨️ Using Enter key...');
            input.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              keyCode: 13,
              bubbles: true
            }));
          }
        }, 1000);
        
        return 'MESSAGE_SENT';
      })();
    `;
    
    const sendMessage = {
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: testScript,
        returnByValue: true
      }
    };
    
    ws.send(JSON.stringify(sendMessage));
    
  } else if (response.id === 2) {
    console.log('📤 Message send result:', response.result?.value);
    console.log('⏳ Waiting for Claude response and retransmission analysis...');
    console.log('👀 Monitor server logs and direct logger output for patterns');
    
    // Monitor for 30 seconds
    setTimeout(() => {
      console.log('⚡ Analysis window complete');
      console.log('📊 Check logs to analyze retransmission patterns');
      
      // Get final state from direct logger
      const getStateScript = `
        if (window.directClaudeLogger) {
          const state = window.directClaudeLogger.getState();
          JSON.stringify({
            processedCount: state.processedMessages.size,
            historyCount: state.conversationHistory.length,
            recentMessages: state.conversationHistory.slice(-5).map(m => ({
              role: m.role,
              text: m.text.slice(0, 50),
              timestamp: m.timestamp
            }))
          });
        } else {
          'NO_LOGGER';
        }
      `;
      
      const stateMessage = {
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: getStateScript,
          returnByValue: true
        }
      };
      
      ws.send(JSON.stringify(stateMessage));
    }, 30000);
  } else if (response.id === 3) {
    try {
      const stateData = JSON.parse(response.result?.value || '{}');
      console.log('📊 Final logger state:', stateData);
    } catch (e) {
      console.log('📊 Final logger state:', response.result?.value);
    }
    
    console.log('✅ Retransmission analysis complete');
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Retransmission test connection closed');
});