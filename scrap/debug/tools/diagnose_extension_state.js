// Comprehensive extension state diagnostic tool
// Run this in Claude's browser console to diagnose the duplicate issue

console.log("🔍 EXTENSION STATE DIAGNOSTIC");
console.log("============================");

// 1. Check if extension is loaded and responsive
console.log("📡 Extension Connection Test:");
try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({type: "PING"}, (response) => {
            if (chrome.runtime.lastError) {
                console.log("❌ Extension context error:", chrome.runtime.lastError.message);
            } else {
                console.log("✅ Extension responding:", response);
            }
        });
    } else {
        console.log("❌ Chrome runtime not available");
    }
} catch (e) {
    console.log("❌ Extension connection failed:", e.message);
}

// 2. Check global state variables
console.log("\n📊 Global State Check:");
console.log("processedMessageTexts:", typeof window.processedMessageTexts, window.processedMessageTexts instanceof Map ? `Map(${window.processedMessageTexts.size})` : window.processedMessageTexts?.size);
console.log("claudeMessageHistory:", typeof window.claudeMessageHistory, window.claudeMessageHistory?.length);
console.log("conversationState:", typeof window.conversationState, window.conversationState?.baseline?.size);

// 3. Check if new functions exist
console.log("\n🔧 Function Availability:");
console.log("isNewMessage:", typeof isNewMessage);
console.log("recordUserInteraction:", typeof recordUserInteraction);
console.log("establishConversationBaseline:", typeof establishConversationBaseline);

// 4. Show recent processed messages
console.log("\n📋 Recent Processed Messages:");
if (window.processedMessageTexts instanceof Map) {
    let count = 0;
    for (const [text, timestamp] of window.processedMessageTexts) {
        if (count >= 5) break;
        const age = Date.now() - timestamp;
        console.log(`  "${text.slice(0, 40)}..." processed ${Math.round(age/1000)}s ago`);
        count++;
    }
} else if (window.processedMessageTexts instanceof Set) {
    console.log("  Old Set structure detected:", Array.from(window.processedMessageTexts).slice(0, 3));
} else {
    console.log("  No processed messages found");
}

// 5. Test duplicate detection manually
console.log("\n🧪 Manual Duplicate Detection Test:");
if (typeof isNewMessage === 'function') {
    const testResults = [
        {text: "okay38", expected: "should be duplicate"},
        {text: "okay40", expected: "should be duplicate"}, 
        {text: "testmessage999", expected: "should be new"}
    ];
    
    testResults.forEach(test => {
        const result = isNewMessage(test.text, Date.now());
        console.log(`  "${test.text}" -> ${result ? "NEW" : "DUPLICATE"} (${test.expected})`);
    });
} else {
    console.log("  isNewMessage function not available");
}

// 6. DOM mutation observer status
console.log("\n👁️ Observer Status:");
const observers = document.body?.__observers__ || "Not visible";
console.log("  DOM observers:", observers);

// 7. Console error check
console.log("\n⚠️ Check browser console for red error messages above this diagnostic");

console.log("\n💡 RECOMMENDATION:");
if (typeof window.processedMessageTexts === 'undefined' || typeof isNewMessage === 'undefined') {
    console.log("   Extension needs reload - press Ctrl+R to refresh this Claude tab");
} else if (window.processedMessageTexts instanceof Set) {
    console.log("   Old extension code detected - press Ctrl+R to load updated version");
} else {
    console.log("   Extension appears loaded - check for runtime errors above");
}