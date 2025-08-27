// Test script for the improved duplicate detection
// Run this in Claude's browser console

console.log("🧪 TESTING NEW MESSAGE DETECTION SYSTEM");

// First, let's check the current conversation state
console.log("📊 Current conversation state:");
if (typeof window.conversationState !== 'undefined') {
    console.log("  - Baseline messages:", window.conversationState?.baseline?.size || 0);
    console.log("  - Last user interaction:", window.conversationState?.lastUserInteraction || 0);
} else {
    console.log("  - Conversation state not initialized");
}

console.log("  - Processed messages:", window.processedMessageTexts?.size || 0);
console.log("  - Claude message history:", window.claudeMessageHistory?.length || 0);

// Show current visible messages in the conversation
console.log("\n📋 Current visible conversation:");
const messages = document.querySelectorAll('[data-testid*="message"], .message, [data-role*="assistant"], div[class*="message"]');
console.log(`Found ${messages.length} potential message elements`);

messages.forEach((msg, i) => {
    const text = (msg.innerText || msg.textContent || '').trim();
    if (text && text.length > 5 && text.length < 200) {
        console.log(`  ${i+1}. "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
    }
});

console.log("\n🔄 Ready for testing. Send a new message in Claude to test the improved detection system.");
console.log("   Expected: Only genuinely new messages should be logged to chat.log");