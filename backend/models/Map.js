const mongoose = require('mongoose');

const MapSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    default: 'campus-map'
  },
  imageData: {
    type: String, // Base64 encoded image data
    required: true
  },
  contentType: {
    type: String, // MIME type (image/png, image/jpeg, etc.)
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
MapSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Map', MapSchema);
