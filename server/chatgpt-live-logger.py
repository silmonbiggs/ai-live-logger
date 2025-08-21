# chatgpt-live-logger.py — local sink with CORS + preflight
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json
from pathlib import Path
from datetime import datetime

ROOT   = Path(__file__).parent
LOG    = ROOT / "chat.log"         # rolling last 20 lines (ndjson)
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

@app.options("/log")
async def preflight():
    # FastAPI+CORS middleware will add the right headers; just return 204
    return Response(status_code=204)

@app.post("/log")
async def log_msg(req: Request):
    data = await req.json()
    item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "role": data.get("role", "assistant"),
        "content": data.get("text", ""),
        "urls": data.get("urls", []),
    }
    
    # Check for recent duplicates (within last 5 seconds)
    if LOG.exists():
        recent_lines = []
        try:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            # Check last 5 entries for duplicates
            for line in lines[-5:]:
                if line.strip():
                    recent_item = json.loads(line)
                    recent_lines.append(recent_item)
        except:
            pass
        
        # Check if this is a duplicate of recent content
        current_time = datetime.fromisoformat(item["ts"])
        for recent in recent_lines:
            try:
                recent_time = datetime.fromisoformat(recent["ts"])
                time_diff = (current_time - recent_time).total_seconds()
                
                # If same content within 5 seconds, skip
                if (time_diff <= 5 and 
                    recent["role"] == item["role"] and 
                    recent["content"] == item["content"]):
                    print(f"skipped duplicate: {item['role']} (same as {time_diff:.1f}s ago)")
                    return PlainTextResponse("ok")
            except:
                continue
    
    append_rolling(LOG, item, MAX_LINES)
    append_rolling(RECENT, item, RECENT_N)
    print("logged:", item["role"], "chars:", len(item["content"]))
    return PlainTextResponse("ok")

@app.get("/health")
async def health():
    return PlainTextResponse("ok")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8788)