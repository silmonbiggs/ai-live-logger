// Send a proper test message to Claude via DevTools
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔌 Connecting to Claude tab to send test message...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Script to properly send a message
  const sendScript = `
    (function() {
      console.log('🧪 Sending test message via script...');
      
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
          console.log('✅ Found input field:', selector);
          break;
        }
      }
      
      if (!input) {
        console.log('❌ No input field found');
        return false;
      }
      
      // Clear existing content and set new message
      const testMessage = 'testmessage99, respond okay99';
      console.log('📝 Setting message:', testMessage);
      
      // Clear the field first
      if (input.tagName === 'TEXTAREA') {
        input.value = '';
        input.focus();
        input.value = testMessage;
        
        // Trigger proper events
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        input.innerText = '';
        input.focus();
        input.innerText = testMessage;
        
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      console.log('✅ Message set in input field');
      
      // Wait a moment then send
      setTimeout(() => {
        // Try multiple send approaches
        console.log('🔍 Looking for send button...');
        
        const sendSelectors = [
          'button[aria-label*="send"]',
          'button[aria-label*="Send"]', 
          'button[data-testid*="send"]',
          'button[type="submit"]',
          'button:has(svg)',
          'button[title*="send"]',
          'button[title*="Send"]'
        ];
        
        let sendButton = null;
        for (const selector of sendSelectors) {
          try {
            const found = document.querySelector(selector);
            if (found && found.offsetHeight > 0 && !found.disabled) {
              sendButton = found;
              console.log('✅ Found send button:', selector, found);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (sendButton) {
          console.log('🚀 Clicking send button...');
          sendButton.click();
          return true;
        } else {
          console.log('⌨️ Trying Enter key...');
          // Try Enter key as fallback
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          input.dispatchEvent(enterEvent);
          return true;
        }
      }, 1000);
      
      return true;
    })();
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: sendScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Error sending message:', response.error);
    } else {
      console.log('✅ Test message script executed:', response.result?.value);
      console.log('⏳ Waiting for Claude response...');
      
      // Keep connection alive to monitor
      setTimeout(() => {
        console.log('✅ Test message sending complete');
        process.exit(0);
      }, 5000);
    }
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});