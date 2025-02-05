// models/User.js
const mongoose = require('mongoose');

// Define the progress subdocument schema with validations
const progressSchema = new mongoose.Schema({
  completedExercises: { type: Number, default: 0, min: 0 },
  accuracy: { type: Number, default: 0, min: 0, max: 100 }, // Ensure accuracy is between 0 and 100%
  comments: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now },
  level: { type: Number, default: 1, min: 1 },
  score: { type: Number, default: 0, min: 0 }
}, { _id: false }); // Disables automatic _id generation for subdocuments

// Define the main User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Keep multiple progress records; later updates will limit to the last 10 entries.
  progress: { 
    type: [progressSchema], 
    default: [] 
  }
});

module.exports = mongoose.model('User', userSchema);
