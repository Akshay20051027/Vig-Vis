const mongoose = require('mongoose');
const Block = require('./models/Block');
const Map = require('./models/Map');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Migration script to convert file-based images to database storage
 * Run this after updating to the new image storage system
 */

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // 1. Migrate Map Image
    console.log('\n--- Migrating Map Image ---');
    const mapPath = path.join(__dirname, 'public/assets/vignan-map.png');
    
    if (fs.existsSync(mapPath)) {
      const mapImageBuffer = fs.readFileSync(mapPath);
      const mapImageBase64 = mapImageBuffer.toString('base64');
      
      // Check if map already exists
      let map = await Map.findOne({ name: 'campus-map' });
      
      if (map) {
        console.log('Updating existing map in database...');
        map.imageData = mapImageBase64;
        map.contentType = 'image/png';
        map.updatedAt = Date.now();
        await map.save();
      } else {
        console.log('Creating new map in database...');
        map = new Map({
          name: 'campus-map',
          imageData: mapImageBase64,
          contentType: 'image/png'
        });
        await map.save();
      }
      
      console.log('✓ Map image migrated successfully');
    } else {
      console.log('⚠ Map image not found at:', mapPath);
    }

    // 2. Migrate Block Images
    console.log('\n--- Migrating Block Images ---');
    const blocks = await Block.find({});
    
    for (const block of blocks) {
      if (block.image && block.image.startsWith('/public/blocks/')) {
        const blockImagePath = path.join(__dirname, block.image.replace('/public/', 'public/'));
        
        if (fs.existsSync(blockImagePath)) {
          console.log(`Migrating image for block: ${block.name}`);
          
          const blockImageBuffer = fs.readFileSync(blockImagePath);
          const blockImageBase64 = blockImageBuffer.toString('base64');
          
          // Determine content type from file extension
          const ext = path.extname(blockImagePath).toLowerCase();
          let contentType = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.webp') contentType = 'image/webp';
          
          // Update block with base64 image data
          block.imageData = blockImageBase64;
          block.imageContentType = contentType;
          block.image = `/api/blocks/image/${block.name}`; // Update to use API endpoint
          await block.save();
          
          console.log(`✓ Migrated: ${block.name}`);
        } else {
          console.log(`⚠ Image not found for block ${block.name}: ${blockImagePath}`);
        }
      } else if (!block.imageData) {
        console.log(`- Block ${block.name} has no image to migrate`);
      } else {
        console.log(`- Block ${block.name} already migrated`);
      }
    }

    console.log('\n✓ Migration completed successfully!');
    console.log('\nSummary:');
    console.log('- Map image: Stored in database');
    console.log(`- Block images: ${blocks.filter(b => b.imageData).length}/${blocks.length} migrated`);
    
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run migration
console.log('=== Image Storage Migration ===');
console.log('This script will convert file-based images to database storage\n');
migrateImages();
