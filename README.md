# ChatGPT Live Logger (Proof of Concept)

Built this to capture ChatGPT conversations in real-time for my AI project. Works great for my use case - maybe useful for yours too!

⚡ **No ChatGPT API required** 📱 **Real-time streaming capture** 🛠️ **Rough but functional**

*Early stage but solving a real problem. Feedback welcome!*

## Quick Start

1. Install extension: Load `extension/` folder in Chrome
2. Run server: `python server/chatgpt-live-logger.py`
3. Chat with ChatGPT - messages appear in `chat.log`

## Requirements

- Chrome browser
- Python 3.7+
- That's it!

---

A real-time logging system that captures and stores ChatGPT conversations locally. The system consists of a Chrome extension that monitors ChatGPT conversations and a local HTTP server that receives and stores the logged data.

## Components

### Browser Extension (`extension/`)

Chrome extension (Manifest v3) that monitors ChatGPT domains and captures conversation data in real-time.

- **manifest.json**: Extension configuration with permissions for ChatGPT domains and localhost
- **content.js**: Sophisticated content script (524 lines) that:
  - Captures user input from ChatGPT's interface using multiple selector strategies
  - Monitors DOM mutations to capture assistant responses in real-time
  - Handles streaming message completion detection
  - Extracts URLs from messages
  - Implements deduplication and text normalization
  - Sends captured data to background script
- **bg.js**: Background service worker that forwards captured messages to local server via POST to `http://127.0.0.1:8788/log`

### Local Server (`server/`)

FastAPI-based HTTP server that receives, processes, and stores logged messages.

- **chatgpt-live-logger.py**: Local logging server that:
  - Accepts CORS requests from ChatGPT domains
  - Receives and processes logged messages
  - Implements duplicate detection (5-second window)
  - Maintains rolling logs in two files:
    - `chat.log`: Last 100 messages (NDJSON format)
    - `recent.ndjson`: Last 2 messages only
  - Runs on localhost:8788

## Key Features

- **Real-time Capture**: Monitors both user inputs and AI responses as they happen
- **Streaming Support**: Handles ChatGPT's streaming response updates with completion detection
- **URL Extraction**: Automatically extracts and cleans URLs from messages
- **Conversation Tracking**: Tracks conversation IDs from ChatGPT URLs
- **Duplicate Prevention**: Prevents logging of duplicate messages within a 5-second window
- **Rolling Logs**: Maintains manageable log files with automatic rotation

## Setup

### 1. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. The extension should now be active on ChatGPT domains

### 2. Run the Local Server

1. Install Python dependencies:
   ```bash
   pip install fastapi uvicorn
   ```

2. Start the logging server:
   ```bash
   cd server/
   python chatgpt-live-logger.py
   ```

The server will run on `http://127.0.0.1:8788`

## Usage

1. Start the local server
2. Ensure the Chrome extension is loaded and active
3. Navigate to ChatGPT (https://chatgpt.com or https://chat.openai.com)
4. Start a conversation - messages will be automatically logged to:
   - `server/chat.log`: Rolling log of last 100 messages
   - `server/recent.ndjson`: Last 2 messages only

## Log Format

Messages are stored in NDJSON format with the following structure:

```json
{
  "ts": "2024-01-01T12:00:00",
  "role": "user|assistant",
  "content": "message content",
  "urls": ["https://example.com"]
}
```

## Technical Details

- **Extension Version**: 1.0.8
- **Server Port**: 8788
- **Log Rotation**: 100 messages for main log, 2 for recent
- **Duplicate Window**: 5 seconds
- **Supported Domains**: chatgpt.com, chat.openai.com