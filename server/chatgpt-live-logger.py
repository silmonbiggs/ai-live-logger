# ai-chat-live-logger.py — local sink with CORS + preflight for ChatGPT and Claude
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json
from pathlib import Path
from datetime import datetime

ROOT   = Path(__file__).parent
LOG    = ROOT / "chat.log"         # filtered conversation content
VERBOSE_LOG = ROOT / "chatverbose.log"  # unfiltered everything
RECENT = ROOT / "recent.ndjson"    # last 2 messages (ndjson)
MAX_LINES = 100
RECENT_N  = 2

app = FastAPI()

# Allow ChatGPT domains to call us from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                # simple and permissive for localhost dev
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def append_rolling(path: Path, item: dict, max_lines: int):
    lines = []
    if path.exists():
        lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    lines.append(json.dumps(item, ensure_ascii=False))
    if len(lines) > max_lines:
        lines = lines[-max_lines:]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

def is_noise_content(content: str, platform: str, urls: list = None) -> bool:
    """Filter out UI noise, navigation elements, CSS, and other non-conversational content"""
    content_lower = content.lower().strip()
    urls = urls or []
    
    try:
        print(f"FILTER DEBUG: checking content='{content[:50]}...' len={len(content)}")
    except UnicodeEncodeError:
        print(f"FILTER DEBUG: checking content=[Unicode content] len={len(content)}")
    
    # Empty or very short content
    if len(content) < 3:
        return True
    
    # CSS/Styling content
    if any(css_pattern in content for css_pattern in [
        "@keyframes", "position: fixed", "z-index:", "rgba(", "transform:", 
        "animation:", "box-shadow:", "border-radius:", "opacity:", "background:",
        ".intercom-", "px;", "rem;", "vh;", "vw;", "%;"
    ]):
        return True
    
    # Common UI navigation elements - be more specific to avoid false positives
    ui_noise_exact = [
        "all chats", "new chat", "retry", "share", "delete",
        "claude can make mistakes", "please double-check responses",
        "pending context request", "artifacts", "projects", "claude code",
        "starred", "chats projects artifacts", "recents",
        # Claude UI specific elements
        "test message confirmation share", "test message confirmation", 
        "retry", "share", "confirmation", "message confirmation"
    ]
    
    # UI patterns that can appear anywhere in content
    ui_noise_patterns = [
        "chats projects artifacts", "claude can make mistakes",
        # Button and UI element patterns
        "retry", "confirmation share", "message confirmation"
    ]
    
    if content_lower in ui_noise_exact or any(pattern in content_lower for pattern in ui_noise_patterns):
        return True
    
    # Chat title patterns with URLs (these are likely chat sidebar titles)
    has_chat_url = any("claude.ai/chat/" in url for url in urls)
    if has_chat_url and len(content.split()) <= 6:
        return True
    
    # Fragment patterns (single words that are clearly UI fragments)
    # But exclude valid short responses like "okay27"
    single_word_ui = ["research", "sonnet", "writing", "method", "analysis", "review", "request"]
    if (len(content.split()) == 1 and content_lower in single_word_ui):
        return True
        
    # Allow valid short responses that match okay pattern
    import re
    if re.match(r'^okay\d+$', content_lower):
        print(f"FILTER DEBUG: allowing okay response: {content}")
        return False
    
    # Specific chat title patterns that repeat as noise
    chat_title_patterns = ["research sonnet 4", "j james", "j test"]
    if any(pattern in content_lower for pattern in chat_title_patterns):
        return True
    
    # Claude UI specific patterns (button text combinations)
    claude_ui_patterns = [
        r".*\s+retry$",        # anything ending with " Retry" (with space)
        r".*\s+share$",        # anything ending with " Share" (with space)  
        r"test\s+message\s+confirmation.*"  # test message confirmation variations
    ]
    
    import re
    for pattern in claude_ui_patterns:
        if re.match(pattern, content_lower):
            return True
    
    # Allow testmessage and okay responses - these are valid test content
    if content_lower.startswith('testmessage') or re.match(r'^okay\d+$', content_lower):
        print(f"FILTER DEBUG: allowing test content: {content}")
        return False  # Don't filter test messages
    
    return False

@app.options("/log")
async def preflight():
    # FastAPI+CORS middleware will add the right headers; just return 204
    return Response(status_code=204)

