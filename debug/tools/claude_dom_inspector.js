// Enhanced Claude DOM Inspector - Run in Claude console to find current selectors
console.log("🔍 Enhanced Claude DOM Inspector Starting...");

// Find the specific assistant message elements
function findAssistantMessages() {
    const responses = [
        "Hello! I see your test message",
        "I received your second test message"
    ];
    
    const foundElements = [];
    
    responses.forEach(response => {
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(el => {
            const text = (el.innerText || el.textContent || '').trim();
            if (text.includes(response.substring(0, 20))) {
                foundElements.push({
                    element: el,
                    text: text.substring(0, 100),
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    datasets: Object.keys(el.dataset),
                    attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`),
                    parentInfo: {
                        tagName: el.parentElement?.tagName,
                        className: el.parentElement?.className,
                        datasets: el.parentElement ? Object.keys(el.parentElement.dataset) : []
                    }
                });
            }
        });
    });
    
    return foundElements;
}

const assistantElements = findAssistantMessages();
console.log("🤖 Found assistant message elements:", assistantElements.length);

assistantElements.forEach((info, i) => {
    console.log(`\nAssistant Element ${i + 1}:`);
    console.log("Tag:", info.tagName);
    console.log("Text:", info.text);
    console.log("Classes:", info.className);
    console.log("ID:", info.id);
    console.log("Datasets:", info.datasets);
    console.log("Attributes:", info.attributes);
    console.log("Parent:", info.parentInfo);
});

// Test current selectors
const currentSelectors = [
    '[data-role="assistant"]',
    '[data-message-role="assistant"]',
    '.message-assistant',
    '[data-testid*="assistant"]',
    '[data-testid*="message"]',
    'div[data-testid^="message"]',
    'div[role="article"]',
    'div[class*="prose"]',
    'div[class*="markdown"]'
];

console.log("\n🧪 Testing current selectors:");
currentSelectors.forEach(selector => {
    try {
        const elements = document.querySelectorAll(selector);
        console.log(`"${selector}" → ${elements.length} elements`);
        
        if (elements.length > 0) {
            elements.forEach((el, i) => {
                const text = (el.innerText || el.textContent || '').trim();
                if (text.length > 20) {
                    console.log(`  Element ${i}: "${text.substring(0, 50)}..."`);
                }
            });
        }
    } catch (e) {
        console.log(`"${selector}" → ERROR: ${e.message}`);
    }
});

console.log("\n✅ Inspection complete!");