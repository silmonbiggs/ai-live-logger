// Copy and paste this into Claude's browser console to test the improved duplicate detection
console.log("🔧 TESTING IMPROVED DUPLICATE DETECTION");
console.log("======================================");

// First, let's check if the new code is loaded
if (typeof window.conversationState === 'undefined') {
    console.log("❌ New conversation state tracking not found - extension may need to be reloaded");
    console.log("💡 Please refresh the Claude tab to load the updated extension");
} else {
    console.log("✅ New conversation state tracking is loaded");
    console.log("   - Baseline size:", window.conversationState.baseline.size);
    console.log("   - Last user interaction:", window.conversationState.lastUserInteraction ? new Date(window.conversationState.lastUserInteraction) : "None");
}

// Show current tracking state
console.log("\n📊 Current tracking state:");
console.log("   - Processed messages:", window.processedMessageTexts?.size || 0);
console.log("   - Message history:", window.claudeMessageHistory?.length || 0);

// Show first few baseline messages
if (window.conversationState?.baseline?.size > 0) {
    console.log("\n📋 Sample baseline messages:");
    let count = 0;
    for (const msg of window.conversationState.baseline) {
        if (count >= 3) break;
        console.log(`   ${count + 1}. "${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}"`);
        count++;
    }
}

// Now let's simulate what happens when we record a user interaction
console.log("\n🧪 SIMULATION: Recording user interaction now...");
if (typeof window.conversationState !== 'undefined' && window.conversationState.recordUserInteraction) {
    // This function doesn't exist, let me use the correct name
} else if (typeof recordUserInteraction === 'function') {
    recordUserInteraction();
    console.log("✅ User interaction recorded");
} else {
    console.log("⚠️ recordUserInteraction function not found - this is normal, it's in the extension scope");
    console.log("💡 Instead, send a real message like: 'testmessage38, respond okay38'");
}

console.log("\n🎯 TEST PLAN:");
console.log("1. Clear the chat.log file");
console.log("2. Send message: 'testmessage38, respond okay38'"); 
console.log("3. Check if only the NEW message appears in chat.log");
console.log("4. Expected: No duplicates of previous messages");

// Helper to check log file (this won't work from browser, just for reference)
console.log("\n📝 To check results:");
console.log("   Run: Get-Content 'C:\\dev\\chatgpt-live-logger\\server\\chat.log'");