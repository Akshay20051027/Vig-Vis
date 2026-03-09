# Quick Start Guide - Mahotsav 26 Website

## What You Have

A complete MERN stack website with:
- ✅ Interactive campus map on home page
- ✅ Clickable blocks that navigate to detailed views
- ✅ Block pages with corner buttons for Labs and Classrooms
- ✅ Video player for each section
- ✅ All media files already copied and configured

## File Structure Created

```
mahotsav-website/
├── server/
│   ├── models/Block.js          # MongoDB schema
│   ├── routes/blocks.js         # API routes
│   ├── server.js                # Express server
│   └── seed.js                  # Database setup
├── client/
│   ├── public/index.html
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.js          # Main map page
│   │   │   ├── BlockView.js     # Individual block page
│   │   │   └── VideoPlayer.js   # Video player page
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
├── public/                       # Media files
│   ├── map.jpeg                 # Campus map
│   └── a-block/
│       ├── ablock.jpg           # Block image
│       ├── labs/video.mp4       # Labs video
│       └── classrooms/video.mp4 # Classrooms video
├── .env                         # Environment config
├── package.json                 # Backend dependencies
├── setup.ps1                    # Setup script
└── start.ps1                    # Quick start script
```

## Installation Steps

### Option 1: Automated Setup (Recommended)

1. Open PowerShell in the project folder:
   ```powershell
   cd C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website
   ```

2. Run the setup script:
   ```powershell
   .\setup.ps1
   ```

3. Start the application:
   ```powershell
   .\start.ps1
   ```

### Option 2: Manual Setup

1. **Install MongoDB**
   - Download from: https://www.mongodb.com/try/download/community
   - Install and start the MongoDB service

2. **Install Dependencies**
   ```powershell
   cd C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website
   npm install
   cd client
   npm install
   cd ..
   ```

3. **Seed the Database**
   ```powershell
   node server/seed.js
   ```

4. **Start the Application**
   
   Terminal 1 (Backend):
   ```powershell
   npm run server
   ```
   
   Terminal 2 (Frontend):
   ```powershell
   npm run client
   ```

## Access the Application

Once running, open your browser and go to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## How It Works

### 1. Home Page (/)
- Displays the main campus map image
- Shows clickable areas for each block (currently configured for A-block)
- Click anywhere on the map to navigate to A-block view

### 2. Block View (/block/a-block)
- Shows the A-block image
- Displays "Labs" and "Classrooms" buttons at corners
- Click buttons to navigate to respective video pages
- Back button to return to map

### 3. Video Player (/block/a-block/labs or /block/a-block/classrooms)
- Plays the selected video
- Full video controls (play, pause, volume, fullscreen)
- Back button to return to block view

## Adding More Blocks

### 1. Add Media Files
Create folders and add files:
```
public/
└── [block-name]/
    ├── [block-name].jpg
    ├── labs/video.mp4
    └── classrooms/video.mp4
```

### 2. Update Database
Edit `server/seed.js` and add new block data:
```javascript
{
  name: 'b-block',
  displayName: 'B Block',
  image: '/public/b-block/bblock.jpg',
  sections: [
    {
      name: 'labs',
      displayName: 'Labs',
      video: '/public/b-block/labs/video.mp4'
    },
    {
      name: 'classrooms',
      displayName: 'Classrooms',
      video: '/public/b-block/classrooms/video.mp4'
    }
  ],
  coordinates: {
    x: 50,      // % from left
    y: 30,      // % from top
    width: 15,  // width in %
    height: 20  // height in %
  }
}
```

### 3. Re-seed Database
```powershell
node server/seed.js
```

## Customization

### Adjust Block Clickable Areas
Edit coordinates in `server/seed.js`:
- `x`: Distance from left edge (percentage)
- `y`: Distance from top edge (percentage)
- `width`: Width of clickable area (percentage)
- `height`: Height of clickable area (percentage)

### Change Button Positions
Edit `client/src/pages/BlockView.js` to modify button positions:
- `top-left`, `top-right`, `bottom-left`, `bottom-right`

### Styling
Edit `client/src/App.css` to customize:
- Colors, fonts, animations
- Button styles and positions
- Video player appearance

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is installed and running
- Check connection string in `.env` file

### Port Already in Use
- Change PORT in `.env` file
- Or kill the process using the port

### Media Files Not Loading
- Verify files exist in `public/` folder
- Check browser console for 404 errors
- Ensure file paths in database match actual files

### CORS Errors
- Check proxy setting in `client/package.json`
- Should be: `"proxy": "http://localhost:5000"`

## Tech Stack Details

- **Frontend**: React 18, React Router 6, Axios
- **Backend**: Express 4, Mongoose 7
- **Database**: MongoDB
- **Development**: Nodemon, Concurrently

## Next Steps

1. Customize the block coordinates to match your map
2. Add more blocks and sections
3. Test the complete user flow
4. Deploy to production (optional)

## Support

For issues or questions, check:
- README.md for detailed documentation
- Console logs in browser DevTools
- Server logs in terminal

---

**Enjoy your Mahotsav 26 Campus Navigator! 🎉**
