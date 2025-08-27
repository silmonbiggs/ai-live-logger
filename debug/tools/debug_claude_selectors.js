// Debug script to test Claude selector compatibility
// Run this in Claude's browser console to see what elements are available

console.log("=== Claude DOM Selector Debug ===");
console.log("Current URL:", window.location.href);
console.log("Hostname:", window.location.hostname);

// Test platform detection
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'chatgpt';
  return 'unknown';
}

console.log("Detected platform:", detectPlatform());

// Test Claude selectors
const CLAUDE_SELECTORS = {
  userInput: [
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]', 
    'textarea[data-testid*="input"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="message"]',
    '[data-cy="chat-input"]',
    '.chat-input textarea',
    '[data-testid="chat-input"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="ask"]',
    'textarea',
    '[role="textbox"]'
  ],
  assistantMessages: [
    '[data-role="assistant"]',
    '[data-message-role="assistant"]',
    '.message-assistant',
    '.claude-message', 
    '[data-testid*="assistant"]',
    '.response-message',
    '[data-testid*="message"][data-role*="assistant"]',
    '.message[data-role="assistant"]'
  ]
};

console.log("\n=== Testing User Input Selectors ===");
CLAUDE_SELECTORS.userInput.forEach((selector, i) => {
  const elements = document.querySelectorAll(selector);
  console.log(`${i+1}. "${selector}" found ${elements.length} elements`);
  if (elements.length > 0) {
    elements.forEach((el, j) => {
      console.log(`   Element ${j+1}:`, {
        tagName: el.tagName,
        placeholder: el.placeholder,
        visible: el.offsetHeight > 0 && el.offsetWidth > 0,
        value: (el.value || el.innerText || '').slice(0, 50)
      });
    });
  }
});

console.log("\n=== Testing Assistant Message Selectors ===");
CLAUDE_SELECTORS.assistantMessages.forEach((selector, i) => {
  const elements = document.querySelectorAll(selector);
  console.log(`${i+1}. "${selector}" found ${elements.length} elements`);
  if (elements.length > 0) {
    elements.forEach((el, j) => {
      const text = (el.innerText || el.textContent || '').slice(0, 100);
      console.log(`   Element ${j+1}: "${text}"`);
    });
  }
});

console.log("\n=== General DOM Analysis ===");
console.log("All textareas:", document.querySelectorAll('textarea').length);
console.log("All contenteditable:", document.querySelectorAll('[contenteditable]').length);
console.log("All role=textbox:", document.querySelectorAll('[role="textbox"]').length);

// Find potential input fields
console.log("\n=== Potential Input Fields ===");
const allInputs = document.querySelectorAll('input, textarea, [contenteditable], [role="textbox"]');
allInputs.forEach((el, i) => {
  if (el.offsetHeight > 0 && el.offsetWidth > 50) {
    console.log(`Input ${i+1}:`, {
      tagName: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      'aria-label': el.getAttribute('aria-label'),
      size: `${el.offsetWidth}x${el.offsetHeight}`,
      classes: el.className.slice(0, 50)
    });
  }
});

console.log("\n=== Done ===");