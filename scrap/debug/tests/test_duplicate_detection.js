// Test duplicate detection functionality
console.log("🔄 Testing duplicate detection...");

async function testDuplicateDetection() {
    const testMessage = "duplicate_test_message";
    
    console.log("📤 Sending same message multiple times to test duplicate detection...");
    
    // Send the same message 5 times rapidly
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch('http://127.0.0.1:8788/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `claude-duplicate-test-${Date.now()}-${i}`,
                    ts: new Date().toISOString(),
                    platform: "claude",
                    convo: "duplicate-test",
                    role: "assistant",
                    text: testMessage,
                    urls: [],
                    metadata: {
                        artifacts: [],
                        tools: [],
                        streaming: false,
                        messageLength: testMessage.length
                    }
                })
            });
            
            if (response.ok) {
                console.log(`✅ Message ${i+1} sent (should be filtered after first)`);
            } else {
                console.log(`❌ Message ${i+1} failed`);
            }
        } catch (error) {
            console.error(`Error sending message ${i+1}:`, error.message);
        }
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log("\n⏰ Waiting 3 seconds, then testing different message...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test with a different message (should go through)
    try {
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-different-test-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "duplicate-test",
                role: "assistant",
                text: "different_test_message",
                urls: [],
                metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: 22
                }
            })
        });
        
        if (response.ok) {
            console.log("✅ Different message sent successfully");
        }
    } catch (error) {
        console.error("Error sending different message:", error.message);
    }
    
    console.log("\n✅ Duplicate detection test complete. Check server logs!");
}

testDuplicateDetection();