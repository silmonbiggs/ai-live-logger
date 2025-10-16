// MANUAL BROWSER CONSOLE SCRIPT
// Copy and paste this into Claude's browser console (F12)

console.log('🔍 CLAUDE DOM INSPECTOR - Finding response elements...');

// Find elements containing "seq_ok" (the visible response)
const foundElements = [];
const allElements = document.querySelectorAll('*');

console.log(`Scanning ${allElements.length} DOM elements...`);

allElements.forEach((el, index) => {
  const text = el.textContent?.trim() || '';
  
  // Look for our known response text
  if (text === 'seq_ok' || text.includes('seq_ok')) {
    foundElements.push({
      index: index,
      element: el,
      tagName: el.tagName,
      className: el.className || 'none',
      id: el.id || 'none',
      textContent: text,
      selector: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}`,
      parentSelector: el.parentElement ? `${el.parentElement.tagName.toLowerCase()}${el.parentElement.id ? '#' + el.parentElement.id : ''}${el.parentElement.className ? '.' + el.parentElement.className.split(' ').join('.') : ''}` : 'none',
      attributes: Array.from(el.attributes || []).map(a => `${a.name}="${a.value}"`).join(' ')
    });
  }
});

console.log(`\n🎯 FOUND ${foundElements.length} ELEMENTS CONTAINING "seq_ok":`);

foundElements.forEach((item, i) => {
  console.log(`\n[${i}] ${item.tagName} - "${item.textContent}"`);
  console.log(`    Selector: ${item.selector}`);
  console.log(`    Parent: ${item.parentSelector}`);
  console.log(`    Class: "${item.className}"`);
  console.log(`    Attributes: ${item.attributes}`);
  console.log('    Element:', item.element);
});

// Test common selectors used for messages
const testSelectors = [
  'article',
  '[role="article"]',
  '[data-testid*="message"]',
  '[data-testid*="conversation"]',
  '[data-message-author-role]',
  '[data-message-author-role="assistant"]',
  '.message',
  '[class*="message"]',
  '[class*="response"]',
  '[class*="assistant"]'
];

console.log('\n📋 TESTING COMMON MESSAGE SELECTORS:');
testSelectors.forEach(selector => {
  try {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements`);
    
    if (elements.length > 0 && elements.length < 50) {
      Array.from(elements).slice(0, 3).forEach((el, i) => {
        const text = (el.textContent || '').trim().slice(0, 50);
        console.log(`  [${i}] ${el.tagName} - "${text}${text.length > 50 ? '...' : ''}"`);
      });
    }
  } catch (e) {
    console.log(`${selector}: Error - ${e.message}`);
  }
});

// Store results in window for easy access
window.claudeInspectionResults = {
  foundElements: foundElements,
  timestamp: new Date().toISOString()
};

console.log('\n✅ Inspection complete! Results stored in window.claudeInspectionResults');
console.log('Run: window.claudeInspectionResults to see all data');

// Return summary for easy copying
return {
  summary: `Found ${foundElements.length} elements containing "seq_ok"`,
  selectors: foundElements.map(el => el.selector),
  elements: foundElements
};