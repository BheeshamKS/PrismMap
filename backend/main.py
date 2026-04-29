import json

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from analyzer import analyze_repo, analyze_uploaded

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    repo_url: str
    bug_description: str


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    async def generate():
        async for event in analyze_repo(request.repo_url, request.bug_description):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/analyze-upload")
async def analyze_upload(
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
