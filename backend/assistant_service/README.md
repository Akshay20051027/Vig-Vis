# Python Assistant Service (FAISS RAG + TTS)

This folder contains the Python bot service ported from `Vignan-Visit-Akshay/faiss_json_agent`.

## What it does

- Answers questions using a FAISS-based RAG index built from `data/vignan_university_dataset.json` (fallback: `data/knowledge.json`).
- Supports multilingual input via translation.
- Speaks answers by generating an MP3 via `gTTS`.

The Node backend proxies these endpoints at `http://localhost:5000/api/assistant/*`.

## Run (Windows PowerShell)

From the repo root:

```powershell
cd backend\assistant_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.web.txt
python api_server.py
```

The service starts on `http://localhost:5001`.

## Notes

- `requirements.txt` is the original full dependency list (includes optional mic / local TTS libs that may be harder to install on Windows).
- For the web app flow (browser voice recognition + server TTS), `requirements.web.txt` is usually sufficient.
