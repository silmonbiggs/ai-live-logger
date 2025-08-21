// bg.js – runs outside page CSP; performs the localhost POST
console.log("[BG] Background script starting");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[BG] Received message:", msg?.type, "role:", msg?.payload?.role, "text preview:", msg?.payload?.text?.slice(0, 50));
  
  if (msg?.type === "LOG") {
    console.log("[BG] Attempting POST to http://127.0.0.1:8788/log");
    
    fetch("http://127.0.0.1:8788/log", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(msg.payload)
    })
      .then(response => {
        console.log("[BG] Response status:", response.status);
        return response.text();
      })
      .then(text => {
        console.log("[BG] Response text:", text);
        sendResponse({ ok: true, text: text });
      })
      .catch(error => {
        console.error("[BG] Fetch error:", error);
        sendResponse({ ok: false, error: String(error) });
      });
    
    return true; // keep channel open for async response
  }
  
  console.log("[BG] Unknown message type:", msg?.type);
});

console.log("[BG] Background script ready");