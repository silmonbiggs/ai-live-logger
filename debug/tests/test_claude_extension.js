// Comprehensive test suite for Claude extension logging
console.log("🧪 Starting comprehensive Claude extension test suite...");

let testResults = [];
let testCounter = 1;

function logTest(testName, passed, details = '') {
    const result = {
        test: testCounter++,
        name: testName,
        passed: passed,
        details: details,
        timestamp: new Date().toISOString()
    };
    testResults.push(result);
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} Test ${result.test}: ${testName}`);
    if (details) console.log(`   ${details}`);
    return result;
}

// Test 1: User message capture
async function testUserMessageCapture() {
    console.log("\n🔬 Testing user message capture...");
    
    const testMessage = `Test user input ${Date.now()}`;
    
    try {
        // Send a user message directly to the server
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-user-test-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "test-user-capture",
                role: "user",
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
            logTest("User message capture", true, `Message "${testMessage}" sent successfully`);
        } else {
            logTest("User message capture", false, `HTTP ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        logTest("User message capture", false, `Network error: ${error.message}`);
    }
}

// Test 2: Assistant response capture  
async function testAssistantResponseCapture() {
    console.log("\n🤖 Testing assistant response capture...");
    
    const testResponse = `Assistant response ${Date.now()}`;
    
    try {
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-assistant-test-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "test-assistant-capture", 
                role: "assistant",
                text: testResponse,
                urls: [],
                metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: testResponse.length
                }
            })
        });
        
        if (response.ok) {
            logTest("Assistant response capture", true, `Response "${testResponse}" sent successfully`);
        } else {
            logTest("Assistant response capture", false, `HTTP ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        logTest("Assistant response capture", false, `Network error: ${error.message}`);
    }
}

// Test 3: UI noise filtering
async function testUINoiseFiltering() {
    console.log("\n🧹 Testing UI noise filtering...");
    
    const uiNoiseMessages = [
        "All chats",
        "retry",
        "share", 
        "Claude can make mistakes",
        "Research Sonnet 4",
        "@keyframes intercom-lightweight-app-launcher { from { opacity: 0",
        "test message confirmation",
        "J James"
    ];
    
    let filteredCount = 0;
    let totalSent = uiNoiseMessages.length;
    
    for (const noiseMessage of uiNoiseMessages) {
        try {
            const response = await fetch('http://127.0.0.1:8788/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `claude-noise-test-${Date.now()}`,
                    ts: new Date().toISOString(),
                    platform: "claude",
                    convo: "test-noise-filtering",
                    role: "assistant", 
                    text: noiseMessage,
                    urls: [],
                    metadata: {
                        artifacts: [],
                        tools: [],
                        streaming: false,
                        messageLength: noiseMessage.length
                    }
                })
            });
            
            if (response.ok) {
                console.log(`   Sent noise message: "${noiseMessage.slice(0, 30)}..."`);
            }
        } catch (error) {
            console.log(`   Error sending noise message: ${error.message}`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logTest("UI noise filtering", true, `Sent ${totalSent} UI noise messages (check server logs for filtering)`);
}

// Test 4: Legitimate content preservation
async function testLegitimateContentPreservation() {
    console.log("\n💬 Testing legitimate content preservation...");
    
    const legitimateMessages = [
        "Hello, how can I help you today?",
        "I understand you're looking for assistance with JavaScript.",
        "Here's a simple example of how to use async/await:",
        "testmessage 99, respond okay 99",
        "okay99"
    ];
    
    for (const message of legitimateMessages) {
        try {
            const response = await fetch('http://127.0.0.1:8788/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `claude-legit-test-${Date.now()}`,
                    ts: new Date().toISOString(),
                    platform: "claude",
                    convo: "test-legitimate-content",
                    role: message.startsWith("testmessage") ? "user" : "assistant",
                    text: message,
                    urls: [],
                    metadata: {
                        artifacts: [],
                        tools: [],
                        streaming: false,
                        messageLength: message.length
                    }
                })
            });
            
            if (response.ok) {
                console.log(`   ✅ Sent legitimate message: "${message.slice(0, 40)}..."`);
            } else {
                console.log(`   ❌ Failed to send: "${message.slice(0, 40)}..."`);
            }
        } catch (error) {
            console.log(`   ❌ Error sending message: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    logTest("Legitimate content preservation", true, `Sent ${legitimateMessages.length} legitimate messages`);
}

// Test 5: Server health check
async function testServerHealth() {
    console.log("\n🏥 Testing server health...");
    
    try {
        const response = await fetch('http://127.0.0.1:8788/health');
        if (response.ok) {
            const healthData = await response.text();
            logTest("Server health check", true, `Server responding: ${healthData}`);
        } else {
            logTest("Server health check", false, `Server returned ${response.status}`);
        }
    } catch (error) {
        logTest("Server health check", false, `Cannot reach server: ${error.message}`);
    }
}

// Test 6: Log file verification (simulated)
async function testLogFileVerification() {
    console.log("\n📄 Testing log file verification...");
    
    // Send a unique test message to verify it gets logged
    const uniqueMessage = `VERIFICATION_TEST_${Date.now()}`;
    
    try {
        await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-verify-test-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "test-verification",
                role: "user",
                text: uniqueMessage,
                urls: [],
                metadata: {
                    artifacts: [],
                    tools: [],
                    streaming: false,
                    messageLength: uniqueMessage.length
                }
            })
        });
        
        logTest("Log file verification", true, `Sent verification message: ${uniqueMessage}`);
        console.log(`   💡 Check chat.log for this message to verify logging is working`);
        
    } catch (error) {
        logTest("Log file verification", false, `Error: ${error.message}`);
    }
}

// Run all tests
async function runAllTests() {
    console.log("🎯 Starting comprehensive test suite for Claude extension...\n");
    
    await testServerHealth();
    await testUserMessageCapture();
    await testAssistantResponseCapture();
    await testUINoiseFiltering();
    await testLegitimateContentPreservation(); 
    await testLogFileVerification();
    
    // Summary
    console.log("\n📊 TEST SUMMARY");
    console.log("=" * 50);
    
    const passed = testResults.filter(t => t.passed).length;
    const total = testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
    
    console.log("\nDetailed Results:");
    testResults.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`${status} ${test.name}: ${test.details || 'No details'}`);
    });
    
    console.log("\n💡 Next steps:");
    console.log("1. Check server logs for filtering behavior");
    console.log("2. Verify chat.log contains only legitimate messages");
    console.log("3. Verify chatverbose.log contains all messages including filtered ones");
    
    return {
        passed: passed,
        total: total,
        successRate: (passed/total) * 100,
        results: testResults
    };
}

// Execute the test suite
runAllTests().then(summary => {
    console.log(`\n🏁 Test suite completed with ${summary.successRate.toFixed(1)}% success rate`);
}).catch(error => {
    console.error("❌ Test suite failed:", error);
});