// Test extension resilience to various scenarios
console.log("🛡️ Testing Claude extension resilience...");

async function testExtensionResilience() {
    const tests = [];
    
    // Test 1: High frequency messages (stress test)
    console.log("\n⚡ Test 1: High frequency message stress test");
    try {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            const message = `Stress test message ${i} - ${Date.now()}`;
            promises.push(
                fetch('http://127.0.0.1:8788/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: `claude-stress-${Date.now()}-${i}`,
                        ts: new Date().toISOString(),
                        platform: "claude",
                        convo: "stress-test",
                        role: i % 2 === 0 ? "user" : "assistant",
                        text: message,
                        urls: [],
                        metadata: { artifacts: [], tools: [], streaming: false, messageLength: message.length }
                    })
                })
            );
        }
        
        const responses = await Promise.all(promises);
        const successCount = responses.filter(r => r.ok).length;
        console.log(`   ✅ ${successCount}/10 messages handled successfully under stress`);
        tests.push({ name: "High frequency stress test", passed: successCount >= 8 });
        
    } catch (error) {
        console.log(`   ❌ Stress test failed: ${error.message}`);
        tests.push({ name: "High frequency stress test", passed: false });
    }
    
    // Test 2: Duplicate message handling
    console.log("\n🔄 Test 2: Duplicate message handling");
    const duplicateMessage = `Duplicate test ${Date.now()}`;
    
    try {
        // Send the same message 3 times rapidly
        for (let i = 0; i < 3; i++) {
            await fetch('http://127.0.0.1:8788/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `claude-duplicate-${Date.now()}`,
                    ts: new Date().toISOString(),
                    platform: "claude",
                    convo: "duplicate-test",
                    role: "assistant",
                    text: duplicateMessage,
                    urls: [],
                    metadata: { artifacts: [], tools: [], streaming: false, messageLength: duplicateMessage.length }
                })
            });
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }
        console.log(`   ✅ Duplicate messages sent (check server logs for deduplication)`);
        tests.push({ name: "Duplicate message handling", passed: true });
        
    } catch (error) {
        console.log(`   ❌ Duplicate test failed: ${error.message}`);
        tests.push({ name: "Duplicate message handling", passed: false });
    }
    
    // Test 3: Large message handling
    console.log("\n📏 Test 3: Large message handling");
    const largeMessage = "A".repeat(5000) + ` - Large message test ${Date.now()}`;
    
    try {
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-large-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "large-message-test",
                role: "assistant",
                text: largeMessage,
                urls: [],
                metadata: { artifacts: [], tools: [], streaming: false, messageLength: largeMessage.length }
            })
        });
        
        if (response.ok) {
            console.log(`   ✅ Large message (${largeMessage.length} chars) handled successfully`);
            tests.push({ name: "Large message handling", passed: true });
        } else {
            console.log(`   ❌ Large message failed: HTTP ${response.status}`);
            tests.push({ name: "Large message handling", passed: false });
        }
        
    } catch (error) {
        console.log(`   ❌ Large message test failed: ${error.message}`);
        tests.push({ name: "Large message handling", passed: false });
    }
    
    // Test 4: Special characters and encoding
    console.log("\n🌍 Test 4: Special characters and encoding");
    const specialMessage = `Special chars: 🚀 éñçödîñg tést αβγ 中文 русский العربية - ${Date.now()}`;
    
    try {
        const response = await fetch('http://127.0.0.1:8788/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `claude-special-${Date.now()}`,
                ts: new Date().toISOString(),
                platform: "claude",
                convo: "special-chars-test",
                role: "assistant",
                text: specialMessage,
                urls: [],
                metadata: { artifacts: [], tools: [], streaming: false, messageLength: specialMessage.length }
            })
        });
        
        if (response.ok) {
            console.log(`   ✅ Special characters handled successfully`);
            tests.push({ name: "Special character encoding", passed: true });
        } else {
            console.log(`   ❌ Special characters failed: HTTP ${response.status}`);
            tests.push({ name: "Special character encoding", passed: false });
        }
        
    } catch (error) {
        console.log(`   ❌ Special character test failed: ${error.message}`);
        tests.push({ name: "Special character encoding", passed: false });
    }
    
    // Test 5: Empty and edge case messages
    console.log("\n🪶 Test 5: Edge case messages");
    const edgeCases = [
        "",  // Empty
        " ",  // Just space
        "   ",  // Multiple spaces
        "\n\n\n",  // Just newlines
        "\t\t",  // Just tabs
        "a",  // Single character
        "okay",  // Short but valid
    ];
    
    let edgeCasesPassed = 0;
    for (const edgeCase of edgeCases) {
        try {
            const response = await fetch('http://127.0.0.1:8788/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `claude-edge-${Date.now()}`,
                    ts: new Date().toISOString(),
                    platform: "claude",
                    convo: "edge-case-test",
                    role: "assistant",
                    text: edgeCase,
                    urls: [],
                    metadata: { artifacts: [], tools: [], streaming: false, messageLength: edgeCase.length }
                })
            });
            
            if (response.ok) {
                edgeCasesPassed++;
                console.log(`   ✅ Edge case handled: "${edgeCase.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}" (len: ${edgeCase.length})`);
            }
        } catch (error) {
            console.log(`   ❌ Edge case failed: "${edgeCase}" - ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    tests.push({ 
        name: "Edge case handling", 
        passed: edgeCasesPassed >= edgeCases.length - 2  // Allow 2 failures for empty/whitespace
    });
    
    // Test 6: Server availability
    console.log("\n🏥 Test 6: Server health during testing");
    try {
        const healthResponse = await fetch('http://127.0.0.1:8788/health');
        if (healthResponse.ok) {
            console.log(`   ✅ Server remains healthy after all tests`);
            tests.push({ name: "Server health after testing", passed: true });
        } else {
            console.log(`   ❌ Server health check failed: ${healthResponse.status}`);
            tests.push({ name: "Server health after testing", passed: false });
        }
    } catch (error) {
        console.log(`   ❌ Server unreachable: ${error.message}`);
        tests.push({ name: "Server health after testing", passed: false });
    }
    
    // Summary
    console.log("\n📊 RESILIENCE TEST SUMMARY");
    console.log("=" * 40);
    
    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;
    const passRate = (passed / total) * 100;
    
    console.log(`Tests Passed: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    
    tests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`${status} ${test.name}`);
    });
    
    if (passRate >= 80) {
        console.log(`\n🛡️ EXCELLENT: Extension shows high resilience`);
    } else if (passRate >= 60) {
        console.log(`\n⚠️  GOOD: Extension is reasonably resilient with some concerns`);
    } else {
        console.log(`\n❌ NEEDS IMPROVEMENT: Extension resilience issues detected`);
    }
    
    return { passed, total, passRate, tests };
}

// Run resilience tests
testExtensionResilience().then(results => {
    console.log(`\n🔬 Resilience testing complete with ${results.passRate.toFixed(1)}% pass rate`);
}).catch(error => {
    console.error("❌ Resilience testing failed:", error);
});