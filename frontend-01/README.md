# Mahotsav 26 - Frontend

React + Vite frontend application for the Mahotsav campus navigation system.

## 📁 Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Home.js          # Campus map page
│   │   ├── Login.js         # Admin login
│   │   ├── Dashboard.js     # Admin dashboard
│   │   ├── BlockView.js     # Individual block view
│   │   └── VideoPlayer.js   # Video player
│   ├── App.js               # Main app component
│   ├── App.css              # Global styles
│   ├── index.js             # Entry point
│   └── index.css            # Base styles
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
└── package.json
```

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🎨 Pages

### Public Pages
- **Home** (`/`) - Interactive campus map with clickable buildings
- **Block View** (`/block/:blockName`) - Detailed view of a specific block
- **Video Player** (`/block/:blockName/:section`) - Watch videos

### Admin Pages
- **Login** (`/login`) - Admin authentication
- **Dashboard** (`/dashboard`) - Map editor and block management

## 🔧 Configuration

### API Proxy
The Vite dev server proxies API requests to the backend:
- `/api/*` → `http://localhost:5000/api/*`
- `/public/*` → `http://localhost:5000/public/*`

This is configured in `vite.config.js`.

### Build Output
Production builds are output to the `build/` directory.

## 📦 Dependencies

- **react**: UI library
- **react-dom**: React DOM renderer
- **react-router-dom**: Routing
- **axios**: HTTP client
- **vite**: Build tool
- **@vitejs/plugin-react**: Vite React plugin

## 🎨 Features

### User Features
- Interactive campus map
- Clickable building areas
- Block detail views
- Video tours
- Responsive design

### Admin Features
- Login system
- Map editor with drawing tools:
  - View mode
  - Click to get coordinates
  - Draw rectangles on buildings
- Block management (CRUD)
- Section management
- Real-time coordinate capture

## Port

Frontend runs on **port 3000** by default.

## 🔐 Admin Access

Admin credentials are not created automatically.
