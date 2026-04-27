![prism map](logo.svg)

**context-aware prompt builder**

Paste a GitHub repo URL and a bug description — Prism Map clones the repo, scores every file for relevance, and assembles a ready-to-paste LLM prompt containing only the files that matter.

No LLM calls. No database. Fully stateless.

---

## Setup

**Backend**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8001
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## How it works

1. **Clone** — `git clone --depth=1` into a temp directory, stripped of `node_modules`, binaries, lock files, etc.
2. **Score** — every file gets a score from four signals:
   - TF-IDF keyword similarity against the bug description (weight 0.40)
   - Filename/path match against bug tokens (weight 0.25)
   - Import graph bonus — files imported by top scorers (+0.15)
   - Recency — files touched in the last 90 days (+0.10)
3. **Select** — top 10 files, hard-capped at 40k characters of content
4. **Assemble** — prompt template with ranked file contents, ready to copy

Token estimate shown as `total characters / 4`.

---

## Stack

| Layer     | Tech                            |
| --------- | ------------------------------- |
| Frontend  | React 18 + Vite 6 + Tailwind v4 |
| Backend   | Python + FastAPI + scikit-learn |
| Streaming | Server-Sent Events (SSE)        |
