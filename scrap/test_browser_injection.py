#!/usr/bin/env python3
"""
Test Browser Injection - Verify the actual user input detection works in Claude's UI
"""

import subprocess
import time
import json
import requests
from pathlib import Path
from datetime import datetime

class BrowserTester:
    def __init__(self):
        self.server_dir = Path("C:/dev/chatgpt-live-logger/server")
        self.chat_log = self.server_dir / "chat.log"
        self.verbose_log = self.server_dir / "chatverbose.log" 
        self.server_url = "http://localhost:8788"
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] BROWSER: {message}")
    
    def clear_logs(self):
        """Clear logs for clean testing"""
        for log_file in [self.chat_log, self.verbose_log]:
            if log_file.exists():
                log_file.write_text("")
                self.log(f"Cleared {log_file.name}")
    
    def read_logs(self):
        """Read current log state"""
        logs = {}
        for name, path in [("chat", self.chat_log), ("verbose", self.verbose_log)]:
            if path.exists():
                content = path.read_text().strip()
                logs[name] = content.split('\n') if content else []
            else:
                logs[name] = []
        return logs
    
    def dump_logs(self):
        """Show current log status"""
        logs = self.read_logs()
        self.log("=== CURRENT LOGS ===")
        for name, lines in logs.items():
            self.log(f"{name}.log: {len(lines)} entries")
            for i, line in enumerate(lines[-3:], 1):
                try:
                    data = json.loads(line)
                    role = data.get('role', '?')
                    content = data.get('content', '')[:40]
                    genuine = data.get('metadata', {}).get('signalProcessing', {}).get('isGenuineUserInput', False)
                    detection = data.get('metadata', {}).get('detectionMethod', 'unknown')
                    self.log(f"  {i}. [{role}] {content}... [genuine:{genuine}] [via:{detection}]")
                except:
                    self.log(f"  {i}. {line[:60]}...")
    
    def open_auto_injector(self):
        """Open the auto-injection page in a new Chrome window"""
        html_path = Path("C:/dev/chatgpt-live-logger/debug/auto_inject.html")
        
        if not html_path.exists():
            self.log("Creating auto-injection page...")
            # Run the injector creation
            subprocess.run(["python", "auto_inject.py"], cwd="C:/dev/chatgpt-live-logger")
            time.sleep(2)
        
        # Open the injection page
        chrome_cmd = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "--new-window",
            f"file:///{html_path.as_posix()}"
        ]
        
        subprocess.Popen(chrome_cmd)
        self.log("Opened auto-injection page in Chrome")
        
    def run_interactive_test(self):
        """Run an interactive test with user guidance"""
        self.log("=== INTERACTIVE BROWSER TEST ===")
        
        # Clear logs
        self.clear_logs()
        
        # Open injection page
        self.open_auto_injector()
        
        self.log("")
        self.log("🔧 INSTRUCTIONS:")
        self.log("1. The auto-injection page should have opened in Chrome")
        self.log("2. Navigate to claude.ai in another tab")
        self.log("3. The scripts should auto-inject when the injection page loads")
        self.log("4. In Claude, type a test message like: 'testmessage999, respond okay999'")
        self.log("5. Wait for Claude's response")
        self.log("6. Wait 15+ seconds, then type THE SAME message again")
        self.log("7. Come back here and press Enter to check results")
        self.log("")
        
        # Wait for user
        input("Press Enter when you've completed the test in Claude...")
        
        # Check results
        self.log("")
        self.log("=== CHECKING TEST RESULTS ===")
        
        logs = self.read_logs()
        chat_count = len(logs.get('chat', []))
        verbose_count = len(logs.get('verbose', []))
        
        self.log(f"Chat log entries: {chat_count}")
        self.log(f"Verbose log entries: {verbose_count}")
        
        if chat_count == 0:
            self.log("❌ NO MESSAGES LOGGED - Script injection failed!")
            self.log("Check the auto-injection page for errors")
            return False
        elif chat_count >= 3:  # User, Assistant, User (repeated)
            self.log("✅ SUCCESS! Multiple messages logged - User input detection working!")
            self.dump_logs()
            return True
        else:
            self.log(f"⚠️ Only {chat_count} messages - Partial success")
            self.dump_logs()
            return False
    
    def run_monitoring_session(self):
        """Run continuous monitoring of logs"""
        self.log("=== CONTINUOUS MONITORING ===")
        self.log("Monitoring logs every 5 seconds. Press Ctrl+C to stop.")
        self.log("")
        
        last_count = 0
        
        try:
            while True:
                logs = self.read_logs()
                current_count = len(logs.get('chat', []))
                
                if current_count != last_count:
                    self.log(f"📊 Log change detected: {last_count} -> {current_count} entries")
                    self.dump_logs()
                    last_count = current_count
                    self.log("")
                
                time.sleep(5)
                
        except KeyboardInterrupt:
            self.log("Monitoring stopped by user")

if __name__ == "__main__":
    tester = BrowserTester()
    
    print("\nChoose test mode:")
    print("1. Interactive test (guided)")
    print("2. Continuous monitoring")
    
    choice = input("Enter choice (1 or 2): ").strip()
    
    if choice == "1":
        tester.run_interactive_test()
    elif choice == "2":
        tester.run_monitoring_session()
    else:
        print("Invalid choice")
        tester.run_interactive_test()  # Default to interactive