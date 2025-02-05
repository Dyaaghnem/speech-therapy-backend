// src/index.js
/**
 * Main server file for the Speech Therapy API.
 */
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const listEndpoints = require('express-list-endpoints');

// Load environment variables from .env
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Function to connect to MongoDB with retries
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Home endpoint to confirm the API is running
app.get('/', (req, res) => {
  res.send('Speech Therapy API is running');
});

// Mount the API routes under /api
const routes = require('./routes');
app.use('/api', routes);

// Start the server and log all registered endpoints for debugging
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nAll Registered Routes:');
  console.log(listEndpoints(app));
});
