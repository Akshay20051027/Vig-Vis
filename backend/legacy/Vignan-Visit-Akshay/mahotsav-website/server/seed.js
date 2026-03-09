const mongoose = require('mongoose');
const Block = require('./models/Block');
require('dotenv').config();

// Sample data for A-block
const blocks = [
  {
    name: 'a-block',
    displayName: 'A-block',
    image: '/public/a-block/ablock.jpg',
    sections: [
      {
        name: 'labs',
        displayName: 'Labs',
        video: '/public/a-block/labs/video.mp4'
      },
      {
        name: 'classrooms',
        displayName: 'Classrooms',
        video: '/public/a-block/classrooms/video.mp4'
      }
    ],
    coordinates: {
      x: 75.25,  // Percentage from left (from coordinate picker)
      y: 73.58,  // Percentage from top (from coordinate picker)
      width: 8.57,  // Width in percentage (from coordinate picker)
      height: 4.14  // Height in percentage (from coordinate picker)
    }
  }
  // Add more blocks here as needed
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Upsert sample data without deleting existing coordinates.
    // This prevents map marker positions from being reset unexpectedly.
    for (const block of blocks) {
      const existing = await Block.findOne({ name: block.name }).lean();
      const payload = existing
        ? { ...block, coordinates: existing.coordinates || block.coordinates }
        : block;

      await Block.findOneAndUpdate(
        { name: block.name },
        payload,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('Sample data upserted successfully (existing coordinates preserved)');

    mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
