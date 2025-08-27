// Script to help reload the extension (needs to be run in Claude's console)
console.log("🔄 Reloading extension context...");

// Clear any existing message tracking
if (typeof window.claudeMessageHistory !== 'undefined') {
    window.claudeMessageHistory = [];
    console.log("✅ Cleared message history");
}

if (typeof window.processedMessageTexts !== 'undefined') {
    window.processedMessageTexts.clear();
    console.log("✅ Cleared processed message texts");
}

console.log("💡 Extension context cleared. Please reload the Claude tab for full extension reload.");