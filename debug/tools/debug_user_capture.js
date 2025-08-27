// Debug script to test user input capture directly in ChatGPT console
// Paste this into ChatGPT's browser console to test user input detection

console.log("=== ChatGPT User Input Debug ===");

// Find all possible input elements
const allInputs = document.querySelectorAll('input, textarea, [contenteditable], [role="textbox"]');
console.log("Found input elements:", allInputs.length);

allInputs.forEach((el, i) => {
  console.log(`Input ${i}:`, {
    tag: el.tagName,
    type: el.type,
    placeholder: el.placeholder,
    visible: el.offsetHeight > 0 && el.offsetWidth > 0,
    size: `${el.offsetWidth}x${el.offsetHeight}`,
    className: el.className,
    id: el.id,
    dataId: el.getAttribute('data-id'),
    testId: el.getAttribute('data-testid'),
    value: (el.value || el.innerText || el.textContent || '').slice(0, 50)
  });
});

// Try specific ChatGPT selectors
const chatGptSelectors = [
  'textarea[placeholder*="Ask"]',
  'textarea[placeholder="Ask anything"]',
  'div[contenteditable="true"]',
  '[data-testid*="prompt"]',
  'textarea'
];

console.log("Testing ChatGPT-specific selectors:");
chatGptSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`${selector}: found ${elements.length} elements`);
  elements.forEach((el, i) => {
    console.log(`  Element ${i}:`, {
      visible: el.offsetHeight > 0 && el.offsetWidth > 0,
      size: `${el.offsetWidth}x${el.offsetHeight}`,
      placeholder: el.placeholder,
      value: (el.value || el.innerText || el.textContent || '').slice(0, 50)
    });
  });
});

// Test if we can find the active input when user types
console.log("Now type something in the input field and press Enter to see what element is active...");

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const activeEl = document.activeElement;
    console.log("Enter pressed, active element:", {
      tag: activeEl.tagName,
      placeholder: activeEl.placeholder,
      className: activeEl.className,
      value: (activeEl.value || activeEl.innerText || activeEl.textContent || '').slice(0, 100),
      visible: activeEl.offsetHeight > 0 && activeEl.offsetWidth > 0
    });
  }
});