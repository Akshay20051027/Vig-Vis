# Mahotsav 26 - Campus Navigator

A full-stack MERN application with AI assistant for interactive campus navigation, admin dashboard, and map editing capabilities.

## 📁 Project Structure

```
bot/
├── frontend/                      # React + Vite frontend
│   ├── src/
│   │   ├── pages/                # React components
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                       # Express + MongoDB backend
│   ├── assistant_service/        # Python AI assistant (Flask + FAISS)
│   │   ├── .venv/               # Python virtual environment
│   │   ├── src/                 # Python source code
│   │   ├── data/                # Knowledge base JSON files
│   │   ├── api_server.py        # Flask API server
│   │   ├── requirements.txt     # Python dependencies
│   │   └── README.md
│   ├── models/                   # MongoDB schemas
│   ├── routes/                   # API routes
│   ├── public/                   # Static media files
│   ├── server.js                 # Express server
│   ├── seed.js                   # Database seeding
│   ├── .env                      # Environment variables
│   └── package.json
│
├── start-dev.ps1                 # Development startup script
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Python 3.8+
- MongoDB (running on localhost:27017)

### Installation

1. **Backend Setup**
```bash
cd backend
npm install
```

2. **Frontend Setup**
```bash
cd frontend
npm install
```

3. **Python Assistant Setup**
```powershell
cd backend\assistant_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

4. **Environment Configuration**
The `.env` file in the backend folder should contain:
```
MONGODB_URI=mongodb://localhost:27017/mahotsav-website
PORT=5000
NODE_ENV=development
```

5. **Database (Start Empty)**
- The database is intended to start empty.
- Only add admin credentials / blocks when you explicitly decide to.
- (Optional) A seeding script exists in `backend/seed.js`, but do not run it unless you want sample data.

### Running the Application

**Option 1: Automated Startup (Recommended)**

Windows PowerShell (from project root):
```powershell
.\start-dev.ps1
```

This will automatically start:
- Backend Server (port 5000)
- Python Assistant Service (port 5001)
- Frontend Dev Server (port 3000)

**Option 2: Run Manually**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Python Assistant:
```powershell
cd backend\assistant_service
.\.venv\Scripts\Activate.ps1
python api_server.py
```

Terminal 3 - Frontend:
```bash
cd frontend
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Assistant API**: http://localhost:5001
- **Admin Login**: Click "Admin Login" button
  - Admin credentials are not created automatically.

## 🎯 Features

### User Features
- Interactive campus map with clickable buildings
- Animated robot avatar for AI assistant access
- Voice-enabled AI assistant with multilingual support
- Detailed block views with section navigation
- Video tours of labs and classrooms
- Responsive design

### Admin Features (Dashboard)
- **Map Editor**:
  - View mode - See all blocks on the map
  - Click mode - Get exact coordinates
  - Draw mode - Draw rectangles on buildings
- **Block Management**:
  - Create new blocks with coordinates
  - Edit existing blocks
  - Delete blocks
  - Manage block sections (labs, classrooms, etc.)
- **Visual Feedback**: Real-time coordinate capture

## 🛠️ Technology Stack

### Frontend
- React 18.2.0
- React Router DOM 6.11.0
- Vite 5.1.4
- Axios 1.4.0

### Backend
- Node.js with Express 4.18.2
- MongoDB with Mongoose 7.0.3
- CORS 2.8.5
- dotenv 16.0.3

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify token

### Blocks
- `GET /api/blocks` - Get all blocks
- `GET /api/blocks/:name` - Get block by name
- `POST /api/blocks` - Create new block
- `PUT /api/blocks/:id` - Update block
- `DELETE /api/blocks/:id` - Delete block

### Static Files
- `GET /public/*` - Serve images and videos

## 🔧 Development

### Frontend Development
The frontend runs on Vite with hot module replacement. Changes are reflected instantly.

### Backend Development
The backend uses nodemon for automatic restarts on file changes.

### Adding New Blocks
1. Login to admin dashboard
2. Switch to "Draw Rectangle" mode
3. Draw a rectangle over the building
4. Fill in block details and sections
5. Click "Create Block"

## 📦 Production Build

1. **Build Frontend**
```bash
cd frontend
npm run build
```

2. **Set Environment**
```bash
# In backend/.env
NODE_ENV=production
```

3. **Start Backend**
```bash
cd backend
npm start
```

The backend will serve the built frontend files.

## 📄 License

ISC

## 👤 Author

Mahotsav 26 Team
