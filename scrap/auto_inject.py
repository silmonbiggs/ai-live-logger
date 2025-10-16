#!/usr/bin/env python3
"""
Auto Script Injector for ChatGPT Live Logger
Automatically injects the enhanced user detection and signal processing scripts
"""

import subprocess
import time
import json
from pathlib import Path
from datetime import datetime
import requests

class ScriptInjector:
    def __init__(self):
        self.root_dir = Path("C:/dev/chatgpt-live-logger")
        self.enhanced_script = self.root_dir / "enhanced_user_detection_logger.js"
        self.signal_script = self.root_dir / "updated_signal_logger.js" 
        self.debug_dir = self.root_dir / "debug"
        self.debug_dir.mkdir(exist_ok=True)
        
    def log(self, message):
        """Debug logging with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] INJECT: {message}")
        
    def create_injection_html(self):
        """Create HTML file that auto-injects our scripts"""
        
        # Read the script contents
        enhanced_content = ""
        signal_content = ""
        
        if self.enhanced_script.exists():
            enhanced_content = self.enhanced_script.read_text(encoding='utf-8')
            self.log(f"Loaded enhanced script: {len(enhanced_content)} chars")
        else:
            self.log(f"❌ Enhanced script not found: {self.enhanced_script}")
            
        if self.signal_script.exists():
            signal_content = self.signal_script.read_text(encoding='utf-8')
            self.log(f"Loaded signal script: {len(signal_content)} chars")
        else:
            self.log(f"❌ Signal script not found: {self.signal_script}")
            
        # Create HTML with auto-injection
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>ChatGPT Live Logger - Auto Injector</title>
    <style>
        body {{ font-family: monospace; padding: 20px; background: #1a1a1a; color: #00ff00; }}
        .status {{ margin: 10px 0; padding: 10px; border: 1px solid #333; background: #222; }}
        .success {{ border-color: #00aa00; }}
        .error {{ border-color: #aa0000; color: #ff0000; }}
        .script-content {{ font-size: 10px; max-height: 200px; overflow-y: auto; background: #333; padding: 10px; }}
        .controls {{ margin: 20px 0; }}
        button {{ padding: 10px 20px; margin: 5px; background: #333; color: #00ff00; border: 1px solid #666; cursor: pointer; }}
        button:hover {{ background: #444; }}
    </style>
</head>
<body>
    <h1>🤖 ChatGPT Live Logger - Auto Injector</h1>
    <p>This page will automatically inject the detection scripts when loaded.</p>
    
    <div class="controls">
        <button onclick="injectScripts()">🔄 Re-inject Scripts</button>
        <button onclick="testConnection()">🔗 Test Server</button>
        <button onclick="clearLogs()">🗑️ Clear Logs</button>
        <button onclick="checkStats()">📊 Check Stats</button>
    </div>
    
    <div id="status" class="status">
        <div>Status: Initializing...</div>
    </div>
    
    <div class="status">
        <div>Enhanced Script: {len(enhanced_content)} characters</div>
        <div class="script-content">{enhanced_content[:500] if enhanced_content else 'NOT LOADED'}...</div>
    </div>
    
    <div class="status">
        <div>Signal Script: {len(signal_content)} characters</div>
        <div class="script-content">{signal_content[:500] if signal_content else 'NOT LOADED'}...</div>
    </div>

    <script>
        const status = document.getElementById('status');
        
        function log(message) {{
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${{timestamp}}] ${{message}}`);
            status.innerHTML += `<div>[${{timestamp}}] ${{message}}</div>`;
            status.scrollTop = status.scrollHeight;
        }}
        
        function testConnection() {{
            log('Testing server connection...');
            fetch('http://localhost:8788/health')
                .then(response => {{
                    if (response.ok) {{
                        log('✅ Server connection successful');
                    }} else {{
                        log('❌ Server responded with error: ' + response.status);
                    }}
                }})
                .catch(error => {{
                    log('❌ Server connection failed: ' + error.message);
                }});
        }}
        
        function clearLogs() {{
            log('Clearing server logs...');
            // This would need server endpoint to clear logs
            log('⚠️ Log clearing not implemented yet');
        }}
        
        function checkStats() {{
            log('Checking detection statistics...');
            
            if (window.enhancedUserDetection) {{
                const stats = window.enhancedUserDetection.getStats();
                log('📊 Enhanced Detection Stats: ' + JSON.stringify(stats));
            }} else {{
                log('❌ Enhanced user detection not active');
            }}
            
            if (window.signalProcessingLogger) {{
                const stats = window.signalProcessingLogger.getStats();
                log('📊 Signal Processing Stats: ' + JSON.stringify(stats));
            }} else {{
                log('❌ Signal processing logger not active');
            }}
            
            if (window.genuineUserInputs) {{
                log('📊 Genuine Inputs Marked: ' + window.genuineUserInputs.size);
            }} else {{
                log('❌ No genuine user inputs marked');
            }}
        }}
        
        function injectScripts() {{
            log('🚀 Starting script injection...');
            
            // Inject enhanced user detection script
            try {{
                log('Injecting enhanced user detection script...');
                const enhancedScript = `{enhanced_content.replace('`', '\\`').replace('${', '\\${') if enhanced_content else ''}`;
                
                if (enhancedScript.length > 100) {{
                    eval(enhancedScript);
                    log('✅ Enhanced user detection script injected');
                }} else {{
                    log('❌ Enhanced script is too short or empty');
                }}
            }} catch (error) {{
                log('❌ Enhanced script injection failed: ' + error.message);
            }}
            
            // Small delay between scripts
            setTimeout(() => {{
                try {{
                    log('Injecting signal processing script...');
                    const signalScript = `{signal_content.replace('`', '\\`').replace('${', '\\${') if signal_content else ''}`;
                    
                    if (signalScript.length > 100) {{
                        eval(signalScript);
                        log('✅ Signal processing script injected');
                    }} else {{
                        log('❌ Signal script is too short or empty');
                    }}
                }} catch (error) {{
                    log('❌ Signal script injection failed: ' + error.message);
                }}
                
                // Test connection after injection
                setTimeout(testConnection, 1000);
                
                // Check stats after injection
                setTimeout(checkStats, 2000);
                
            }}, 500);
        }}
        
        // Auto-inject on page load
        window.addEventListener('load', () => {{
            log('🔄 Page loaded, auto-injecting scripts...');
            testConnection();
            setTimeout(injectScripts, 1000);
        }});
        
        // Also inject immediately
        log('🔄 Immediate injection starting...');
        injectScripts();
    </script>
</body>
</html>"""
        
        # Save HTML file
        html_path = self.debug_dir / "auto_inject.html"
        html_path.write_text(html_content, encoding='utf-8')
        self.log(f"Created injection HTML: {html_path}")
        
        return html_path
        
    def open_injection_page(self):
        """Open the injection page in Chrome"""
        html_path = self.create_injection_html()
        
        # Launch Chrome with the injection page
        chrome_cmd = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "--new-window",
            f"file:///{html_path.as_posix()}"
        ]
        
        try:
            subprocess.Popen(chrome_cmd)
            self.log(f"Opened injection page in Chrome")
            return True
        except Exception as e:
            self.log(f"Failed to open Chrome: {e}")
            return False

if __name__ == "__main__":
    injector = ScriptInjector()
    injector.open_injection_page()