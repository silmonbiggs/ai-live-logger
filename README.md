# AI Live Logger (Multi-Platform)

Built this to capture AI conversations in real-time from ChatGPT and Claude for my AI project. Works great for my use case - maybe useful for yours too!

⚡ **No API keys required** 📱 **Real-time streaming capture** 🤖 **ChatGPT + Claude Sonnet 4.5** 🛠️ **Enhanced metadata tracking**

*v2.0.0 - Complete Claude Sonnet 4.5 support with sophisticated signal processing!*

> **Note**: This project was recently renamed from `chatgpt-live-logger` to `ai-live-logger` to reflect its multi-platform support. If you're upgrading from the old name, see [GITHUB_RENAME_INSTRUCTIONS.md](GITHUB_RENAME_INSTRUCTIONS.md).

## Quick Start

1. Install extension: Load `extension/` folder in Chrome
2. Run server: `python server/ai-live-logger.py`
3. Chat with ChatGPT or Claude - messages appear in `chat.log` with platform detection

## Requirements

- Chrome browser
- Python 3.7+
- That's it!

## Project Structure

- `/extension/` - Chrome browser extension (Manifest v3)
- `/server/` - Python FastAPI server for logging conversations  
- `/debug/` - Development and debugging tools (see debug/README.md)
  - `/debug/tests/` - Test automation scripts (Selenium WebDriver, etc.)
  - `/debug/tools/` - Utility and debugging scripts
  - `/debug/docs/` - Development documentation  
  - `/debug/experimental/` - Experimental features and prototypes

The core functionality is entirely contained in `/extension/` and `/server/`. The debug directory contains tools used during development that may be helpful for troubleshooting or extending the system.

---

A real-time logging system that captures and stores ChatGPT and Claude AI conversations locally. The system consists of a Chrome extension that monitors both platforms and a local HTTP server that receives and stores the logged data with enhanced metadata.

## Components

### Browser Extension (`extension/`)

Chrome extension (Manifest v3) that monitors ChatGPT and Claude domains and captures conversation data in real-time.

- **manifest.json**: Extension configuration with permissions for ChatGPT, Claude domains and localhost
- **content.js**: Enhanced multi-platform content script that:
  - Automatically detects platform (ChatGPT or Claude)
  - Uses platform-specific selectors for reliable message capture
  - Captures user input using multiple selector strategies for both platforms
  - Monitors DOM mutations to capture assistant responses in real-time
  - Handles streaming message completion detection with platform-specific delays
  - Extracts URLs from messages
  - Detects Claude artifacts and tool usage
  - Implements deduplication and text normalization
  - Sends captured data with enhanced metadata to background script
- **bg.js**: Background service worker that forwards captured messages to local server via POST to `http://127.0.0.1:8788/log`

### Local Server (`server/`)

FastAPI-based HTTP server that receives, processes, and stores logged messages from both platforms.

- **ai-live-logger.py**: Enhanced logging server that:
  - Accepts CORS requests from ChatGPT and Claude domains
  - Receives and processes logged messages with platform detection
  - Implements duplicate detection (5-second window) with platform awareness
  - Processes enhanced metadata including artifacts and tool usage
  - Maintains rolling logs in two files:
    - `chat.log`: Last 100 messages (NDJSON format)
    - `recent.ndjson`: Last 2 messages only
  - Runs on localhost:8788
  - Enhanced logging output shows platform, tools, and artifacts

## Key Features

- **Multi-Platform Support**: Works with both ChatGPT and Claude AI interfaces
- **Real-time Capture**: Monitors both user inputs and AI responses as they happen
- **Streaming Support**: Handles streaming response updates with platform-specific completion detection
- **Enhanced Metadata**: Captures artifacts, tool usage, and platform information
- **URL Extraction**: Automatically extracts and cleans URLs from messages
- **Conversation Tracking**: Tracks conversation IDs from both ChatGPT and Claude URLs
- **Artifact Detection**: Captures Claude's artifact content (code, documents, etc.)
- **Tool Usage Tracking**: Detects when AI models use tools or execute code
- **Duplicate Prevention**: Prevents logging of duplicate messages within a 5-second window
- **Platform-Aware Logging**: Distinguishes between ChatGPT and Claude messages
- **Rolling Logs**: Maintains manageable log files with automatic rotation

## Setup

### 1. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. The extension should now be active on both ChatGPT and Claude domains

### 2. Run the Local Server

1. Install Python dependencies:
   ```bash
   pip install fastapi uvicorn
   ```

2. Start the logging server:
   ```bash
   cd server/
   python ai-live-logger.py
   ```

The server will run on `http://127.0.0.1:8788`

## Usage

1. Start the local server
2. Ensure the Chrome extension is loaded and active
3. Navigate to:
   - ChatGPT (https://chatgpt.com or https://chat.openai.com)
   - Claude (https://claude.ai)
4. Start a conversation - messages will be automatically logged to:
   - `server/chat.log`: Rolling log of last 100 messages
   - `server/recent.ndjson`: Last 2 messages only
5. The platform will be automatically detected and included in the logs

## Log Format

Messages are stored in NDJSON format with enhanced metadata:

```json
{
  "ts": "2024-01-01T12:00:00",
  "platform": "chatgpt|claude",
  "role": "user|assistant",
  "content": "message content",
  "urls": ["https://example.com"],
  "metadata": {
    "artifacts": [
      {
        "type": "artifact",
        "content": "code or document content",
        "language": "python",
        "selector": "[data-testid='artifact']"
      }
    ],
    "tools": ["python", "bash", "code_execution"],
    "streaming": false,
    "messageLength": 150
  }
}
```

## Example Usage

1. Start the server: `python server/ai-live-logger.py`
2. Chat with ChatGPT or Claude
3. Watch messages appear in `chat.log`:

```json
{"ts": "2025-01-21T15:30:45", "platform": "claude", "role": "user", "content": "Write a Python script", "urls": [], "metadata": {"artifacts": [], "tools": [], "streaming": false, "messageLength": 20}}
{"ts": "2025-01-21T15:30:47", "platform": "claude", "role": "assistant", "content": "Here's a Python script...", "urls": [], "metadata": {"artifacts": [{"type": "artifact", "content": "print('Hello World')", "language": "python"}], "tools": ["python"], "streaming": true, "messageLength": 150}}
{"ts": "2025-01-21T15:31:00", "platform": "chatgpt", "role": "user", "content": "What is AI?", "urls": [], "metadata": {"artifacts": [], "tools": [], "streaming": false, "messageLength": 12}}
```

## Technical Details

- **Extension Version**: 2.0.0
- **Server Port**: 8788
- **Log Rotation**: 100 messages for main log, 2 for recent
- **Duplicate Window**: 5 seconds (platform-aware)
- **Supported Domains**: chatgpt.com, chat.openai.com, claude.ai
- **Platform Detection**: Automatic based on domain
- **Streaming Delays**: ChatGPT: 2.5s, Claude: 3.0s
- **Enhanced Features**: Artifact capture, tool detection, metadata tracking

## License

MIT License - see LICENSE file for details.