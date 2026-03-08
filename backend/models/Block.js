const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: false
  },
  image: {
    type: String,
    required: false // Will be set via file upload or can be provided
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

// Pre-save hook to set displayName to name if not provided
BlockSchema.pre('save', function(next) {
  if (!this.displayName) {
    this.displayName = this.name;
  }
  next();
});

// Pre-update hook for findOneAndUpdate
BlockSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.name && !update.displayName) {
    update.displayName = update.name;
  }
  next();
});

// Virtual property to return displayName or name
BlockSchema.virtual('display').get(function() {
  return this.displayName || this.name;
});

// Ensure virtuals are included in JSON output
BlockSchema.set('toJSON', { virtuals: true });
BlockSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Block', BlockSchema);
