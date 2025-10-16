// Fresh test with enhanced logger - send message and monitor logs
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🧪 Fresh test of enhanced Claude logger...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Simple script to type a test message
  const testMessage = `Jfresh_test, respond fresh_ok`;
  
  const typeScript = `
    // Find the message input textarea
    const inputSelectors = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="message"]', 
      'textarea[data-testid*="input"]',
      'textarea',
      '[contenteditable="true"]'
    ];
    
    let inputElement = null;
    for (const selector of inputSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        inputElement = elements[0];
        break;
      }
    }
    
    if (inputElement) {
      console.log('Found input element:', inputElement.tagName, inputElement.placeholder);
      
      // Clear and type the test message
      inputElement.value = '${testMessage}';
      inputElement.focus();
      
      // Trigger input events
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Try to find and click send button
      const sendSelectors = [
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]',
        'button:has(svg)',
        'button[type="submit"]'
      ];
      
      let sendButton = null;
      for (const selector of sendSelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          sendButton = buttons[0];
          break;
        }
      }
      
      if (sendButton && !sendButton.disabled) {
        console.log('Found send button, clicking...');
        sendButton.click();
        'MESSAGE_SENT';
      } else {
        console.log('Send button not found or disabled');
        'SEND_FAILED';
      }
    } else {
      console.log('Input element not found');
      'INPUT_NOT_FOUND';
    }
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: typeScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    console.log('Send attempt result:', response.result?.value);
    
    // Wait for Claude to respond, then check logs
    setTimeout(() => {
      console.log('⏳ Waiting for Claude response...');
      
      setTimeout(() => {
        console.log('✅ Test complete - Check server logs for captured messages');
        process.exit(0);
      }, 5000);
    }, 2000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Testing connection closed');
});