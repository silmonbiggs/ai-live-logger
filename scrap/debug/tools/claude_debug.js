// Simplified Claude Debug Script - Paste this in Claude's browser console
// This will test our selectors and show what's actually available

console.log("🔍 Claude Debug Script Starting...");

// Test platform detection
const hostname = window.location.hostname;
console.log("Current hostname:", hostname);
console.log("Platform detected:", hostname.includes('claude.ai') ? 'claude' : 'other');

// Test our Claude selectors
const userInputSelectors = [
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]', 
    'textarea[data-testid*="input"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="message"]',
    'textarea',
    '[role="textbox"]'
];

console.log("\n📝 Looking for user input fields...");
let foundInput = null;
userInputSelectors.forEach((selector, i) => {
    const elements = document.querySelectorAll(selector);
    console.log(`${i+1}. "${selector}" → ${elements.length} elements`);
    
    if (elements.length > 0 && !foundInput) {
        elements.forEach((el, j) => {
            if (el.offsetHeight > 0 && el.offsetWidth > 100) {
                foundInput = el;
                console.log(`   ✅ Found visible input: ${el.tagName} - ${el.placeholder || 'no placeholder'}`);
            }
        });
    }
});

// Test assistant message selectors
const assistantSelectors = [
    '[data-role="assistant"]',
    '[data-message-role="assistant"]',
    '.message-assistant',
    '[data-testid*="assistant"]',
    '[data-testid*="message"]'
];

console.log("\n🤖 Looking for assistant messages...");
let foundMessages = 0;
assistantSelectors.forEach((selector, i) => {
    const elements = document.querySelectorAll(selector);
    console.log(`${i+1}. "${selector}" → ${elements.length} elements`);
    
    if (elements.length > 0) {
        foundMessages += elements.length;
        elements.forEach((el, j) => {
            const text = (el.innerText || el.textContent || '').slice(0, 100);
            if (text.trim()) {
                console.log(`   📄 Message ${j+1}: "${text}..."`);
            }
        });
    }
});

// General DOM exploration
console.log("\n🔍 General DOM exploration...");
console.log("Total textareas:", document.querySelectorAll('textarea').length);
console.log("Total contenteditable:", document.querySelectorAll('[contenteditable]').length);
console.log("Total role=textbox:", document.querySelectorAll('[role="textbox"]').length);

// Look for any divs that might contain messages
const allDivs = document.querySelectorAll('div');
let messagelike = 0;
allDivs.forEach(div => {
    const text = (div.innerText || '').trim();
    if (text.length > 50 && text.length < 1000) {
        messagelike++;
    }
});
console.log("Divs that look like messages (50-1000 chars):", messagelike);

// Test if extension is actually loaded
console.log("\n🔌 Extension status check...");
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log("✅ Chrome extension API available");
    try {
        chrome.runtime.sendMessage({test: true}, (response) => {
            console.log("Extension response:", response);
        });
    } catch (e) {
        console.log("❌ Extension communication error:", e.message);
    }
} else {
    console.log("❌ Chrome extension API not available");
}

console.log("\n🏁 Debug complete! Results summary:");
console.log("- Input field found:", foundInput ? "YES" : "NO");
console.log("- Assistant messages found:", foundMessages);
console.log("- Platform:", hostname.includes('claude.ai') ? 'Claude' : 'Other');

if (foundInput) {
    console.log("\n💡 Try typing in the input field now to test capture...");
}