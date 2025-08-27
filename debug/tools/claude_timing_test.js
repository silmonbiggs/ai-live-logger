// Claude Timing Test - Run in Claude console to test timing of DOM changes
console.log("🕐 Claude Timing Test Starting...");

// Monitor for new text appearing
let lastTextContent = '';

function checkForNewContent() {
    const bodyText = document.body.innerText;
    if (bodyText !== lastTextContent) {
        console.log("📝 DOM content changed at:", new Date().toISOString());
        
        // Look for the specific test responses
        if (bodyText.includes("Hello! I see your test message") || 
            bodyText.includes("I received your second test message")) {
            console.log("✅ Found test response in DOM!");
            
            // Find the element containing this text
            const allDivs = document.querySelectorAll('div, p, span');
            allDivs.forEach((el, i) => {
                const text = (el.innerText || '').trim();
                if ((text.includes("Hello! I see your test") || text.includes("I received your second test")) && text.length > 30) {
                    console.log(`🎯 Found response element #${i}:`, {
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        textLength: text.length,
                        text: text.substring(0, 100),
                        attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`)
                    });
                }
            });
        }
        
        lastTextContent = bodyText;
    }
}

// Check every 500ms for changes
const interval = setInterval(checkForNewContent, 500);

console.log("⏰ Monitoring for DOM changes... (will run for 30 seconds)");

// Stop after 30 seconds
setTimeout(() => {
    clearInterval(interval);
    console.log("🛑 Timing test complete");
}, 30000);