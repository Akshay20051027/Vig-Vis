# Project Overview — Campus Map + Multilingual Voice Assistant

## 1) What this application is
This project is a **campus experience web app** that combines:

- An interactive **campus map / block explorer** (e.g., A-Block classrooms/labs/media)
- An **admin dashboard** for managing campus content (blocks + map metadata)
- A **multilingual “Campus Assistant” chatbot** with optional **text-to-speech (TTS)** output

It is designed so a visitor (student/guest) can:

- Open the site and see the campus map
- Navigate blocks (A-Block, etc.) and view associated content
- Ask questions in English/Telugu (and other languages via translation), including short greetings and common queries like **fee structure**
- Hear answers spoken (MP3) in the browser

## 2) High-level architecture
The project is a 3-service stack:

- **Frontend**: React + Vite (browser UI)
- **Backend API**: Node.js + Express (REST API + proxy)
- **Assistant service**: Python (Flask API) providing RAG answers + TTS

Data is primarily stored in **MongoDB** (via Mongoose in the Node backend). Some content (like map/asset fallbacks) can be served from disk when DB is unavailable.

### Service diagram
```mermaid
flowchart LR
  U[User Browser] -->|HTTP| FE[Frontend (Vite/React) :3000]
  FE -->|REST| BE[Node/Express API :5000]
  BE -->|MongoDB (Mongoose)| DB[(MongoDB)]
  BE -->|Proxy /api/assistant/*| PY[Python Assistant (Flask) :5001]
  PY -->|FAISS + Embeddings| RAG[(Local RAG Index)]
  PY -->|TTS MP3| BE
  BE -->|audio/mpeg| FE
```

## 3) What each part does

### A) Frontend (React + Vite)
**Location:** `frontend/`

Main responsibilities:

- Renders pages like **Home**, **Block view**, **Dashboard/Admin**, **Login**, and **Video player**
- Displays the campus map and block navigation
- Hosts the **embedded Campus Assistant widget** directly on the Home page
- Manages the full chat UX:
  - language selection
  - time-based greetings
  - a small lunch-followup conversation step
  - sending user text to the backend
  - optionally requesting TTS audio and playing it
  - ensuring audio is stopped/aborted when the widget is closed

Routing behavior:

- `/assistant` is treated as a helper route and redirects users to the Home page where the embedded widget is the primary assistant experience.

### B) Node Backend (Express)
**Location:** `backend/`

Main responsibilities:

- Provides REST endpoints for campus content:
  - **Blocks listing** and details
  - **Map metadata** and **map image**
  - Asset/media endpoints
- Handles **authentication** (admin login)
- Proxies assistant endpoints to the Python service under a stable path:
  - `GET /api/assistant/status`
  - `POST /api/assistant/query`
  - `POST /api/assistant/tts`

#### MongoDB + fallback mode
The backend is built to keep the UI working even if MongoDB is temporarily down:

- When DB is connected: routes return DB-backed data.
- When DB is disconnected: some routes can return **fallback content from disk** (so the map/home experience can still load).

This makes local demos and kiosks more resilient.

### C) Python Assistant Service (Flask)
**Location:** `backend/assistant_service/`

Main responsibilities:

- Answers user questions using a **RAG pipeline**:
  - Knowledge is loaded from JSON datasets in `backend/assistant_service/data/`
  - A FAISS index is built over “knowledge chunks”
  - The assistant retrieves relevant chunks and generates a response
- Supports multilingual queries:
  - detects/normalizes intent across languages
  - uses translation so Telugu input can still hit English knowledge sources
- Provides server-side **TTS**:
  - Returns an MP3 (`audio/mpeg`) for the UI to play

#### Intent/quality behavior (practical UX)
The assistant contains logic to improve real user input handling:

- Handles short greetings like `hi`, `gm`, etc.
- Has special handling for **fee structure** queries and common typo/ASR variants (e.g., `pees/feez/fess`, Telugu “పీస్” in “structure” context) to avoid irrelevant answers.
- Uses guardrails to reduce “random” retrieval when intent is clear.

## 4) Key user flows

### Flow 1 — Visitor explores campus
1. User opens the Home page (map loads).
2. User clicks a block (e.g., A-Block) to view details/media.
3. User can open videos/images via dedicated pages.

### Flow 2 — Visitor uses the Campus Assistant
1. User opens the embedded widget on Home.
2. Selects a language.
3. The assistant greets (time-based) and may ask a small follow-up (like lunch).
4. User asks a question (text).
5. Frontend calls Node backend `/api/assistant/query`.
6. Node proxies to Python assistant.
7. Python returns an answer (and optionally translated answer).
8. If voice is enabled, frontend calls `/api/assistant/tts` and plays the MP3.
9. Closing the widget stops any in-flight/playing audio.

### Flow 3 — Admin updates content
1. Admin logs in.
2. Opens Dashboard.
3. Uses backend APIs to edit/update blocks/map metadata.

## 5) External & internal dependencies

### Runtime dependencies
- Node.js (backend)
- Python (assistant service)
- MongoDB (for persistent content)

### ML/NLP dependencies (assistant)
- SentenceTransformers embeddings (downloads model on first run)
- FAISS for fast similarity search
- Translation layer to support multilingual queries
- TTS generation returning MP3

## 6) Dev-time ports and endpoints
Default local ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Python assistant: `http://localhost:5001`

Common health checks:

- Frontend: `GET http://localhost:3000/`
- Backend: `GET http://localhost:5000/api/blocks`
- Assistant direct: `GET http://localhost:5001/api/assistant/status`
- Assistant via proxy: `GET http://localhost:5000/api/assistant/status`

## 7) How to run locally (Windows)
From the repo root, the quickest path is:

```powershell
.\start-dev.ps1
```

This starts:

- Node backend (and connects to MongoDB if configured)
- Python assistant service (uses its venv if present)
- Vite frontend

If you need to run the assistant service alone:

```powershell
cd backend\assistant_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.web.txt
python api_server.py
```

## 8) Repository structure (what to look at)

- `frontend/` — UI, pages, embedded assistant widget
- `backend/server.js` — Express server entry
- `backend/routes/` — API routes (blocks/auth/assistant proxy/etc.)
- `backend/models/` — MongoDB/Mongoose models
- `backend/assistant_service/api_server.py` — Python assistant API
- `backend/assistant_service/src/` — retrieval + answer generation pipeline
- `backend/assistant_service/data/` — knowledge JSON datasets
- `backend/legacy/` — older experiments and prior versions (kept for reference)

## 9) What this project is best for
- Campus event visitor helpdesk (Mahotsav) / kiosk assistant
- Quick campus navigation and common FAQs
- Multilingual Q&A with optional voice output

## 10) Known operational notes
- First run of the assistant may take longer because the embedding model is downloaded and the FAISS index is built.
- If MongoDB is unavailable, the backend can still serve limited fallback content so the UI isn’t blank.

---

If you want, I can also generate a shorter “One Page Summary” version for non-technical readers.