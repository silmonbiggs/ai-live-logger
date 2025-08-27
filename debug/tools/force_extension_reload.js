// Force reload extension and clear all tracking
// Run this in Claude's browser console

console.log("🔄 FORCE RELOADING EXTENSION...");

// Clear all extension tracking
if (typeof window.claudeMessageHistory !== 'undefined') {
    window.claudeMessageHistory = [];
    console.log("✅ Cleared message history");
}

if (typeof window.processedMessageTexts !== 'undefined') {
    window.processedMessageTexts.clear();
    console.log("✅ Cleared processed texts");
}

console.log("🌟 PLEASE REFRESH THE CLAUDE TAB NOW TO FULLY RELOAD THE EXTENSION");
console.log("   - Press Ctrl+R or F5 to refresh");
console.log("   - This will reload the content script with the latest fixes");

// Show the current conversation for reference
console.log("\n📋 Current visible conversation in browser:");
const messages = document.querySelectorAll('[data-testid*="message"], .message');
messages.forEach((msg, i) => {
    const text = (msg.innerText || '').trim().slice(0, 100);
    if (text) {
        console.log(`${i+1}. ${text}...`);
    }
});