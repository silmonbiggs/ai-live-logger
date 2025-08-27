// Final test to simulate the exact Claude conversation scenario
console.log("🧪 Final duplicate prevention test - simulating Claude conversation");

async function finalTest() {
    console.log("📝 Simulating: testmessage34, respond okay34");
    
    // Simulate user message
    await sendMessage("user", "testmessage34, respond okay34");
    
    // Wait a moment
    await sleep(500);
    
    // Simulate Claude responding - this should only appear once
    await sendMessage("assistant", "okay34");
    
    // Wait a moment
    await sleep(200);
    
    // Simulate the extension trying to capture the same response again (should be blocked)
    await sendMessage("assistant", "okay34");
    await sendMessage("assistant", "okay34");
    
    console.log("\n📝 Simulating: testmessage35, respond okay35");
    
    await sleep(1000);
    
    // New conversation exchange
    await sendMessage("user", "testmessage35, respond okay35");
    await sleep(500);
    await sendMessage("assistant", "okay35");
    
    console.log("\n✅ Test complete! Check logs - should see:");
    console.log("   - testmessage34, respond okay34 (user)");  
    console.log("   - okay34 (assistant) - ONCE only");
    console.log("   - testmessage35, respond okay35 (user)");
    console.log("   - okay35 (assistant) - ONCE only");
}

async function sendMessage(role, text) {
    try {
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-final-test-${role}-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "final-test",
                role: role,
                text: text,
                urls: [],
                metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: text.length
                }
            })
        });
        
        const status = response.ok ? '✅' : '❌';
        console.log(`${status} ${role}: "${text}"`);
        
    } catch (error) {
        console.error(`❌ Error sending ${role} message:`, error.message);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

finalTest();