#!/usr/bin/env python3
"""
Simple Log Monitor - Check if scripts are working
"""

import time
import json
from pathlib import Path
from datetime import datetime

class SimpleMonitor:
    def __init__(self):
        self.server_dir = Path("C:/dev/chatgpt-live-logger/server")
        self.chat_log = self.server_dir / "chat.log"
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
    
    def read_chat_log(self):
        if self.chat_log.exists():
            content = self.chat_log.read_text().strip()
            return content.split('\n') if content else []
        return []
    
    def monitor(self):
        self.log("Starting simple log monitor...")
        self.log("Monitoring chat.log for new entries...")
        self.log("Press Ctrl+C to stop")
        self.log("")
        
        last_count = 0
        
        try:
            while True:
                lines = self.read_chat_log()
                current_count = len(lines)
                
                if current_count != last_count:
                    self.log(f"LOG CHANGE: {last_count} -> {current_count} entries")
                    
                    # Show recent entries
                    for line in lines[-3:]:
                        try:
                            data = json.loads(line)
                            role = data.get('role', '?')
                            content = data.get('content', '')[:50]
                            
                            # Check for genuine input detection
                            metadata = data.get('metadata', {})
                            detection = metadata.get('detectionMethod', 'unknown')
                            signal_processing = metadata.get('signalProcessing', {})
                            is_genuine = signal_processing.get('isGenuineUserInput', False)
                            
                            self.log(f"  [{role}] {content}...")
                            if is_genuine:
                                self.log(f"    -> GENUINE INPUT via {detection}")
                            elif detection != 'unknown':
                                self.log(f"    -> via {detection}")
                        except:
                            self.log(f"  {line[:60]}...")
                    
                    last_count = current_count
                    self.log("")
                
                time.sleep(3)  # Check every 3 seconds
                
        except KeyboardInterrupt:
            self.log("Monitoring stopped")
            
            # Final summary
            final_lines = self.read_chat_log()
            self.log(f"Final count: {len(final_lines)} entries")
            
            if len(final_lines) > 0:
                self.log("FINAL ANALYSIS:")
                for i, line in enumerate(final_lines, 1):
                    try:
                        data = json.loads(line)
                        role = data.get('role')
                        content = data.get('content', '')[:30]
                        self.log(f"  {i}. [{role}] {content}...")
                    except:
                        self.log(f"  {i}. Invalid JSON")
            else:
                self.log("NO MESSAGES LOGGED - Scripts not working!")

if __name__ == "__main__":
    monitor = SimpleMonitor()
    monitor.monitor()