// Run this in Claude console to find the correct assistant message selectors
console.log("🔍 Finding Claude assistant message selectors...");

// Look for the visible assistant message
const visibleMessages = [];
const allDivs = document.querySelectorAll('div');

allDivs.forEach((div, i) => {
    const text = (div.innerText || div.textContent || '').trim();
    
    // Look for Claude's response text
    if (text.includes("Got it! I see you're doing a quick test") || 
        text.includes("This kind of rapid testing is smart") ||
        text.length > 100) {
        
        visibleMessages.push({
            index: i,
            element: div,
            text: text.slice(0, 200) + "...",
            className: div.className,
            id: div.id,
            dataset: Object.keys(div.dataset),
            attributes: Array.from(div.attributes).map(attr => `${attr.name}="${attr.value}"`),
            parent: div.parentElement ? {
                tagName: div.parentElement.tagName,
                className: div.parentElement.className,
                dataset: Object.keys(div.parentElement.dataset)
            } : null
        });
    }
});

console.log("📄 Found potential assistant messages:", visibleMessages.length);
visibleMessages.forEach((msg, i) => {
    console.log(`\nMessage ${i+1}:`);
    console.log("Text:", msg.text);
    console.log("Classes:", msg.className);
    console.log("ID:", msg.id);
    console.log("Dataset keys:", msg.dataset);
    console.log("All attributes:", msg.attributes);
    if (msg.parent) {
        console.log("Parent:", msg.parent);
    }
});

// Test our current selectors
const currentSelectors = [
    '[data-role="assistant"]',
    '[data-message-role="assistant"]', 
    '.message-assistant',
    '[data-testid*="assistant"]',
    '[data-testid*="message"]'
];

console.log("\n🧪 Testing current selectors:");
currentSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`"${selector}" → ${elements.length} elements`);
});

console.log("\n✅ Analysis complete!");