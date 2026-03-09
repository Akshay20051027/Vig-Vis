const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  sections: [{
    name: String,
    displayName: String,
    video: String
  }],
  coordinates: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  }
});

module.exports = mongoose.model('Block', BlockSchema);
