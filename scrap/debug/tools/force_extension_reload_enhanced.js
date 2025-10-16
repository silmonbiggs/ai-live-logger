// Enhanced extension reload with better tracking verification
console.log("🔄 ENHANCED EXTENSION RELOAD TEST");
console.log("=================================");

// Clear all extension tracking with enhanced verification
console.log("🧹 Clearing all tracking data...");

if (typeof window.claudeMessageHistory !== 'undefined') {
    console.log(`Clearing ${window.claudeMessageHistory.length} message history entries`);
    window.claudeMessageHistory = [];
}

if (typeof window.processedMessageTexts !== 'undefined') {
    if (window.processedMessageTexts instanceof Map) {
        console.log(`Clearing ${window.processedMessageTexts.size} processed text entries (Map)`);
        window.processedMessageTexts.clear();
    } else if (window.processedMessageTexts instanceof Set) {
        console.log(`Clearing ${window.processedMessageTexts.size} processed text entries (Set)`);
        window.processedMessageTexts.clear();
    }
}

if (typeof window.conversationState !== 'undefined') {
    console.log(`Clearing conversation state with ${window.conversationState.baseline?.size || 0} baseline entries`);
    window.conversationState = {
        lastKnownMessageCount: 0,
        lastUserInteraction: 0,
        sequentialMessages: new Map(),
        baseline: new Set()
    };
}

// Reinitialize with new structure
console.log("🔧 Reinitializing with enhanced tracking...");
window.processedMessageTexts = new Map(); // Map with timestamps
window.claudeMessageHistory = [];
window.conversationState = {
    lastKnownMessageCount: 0,
    lastUserInteraction: 0,
    sequentialMessages: new Map(),
    baseline: new Set()
};

console.log("✅ Enhanced tracking initialized");
console.log("📊 Current state:");
console.log("  - processedMessageTexts:", window.processedMessageTexts instanceof Map ? "Map" : typeof window.processedMessageTexts);
console.log("  - processedMessageTexts size:", window.processedMessageTexts.size);
console.log("  - conversationState:", typeof window.conversationState);

console.log("\n🌟 PLEASE REFRESH THE CLAUDE TAB NOW");
console.log("   - Press Ctrl+R or F5 to reload with enhanced duplicate detection");
console.log("   - Then test with a new message like: 'testmessage40, respond okay40'");