// Log analysis script to verify filtering effectiveness
const fs = require('fs');
const path = require('path');

console.log("📊 Analyzing Claude extension logging effectiveness...");

function analyzeLogs() {
    const chatLogPath = path.join(__dirname, 'server', 'chat.log');
    const verboseLogPath = path.join(__dirname, 'server', 'chatverbose.log');
    
    let chatLogEntries = [];
    let verboseLogEntries = [];
    
    try {
        // Read chat.log (filtered)
        if (fs.existsSync(chatLogPath)) {
            const chatLogContent = fs.readFileSync(chatLogPath, 'utf8');
            chatLogEntries = chatLogContent.trim().split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        }
        
        // Read chatverbose.log (unfiltered)
        if (fs.existsSync(verboseLogPath)) {
            const verboseLogContent = fs.readFileSync(verboseLogPath, 'utf8');
            verboseLogEntries = verboseLogContent.trim().split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        }
        
        console.log(`\n📄 Log file analysis:`);
        console.log(`- chat.log (filtered): ${chatLogEntries.length} entries`);
        console.log(`- chatverbose.log (unfiltered): ${verboseLogEntries.length} entries`);
        console.log(`- Filtering efficiency: ${verboseLogEntries.length - chatLogEntries.length} entries filtered out`);
        
        // Analyze content types in chat.log
        console.log(`\n🔍 Content analysis of chat.log (clean conversation):`);
        
        const contentTypes = {
            userMessages: 0,
            assistantResponses: 0,
            systemMessages: 0,
            testMessages: 0,
            legitimateContent: 0
        };
        
        const recentEntries = chatLogEntries.slice(-20); // Last 20 entries
        
        console.log(`\nLast 20 entries in chat.log:`);
        recentEntries.forEach((entry, i) => {
            const content = entry.content.slice(0, 60) + (entry.content.length > 60 ? '...' : '');
            console.log(`${String(i + 1).padStart(2, '0')}. [${entry.role}] ${content}`);
            
            // Categorize
            if (entry.role === 'user') {
                contentTypes.userMessages++;
                if (entry.content.includes('testmessage') || entry.content.includes('VERIFICATION_TEST')) {
                    contentTypes.testMessages++;
                }
            } else if (entry.role === 'assistant') {
                contentTypes.assistantResponses++;
                if (entry.content.match(/^okay\d+$/)) {
                    contentTypes.testMessages++;
                } else if (!entry.content.includes('Extension loaded')) {
                    contentTypes.legitimateContent++;
                }
            } else if (entry.role === 'system') {
                contentTypes.systemMessages++;
            }
        });
        
        console.log(`\n📈 Content type breakdown (last 20 entries):`);
        console.log(`- User messages: ${contentTypes.userMessages}`);
        console.log(`- Assistant responses: ${contentTypes.assistantResponses}`);  
        console.log(`- System messages: ${contentTypes.systemMessages}`);
        console.log(`- Test messages: ${contentTypes.testMessages}`);
        console.log(`- Legitimate content: ${contentTypes.legitimateContent}`);
        
        // Check for UI noise in chat.log
        console.log(`\n🧹 Checking for UI noise in chat.log:`);
        const uiNoisePatterns = [
            'All chats',
            'retry',
            'share',
            'Claude can make mistakes',
            'Research Sonnet 4',
            '@keyframes',
            'test message confirmation'
        ];
        
        let noiseCount = 0;
        chatLogEntries.forEach(entry => {
            uiNoisePatterns.forEach(pattern => {
                if (entry.content.toLowerCase().includes(pattern.toLowerCase())) {
                    noiseCount++;
                    console.log(`   ⚠️  Found potential UI noise: "${entry.content.slice(0, 50)}..."`);
                }
            });
        });
        
        if (noiseCount === 0) {
            console.log(`   ✅ No UI noise detected in chat.log`);
        } else {
            console.log(`   ❌ Found ${noiseCount} potential UI noise entries`);
        }
        
        // Check verbose log for filtered content
        console.log(`\n🗑️  Checking filtered content in chatverbose.log:`);
        const filteredContent = verboseLogEntries.filter(entry => {
            return !chatLogEntries.some(chatEntry => 
                chatEntry.content === entry.content && 
                Math.abs(new Date(chatEntry.ts) - new Date(entry.ts)) < 1000
            );
        });
        
        console.log(`Found ${filteredContent.length} entries that were filtered out:`);
        filteredContent.slice(-10).forEach(entry => {
            const content = entry.content.slice(0, 40) + (entry.content.length > 40 ? '...' : '');
            console.log(`   [${entry.role}] ${content}`);
        });
        
        // Success metrics
        console.log(`\n✅ SUCCESS METRICS:`);
        const userToAssistantRatio = contentTypes.userMessages / Math.max(contentTypes.assistantResponses, 1);
        const filteringRate = ((verboseLogEntries.length - chatLogEntries.length) / verboseLogEntries.length) * 100;
        
        console.log(`- User/Assistant message balance: ${userToAssistantRatio.toFixed(2)} (ideal: ~1.0)`);
        console.log(`- Filtering rate: ${filteringRate.toFixed(1)}% of entries filtered as UI noise`);
        console.log(`- UI noise in chat.log: ${noiseCount} entries (ideal: 0)`);
        console.log(`- Test message handling: ${contentTypes.testMessages} test messages properly logged`);
        
        const overallScore = (noiseCount === 0 ? 25 : 0) + 
                           (userToAssistantRatio > 0.5 && userToAssistantRatio < 2.0 ? 25 : 0) +
                           (filteringRate > 10 ? 25 : 0) +
                           (contentTypes.testMessages > 0 ? 25 : 0);
        
        console.log(`\n🎯 OVERALL EFFECTIVENESS SCORE: ${overallScore}/100`);
        
        if (overallScore >= 75) {
            console.log(`   ✅ EXCELLENT: Claude logging is working as intended`);
        } else if (overallScore >= 50) {
            console.log(`   ⚠️  GOOD: Some improvements needed`);
        } else {
            console.log(`   ❌ NEEDS WORK: Significant issues detected`);
        }
        
        return {
            chatLogEntries: chatLogEntries.length,
            verboseLogEntries: verboseLogEntries.length,
            filteredEntries: filteredContent.length,
            uiNoiseCount: noiseCount,
            effectivenessScore: overallScore,
            contentTypes
        };
        
    } catch (error) {
        console.error('❌ Error analyzing logs:', error);
        return null;
    }
}

// Run the analysis
const results = analyzeLogs();
if (results) {
    console.log(`\n💾 Analysis complete. Check server logs for real-time filtering behavior.`);
}