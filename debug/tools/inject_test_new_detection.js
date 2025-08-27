// Test the improved duplicate detection system
// This will be run in Claude's browser console

// Check current state
console.log("🧪 TESTING NEW MESSAGE DETECTION SYSTEM");
console.log("📊 Current conversation state:");
console.log("  - Extension start time:", window.extensionStartTime ? new Date(window.extensionStartTime) : "Not set");
console.log("  - Processed messages:", window.processedMessageTexts?.size || 0);
console.log("  - Conversation baseline:", window.conversationState?.baseline?.size || 0);
console.log("  - Last user interaction:", window.conversationState?.lastUserInteraction ? new Date(window.conversationState.lastUserInteraction) : "Not set");

// Show some baseline messages
if (window.conversationState?.baseline?.size > 0) {
    console.log("📋 Baseline messages (first 5):");
    let count = 0;
    for (const msg of window.conversationState.baseline) {
        if (count >= 5) break;
        console.log(`  ${count + 1}. "${msg.slice(0, 50)}${msg.length > 50 ? '...' : ''}"`);
        count++;
    }
}

// Now simulate a new message
console.log("\n🔄 Now send: 'testmessage38, respond okay38' in the chat input");
console.log("   Expected: Should log only this new message, not the historical ones");

// Set up monitoring
setTimeout(() => {
    console.log("⏰ Checking chat.log after message...");
    // We'll check this manually
}, 3000);