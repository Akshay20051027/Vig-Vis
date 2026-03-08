# Mahotsav 26 - Campus Navigator

A MERN stack web application for navigating the Mahotsav 26 campus map with interactive blocks, sections, and video tours.

## Features

- **Interactive Campus Map**: Click on different blocks on the main campus map
- **Block Navigation**: View detailed images of each block
- **Section Videos**: Watch videos of labs and classrooms for each block
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **MongoDB**: Database for storing block and section information
- **Express.js**: Backend API server
- **React**: Frontend user interface
- **Node.js**: Runtime environment

## Project Structure

```
mahotsav-website/
├── server/              # Backend
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── server.js        # Express server
│   └── seed.js          # Database seeding script
├── client/              # Frontend
│   ├── public/          # Static files
│   ├── src/
│   │   ├── pages/       # React page components
│   │   ├── App.js       # Main app component
│   │   └── index.js     # Entry point
│   └── package.json
├── public/              # Media files (images & videos)
│   ├── map.jpeg         # Main campus map
│   └── a-block/
│       ├── ablock.jpg
│       ├── labs/
│       │   └── video.mp4
│       └── classrooms/
│           └── video.mp4
├── .env                 # Environment variables
└── package.json
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection URI)
- npm or yarn

### Installation

1. **Clone or navigate to the project folder**
   ```bash
   cd C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website
   ```

2. **Install dependencies for both server and client**
   ```bash
   npm run install-all
   ```

3. **Set up media files**
   
   Copy your media files to the `public` folder:
   
   - Copy `Mahotsav-26 _ Locations Map_8 x 5 copy.jpg.jpeg` to `public/map.jpeg`
   - Create folder structure: `public/a-block/labs/` and `public/a-block/classrooms/`
   - Copy `A-block/ablock.jpg` to `public/a-block/ablock.jpg`
   - Copy videos from `A-block/labs/` to `public/a-block/labs/video.mp4`
   - Copy videos from `A-block/classrooms/` to `public/a-block/classrooms/video.mp4`

4. **Start MongoDB**
   
   If running locally:
   ```bash
   mongod
   ```

5. **Seed the database**
   ```bash
   node server/seed.js
   ```

6. **Run the application**
   
   Development mode (runs both server and client):
   ```bash
   npm run dev
   ```
   
   Or run separately:
   
   Terminal 1 - Backend:
   ```bash
   npm run server
   ```
   
   Terminal 2 - Frontend:
   ```bash
   npm run client
   ```

7. **Access the application**
   
   Open your browser and navigate to: `http://localhost:3000`

## Usage

1. **Home Page**: View the campus map and click on any block to navigate
2. **Block View**: See the detailed image of the selected block with corner buttons for sections
3. **Video Player**: Click on "Labs" or "Classrooms" to watch the corresponding video

## Adding More Blocks

To add more blocks to the application:

1. Add media files to the `public` folder following the same structure
2. Update `server/seed.js` with new block data
3. Run `node server/seed.js` to update the database
4. Adjust coordinates in the seed data to match block positions on the map

## Configuration

Edit `.env` file to change:
- `PORT`: Backend server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string

## API Endpoints

- `GET /api/blocks` - Get all blocks
- `GET /api/blocks/:name` - Get specific block details
- `POST /api/blocks` - Create new block (for admin)

## Troubleshooting

- **MongoDB connection error**: Ensure MongoDB is running
- **CORS errors**: Check that the proxy is set correctly in `client/package.json`
- **Media files not loading**: Verify file paths match the database entries
- **Port already in use**: Change the PORT in `.env` file

## Future Enhancements

- Admin panel for managing blocks and sections
- User authentication
- Search functionality
- Mobile app version
- 3D virtual tours

## License

MIT License
