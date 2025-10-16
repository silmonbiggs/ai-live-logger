# ChurnRoom Integration Plan

## Overview
Integrate the newly renamed `ai-live-logger` into the ChurnRoom video mashup project to capture LLM "PLAY" commands and convert them to VLC playback.

## Current State

### ai-live-logger (C:/dev/chatgpt-live-logger → C:/dev/ai-live-logger)
- **Status**: ✅ Production ready
- **Features**: Captures ChatGPT + Claude conversations in real-time
- **Output**: NDJSON format in `server/chat.log` and `server/recent.ndjson`
- **Server**: `python server/ai-live-logger.py` on localhost:8788

### ChurnRoom (C:/churnroom)
- **Status**: Video mashup system with VLC/Qt player integration
- **Redundant code**: Contains old `http_logger.py` + `chatgpt-logger-ext/` (2 months out of date)
- **Purpose**: Watches for LLM "PLAY: <url>" commands and triggers VLC playback

## Integration Strategy: Git Submodule Approach (Recommended)

### Why Submodules?
✅ **Single source of truth**: No duplicate code
✅ **Automatic updates**: ChurnRoom gets latest ai-live-logger improvements
✅ **Clean separation**: Two independent, focused repositories
✅ **Easy maintenance**: Update logger without touching ChurnRoom

### Directory Structure After Integration

```
C:/dev/
├── ai-live-logger/                    # Standalone logging library
│   ├── .git/
│   ├── extension/                     # Chrome extension
│   │   ├── platforms/
│   │   │   ├── claude_handler.js
│   │   │   └── chatgpt_handler.js
│   │   └── ...
│   ├── server/
│   │   ├── ai-live-logger.py          # FastAPI server
│   │   ├── chat.log                   # Output logs (NDJSON)
│   │   └── recent.ndjson              # Last 2 messages
│   └── README.md
│
└── churnroom/                         # Main application
    ├── .git/
    ├── ai_logger/                     # Git submodule → ai-live-logger
    │   ├── server/
    │   │   ├── ai-live-logger.py
    │   │   ├── chat.log
    │   │   └── recent.ndjson
    │   └── extension/
    ├── churn_room.py                  # Main app - watches ai_logger/server/chat.log
    ├── qt_vlc_player.py               # VLC integration
    ├── .gitmodules                    # Submodule configuration
    └── README.md
```

## Step-by-Step Integration

### Phase 1: Clean Up ChurnRoom Repository

```bash
cd C:/churnroom

# Remove redundant logger code (2 months old, replaced by ai-live-logger)
git rm -r chatgpt-logger-ext/
git rm http_logger.py

# Commit cleanup
git commit -m "Remove redundant logging code (replaced by ai-live-logger submodule)"
git push
```

### Phase 2: Add ai-live-logger as Submodule

```bash
cd C:/churnroom

# Add ai-live-logger as git submodule
git submodule add https://github.com/silmonbiggs/ai-live-logger.git ai_logger

# Initialize and update submodule
git submodule update --init --recursive

# Commit submodule addition
git commit -m "Add ai-live-logger as submodule for LLM command capture"
git push
```

### Phase 3: Update ChurnRoom to Use Shared Logger

#### Option A: Run Separate Logger Server (Recommended)
Keep the ai-live-logger server running independently:

```bash
# Terminal 1: Run ai-live-logger server
cd C:/dev/ai-live-logger/server
python ai-live-logger.py

# Terminal 2: Run ChurnRoom (watches logger output)
cd C:/churnroom
python churn_room.py
```

**ChurnRoom Integration Code:**
```python
# In churn_room.py
from pathlib import Path
import json
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Point to ai_logger submodule output
LOGGER_OUTPUT = Path(__file__).parent / "ai_logger" / "server" / "chat.log"
# Or for real-time: Path(__file__).parent / "ai_logger" / "server" / "recent.ndjson"

class LLMCommandWatcher(FileSystemEventHandler):
    """Watch ai-live-logger output for PLAY commands."""

    def on_modified(self, event):
        if event.src_path.endswith('chat.log'):
            self.process_new_commands()

    def process_new_commands(self):
        """Parse NDJSON log for PLAY commands."""
        try:
            with open(LOGGER_OUTPUT) as f:
                for line in f:
                    msg = json.loads(line)
                    if msg['role'] == 'assistant':
                        # Look for PLAY commands in LLM response
                        if 'PLAY:' in msg['content']:
                            self.extract_and_play(msg['content'])
        except Exception as e:
            print(f"Error processing commands: {e}")

    def extract_and_play(self, content):
        """Extract PLAY: <url> and trigger VLC."""
        import re
        matches = re.findall(r'PLAY:\s*(https?://[^\s]+)', content)
        for url in matches:
            print(f"[ChurnRoom] Executing PLAY command: {url}")
            # Your existing VLC integration code here
            self.play_in_vlc(url)
```

#### Option B: Import Logger Library (Alternative)
Use ai-live-logger as a Python library:

```python
# In churn_room.py
import sys
from pathlib import Path

# Add ai_logger to Python path
sys.path.insert(0, str(Path(__file__).parent / "ai_logger" / "server"))

# Now you could import/reuse logger code if needed
# But Option A (separate server) is cleaner
```

### Phase 4: Test Integration

```bash
# Terminal 1: Start ai-live-logger
cd C:/dev/ai-live-logger/server
python ai-live-logger.py

# Terminal 2: Start ChurnRoom
cd C:/churnroom
python churn_room.py

# Terminal 3/Browser: Test with ChatGPT or Claude
# Type: "PLAY: https://archive.org/download/ElephantsDream/ed_hd.mp4"
# Expected: ChurnRoom detects command and launches VLC
```

## Workflow After Integration

1. **User chats with Claude/ChatGPT**
2. **Chrome extension** captures conversation → sends to ai-live-logger server
3. **ai-live-logger** writes to `chat.log` (NDJSON format)
4. **ChurnRoom** watches `chat.log` for changes
5. **ChurnRoom** detects `PLAY:` commands in assistant responses
6. **ChurnRoom** extracts URLs and triggers VLC/Qt player

## Benefits of This Approach

✅ **Separation of concerns**: Logger does logging, ChurnRoom does playback
✅ **Independent development**: Update either project without affecting the other
✅ **Reusability**: ai-live-logger can be used in other projects
✅ **Git submodule**: ChurnRoom always uses latest logger code
✅ **Clean architecture**: Single source of truth for all LLM conversation logging

## Future Updates

When ai-live-logger is updated:

```bash
cd C:/churnroom

# Update ai_logger submodule to latest
git submodule update --remote ai_logger

# Commit the submodule update
git add ai_logger
git commit -m "Update ai-live-logger submodule to latest version"
git push
```

## Troubleshooting

### Submodule Not Cloning?
```bash
cd C:/churnroom
git submodule update --init --recursive
```

### Submodule Out of Date?
```bash
cd C:/churnroom/ai_logger
git pull origin main
cd ..
git add ai_logger
git commit -m "Update ai_logger submodule"
```

### Want to Run Logger Locally?
```bash
# Just cd into submodule and use it like normal
cd C:/churnroom/ai_logger/server
python ai-live-logger.py
```

---

**Status**: Ready to integrate after GitHub rename is complete
**Next Steps**:
1. Complete ai-live-logger GitHub rename and push
2. Execute Phase 1-4 of this integration plan
3. Test LLM → ChurnRoom → VLC workflow
