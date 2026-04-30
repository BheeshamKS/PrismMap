![prism map](logo.svg)

> paste the right files, not all of them

Context-aware prompt builder for Claude. Describe a bug, point it at a repo — PrismMap ranks every file by relevance and assembles a ready-to-paste prompt with only the code that matters.

**Live demo:** https://prism-map.vercel.app

---

## How it works

1. Paste a GitHub URL or upload a local folder
2. Describe the bug or issue in plain English
3. PrismMap scores every file using four signals:
   - **TF-IDF keyword similarity** (weight 0.40) — matches bug description against file contents
   - **Filename/path heuristic** (weight 0.25) — checks if bug terms appear in file paths
   - **Import graph bonus** (+0.15) — promotes files imported by high-scoring files
   - **Recency bonus** (+0.10) — boosts files modified in the last 90 days via git log
   - **Style file penalty** (0.3x multiplier) — deprioritizes CSS/SCSS files
4. Top 10 files are assembled into a structured prompt, ready to paste into Claude

---

## Stack

| Layer    | Tech                                                |
| -------- | --------------------------------------------------- |
| Frontend | React + TypeScript + Vite + Tailwind CSS v4         |
| Backend  | FastAPI + scikit-learn                              |
| Hosting  | Vercel (frontend) + your backend host               |
| Scoring  | TF-IDF via scikit-learn, import graph via AST/regex |

---

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Copy `backend/.env.example` to `backend/.env` and set:

```
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` and set:

```
VITE_API_URL=http://localhost:8001
```

---

## Environment variables

### Backend

| Variable          | Default                 | Description                                  |
| ----------------- | ----------------------- | -------------------------------------------- |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `MAX_TOTAL_CHARS` | `40000`                 | Max characters included in generated prompt  |
| `MAX_FILE_LINES`  | `500`                   | Max lines read per file during scoring       |

### Frontend

| Variable       | Default                 | Description          |
| -------------- | ----------------------- | -------------------- |
| `VITE_API_URL` | `http://localhost:8001` | Backend API base URL |

---

## Deploying

The backend can run on any host that supports Python (Railway, Render, Fly.io).
Set `ALLOWED_ORIGINS` to your Vercel frontend URL.

The frontend deploys to Vercel with zero config. Set `VITE_API_URL` to your backend URL in Vercel's environment variables.

---

## Limitations

- Only public GitHub repos are supported (no auth)
- Upload size is capped at 3.5 MB after filtering
- API is rate-limited to 10 requests/minute per IP
- Recency scoring requires git to be available on the backend host

If you know a way to reduce or work around any of these limitations, contributions are very welcome.

---

## Contributing

Pull requests are welcome. If you have an idea, fix, or improvement — especially around the limitations above — feel free to open an issue or submit a PR.

---

## License

MIT