@app.post("/log")
async def log_msg(req: Request):
    data = await req.json()
    item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "platform": data.get("platform", "unknown"),
        "role": data.get("role", "assistant"),
        "content": data.get("text", ""),
        "urls": data.get("urls", []),
        "metadata": data.get("metadata", {}),
    }
    
    # Check for recent duplicates (within last 5 seconds)
    if LOG.exists():
        recent_lines = []
        try:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            # Check last 50 entries for duplicates (increased from 5 to catch longer-term repeats)
            for line in lines[-50:]:
                if line.strip():
                    recent_item = json.loads(line)
                    recent_lines.append(recent_item)
        except:
            pass
        
        # Check if this is a duplicate of recent content with stricter rules
        current_time = datetime.fromisoformat(item["ts"])
        for recent in recent_lines:
            try:
                recent_time = datetime.fromisoformat(recent["ts"])
                time_diff = (current_time - recent_time).total_seconds()
                
                # Much stricter duplicate detection for assistant messages
                duplicate_window = 2 if item["role"] == "assistant" else 5  # 2 seconds for assistant, 5 for user
                
                # If same content within time window, skip
                if (time_diff <= duplicate_window and 
                    recent["role"] == item["role"] and 
                    recent["content"] == item["content"] and
                    recent.get("platform") == item.get("platform")):
                    print(f"DUPLICATE BLOCKED: {item['platform']}-{item['role']} '{item['content'][:30]}...' (same as {time_diff:.1f}s ago)")
                    return PlainTextResponse("ok")
                    
                # Additional check: block identical assistant responses within 30 seconds
                if (item["role"] == "assistant" and 
                    recent["role"] == "assistant" and
                    recent["content"] == item["content"] and
                    time_diff <= 30):
                    print(f"DUPLICATE ASSISTANT BLOCKED: '{item['content'][:30]}...' (repeat within {time_diff:.1f}s)")
                    return PlainTextResponse("ok")
                    
            except:
                continue
        
        # ENHANCED: Check for long-term duplicates in entire recent history (stronger duplicate detection)
        # This catches the "okay38", "okay39" style repeats that happen minutes apart
        duplicate_content_map = {}
        for recent in recent_lines:
            try:
                if recent["role"] == "assistant" and recent.get("platform") == item.get("platform"):
                    content = recent["content"]
                    if content not in duplicate_content_map:
                        duplicate_content_map[content] = recent
            except Exception as e:
                print(f"ENHANCED DEBUG: Error processing recent item: {e}")
                continue
        
        print(f"ENHANCED DEBUG: Checking {len(recent_lines)} recent entries for duplicates of '{item.get('content', '')[:30]}...'")
        print(f"ENHANCED DEBUG: Found {len(duplicate_content_map)} unique assistant messages in history")
        
        # If we've seen this assistant content before in this session, check if it's a legitimate echo
        if (item["role"] == "assistant" and 
            item["content"] in duplicate_content_map and
            duplicate_content_map[item["content"]]["ts"] != item["ts"]):
            
            first_occurrence = duplicate_content_map[item["content"]]["ts"]
            first_occurrence_time = datetime.fromisoformat(first_occurrence)
            current_time = datetime.fromisoformat(item["ts"])
            time_since_first = (current_time - first_occurrence_time).total_seconds()
            
            # Check if this might be a legitimate assistant echo of a recent user message
            # Look for a recent user message with same or similar content (within last 30 seconds)
            is_legitimate_echo = False
            for recent in recent_lines[-10:]:  # Check last 10 messages for user echo
                try:
                    if (recent["role"] == "user" and 
                        recent.get("platform") == item.get("platform")):
                        recent_time = datetime.fromisoformat(recent["ts"])
                        time_since_user = (current_time - recent_time).total_seconds()
                        
                        # If user said something similar within last 30 seconds, this might be an echo
                        if (time_since_user <= 30 and 
                            (recent["content"] == item["content"] or 
                             recent["content"].lower() in item["content"].lower())):
                            is_legitimate_echo = True
                            print(f"ECHO ALLOWED: Assistant echoing recent user message '{item['content'][:30]}...' from {time_since_user:.1f}s ago")
                            break
                except:
                    continue
            
            # Block if it's not a legitimate echo and happened more than 60 seconds ago
            if not is_legitimate_echo and time_since_first > 60:
                print(f"ENHANCED DUPLICATE BLOCKED: '{item['content'][:30]}...' (first seen at {first_occurrence}, {time_since_first:.1f}s ago, not an echo)")
                return PlainTextResponse("ok")
            elif not is_legitimate_echo:
                print(f"RECENT REPEAT ALLOWED: '{item['content'][:30]}...' (first seen {time_since_first:.1f}s ago)")
            
        # Also allow legitimate assistant echo pattern within 30 seconds of user message with similar content
        elif item["role"] == "assistant":
            for recent in recent_lines[-5:]:  # Check last 5 messages for immediate echo pattern
                try:
                    if (recent["role"] == "user" and 
                        recent.get("platform") == item.get("platform")):
                        recent_time = datetime.fromisoformat(recent["ts"])
                        current_time = datetime.fromisoformat(item["ts"])
                        time_since_user = (current_time - recent_time).total_seconds()
                        
                        # If user said something similar within last 30 seconds, allow the echo
                        if (time_since_user <= 30 and 
                            recent["content"].lower() in item["content"].lower()):
                            print(f"ECHO PATTERN ALLOWED: Assistant echoing user '{item['content'][:30]}...' from {time_since_user:.1f}s ago")
                            break
                except:
                    continue
    
    # Check if content should be filtered
    platform = item.get("platform", "unknown")
    content = item.get("content", "")
    urls = item.get("urls", [])
    
    print(f"BEFORE FILTER: calling is_noise_content for content length {len(content)}")
    is_noise = is_noise_content(content, platform, urls)
    print(f"AFTER FILTER: is_noise={is_noise}")
    
    # Debug logging
    if len(content) > 100:
        print(f"DEBUG: long content ({len(content)} chars): {content[:50]}... -> is_noise={is_noise}")
    if urls:
        print(f"DEBUG: content with URLs: '{content[:30]}...' urls={urls} -> is_noise={is_noise}")
    
    # Always log to verbose log (everything)
    append_rolling(VERBOSE_LOG, item, MAX_LINES)
    append_rolling(RECENT, item, RECENT_N)
    
    # Only log to filtered log if not noise
    if not is_noise:
        append_rolling(LOG, item, MAX_LINES)
    
    # Enhanced logging with platform and metadata info
    metadata = item.get("metadata", {})
    tools = metadata.get("tools", [])
    artifacts = metadata.get("artifacts", [])
    
    log_details = f"logged: {platform}-{item['role']} chars:{len(content)} content:'{content[:30]}...'"
    if tools:
        log_details += f" tools:{','.join(tools)}"
    if artifacts:
        log_details += f" artifacts:{len(artifacts)}"
    if is_noise:
        log_details += " [FILTERED - not in chat.log]"
    else:
        log_details += " [SAVED to chat.log]"
    
    print(log_details)
    return PlainTextResponse("ok")

@app.get("/health")
async def health():
    return PlainTextResponse("ok")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8788)