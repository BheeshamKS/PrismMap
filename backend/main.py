import json
import os

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from pydantic import BaseModel

from analyzer import analyze_repo, analyze_uploaded

_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = (
    [o.strip() for o in _origins_env.split(",") if o.strip()]
    if _origins_env
    else ["http://localhost:5173"]
)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests, slow down."})


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    repo_url: str
    bug_description: str


@app.post("/analyze")
@limiter.limit("10/minute")
async def analyze(request: Request, body: AnalyzeRequest):
    async def generate():
        async for event in analyze_repo(body.repo_url, body.bug_description):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/analyze-upload")
@limiter.limit("10/minute")
async def analyze_upload(
    request: Request,
    bug_description: str = Form(...),
    files: list[UploadFile] = File(...),
):
    async def generate():
        file_data = []
        for uf in files:
            content = await uf.read()
            rel = (uf.filename or "unknown").replace("\\", "/")
            parts = rel.split("/")
            # Strip root folder prefix that webkitRelativePath includes
            clean = "/".join(parts[1:]) if len(parts) > 1 else rel
            if clean:
                file_data.append((clean, content))

        async for event in analyze_uploaded(file_data, bug_description):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
