# 🚀 Vignan University Assistant Service - Ready to Run

## ✅ Quick Start (No Setup Required!)

This is a **portable, pre-configured Python project**. Everything is ready to go!

### **Step 1: Double-Click to Run**

Simply double-click:
```
run.bat
```

That's it! The API server will start automatically on **http://localhost:5001**

---

## 📦 What's Included

- ✅ **Pre-installed virtual environment** (`.venv/`)
- ✅ **All dependencies installed**
- ✅ **One-click startup script** (`run.bat`)
- ✅ **FAISS-based knowledge retrieval**
- ✅ **Multilingual support**
- ✅ **Text-to-Speech (gTTS)**

---

## 🛠️ What This Service Does

- Answers questions using a FAISS-based RAG index built from `data/vignan_university_dataset.json`
- Supports multilingual input via translation
- Generates spoken answers as MP3 files using Google Text-to-Speech (gTTS)
- Runs as REST API on `http://localhost:5001`
- Integrates with Node.js backend at `http://localhost:5000/api/assistant/*`

---

## 📂 Project Structure

```
assistant_service/
│
├── 📁 .venv/                      # Portable Python environment (ready)
├── 📁 data/                       # Knowledge base JSON files
├── 📁 rag_engine/                 # Core RAG logic
│
├── 🐍 api_server.py               # Main API server
├── ⚙️ config.py                   # Configuration
├── 🚀 run.bat                     # One-click launcher (USE THIS)
│
├── 📄 requirements.web.txt        # Core dependencies
├── 📄 requirements-frozen.txt     # Complete dependency snapshot
└── 📖 README.md                   # This file
```

---

## 🔧 Manual Setup (Optional)

If you need to reinstall dependencies or recreate the environment:

### Windows

```batch
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.web.txt
python api_server.py
```

---

## 📋 Available Endpoints

Once running, the API provides:

- `POST /ask` - Ask questions to the assistant
- `POST /voice-query` - Voice-based queries with TTS response
- `GET /health` - Health check endpoint

---

## ⚙️ Configuration

Edit `config.py` to customize:
- Server port (default: 5001)
- Knowledge base paths
- TTS settings
- Language preferences

---

## 🐛 Troubleshooting

### Server won't start?

1. Make sure port 5001 is not in use
2. Check that `.venv/` folder exists
3. Try running `run.bat` as Administrator

### Dependencies missing?

Run this to reinstall:
```batch
.venv\Scripts\activate
pip install -r requirements.web.txt
```

### Python version issues?

This project requires **Python 3.8 or higher**. Check your version:
```batch
python --version
```

---

## 📝 Notes

- **requirements.web.txt** - Core dependencies (used in this portable setup)
- **requirements.txt** - Full dependencies including optional audio libraries
- **requirements-frozen.txt** - Complete pip freeze snapshot for exact reproducibility

---

## 🎯 Integration

This service integrates with:
- **Node.js Backend** → Port 5000
- **Frontend React App** → Port 3000/3002
- **MongoDB** → For user/block data

All three services work together to power the Vignan University Campus Navigation System.

---

## 💡 For Developers

To update dependencies:
```batch
.venv\Scripts\activate
pip install <package-name>
pip freeze > requirements-frozen.txt
```

---

**Ready to run? Just double-click `run.bat`!** 🚀
