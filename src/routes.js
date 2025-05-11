// routes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const verifyToken = require('./middleware/auth');

const router = express.Router();

/**
 * POST /signup
 * Registers a new user.
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    
    res.status(201).json({ message: 'User registered successfully', userId: newUser._id });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /login
 * Logs in a user and returns a JWT token.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Include both userId and username in the token payload
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.status(200).json({ message: 'Login successful', token, userId: user._id });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /progress
 * Protected route: Updates the progress data for the logged-in user.
 * Keeps only the last 10 progress records.
 */
router.post('/progress', verifyToken, async (req, res) => {
  try {
    const progressData = req.body.progressData;
    
    // Validate progress data
    if (
      !progressData ||
      typeof progressData.completedExercises !== 'number' ||
      typeof progressData.accuracy !== 'number' ||
      progressData.completedExercises < 0 ||
      progressData.accuracy < 0 ||
      progressData.accuracy > 100
    ) {
      return res.status(400).json({ message: 'Invalid progress data. Check values.' });
    }
    
    // Use userId from the JWT payload
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Keep only the last 10 progress records (last 9 plus the new one)
    user.progress = [...user.progress.slice(-9), progressData];
    
    await user.save();
    res.status(200).json({ message: 'Progress updated successfully', progress: user.progress });
  } catch (error) {
    console.error('Progress Update Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /progress/analytics/:userId
 * Protected route: Retrieves aggregated progress analytics for the logged-in user.
 */
router.get('/progress/analytics/:userId', verifyToken, async (req, res) => {
  try {
    // Enforce that the requested userId matches the token's userId
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to analytics.' });
    }
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const progressEntries = user.progress || [];

    const correct = progressEntries.filter(p => p.accuracy === 100).length;
    const incorrect = progressEntries.filter(p => p.accuracy === 0).length;

    let streak = 0;
    for (let i = progressEntries.length - 1; i >= 0; i--) {
      if (progressEntries[i].accuracy === 100) streak++;
      else break;
    }


    
    // Calculate aggregated analytics
    const totalExercises = user.progress.reduce((sum, entry) => sum + (entry.completedExercises || 0), 0);
    const averageAccuracy = user.progress.length > 0
      ? user.progress.reduce((sum, entry) => sum + (entry.accuracy || 0), 0) / user.progress.length
      : 0;
    const bestScore = user.progress.reduce((max, entry) => (entry.score > max ? entry.score : max), 0);
    
    res.status(200).json({
      totalExercises,
      averageAccuracy,
      bestScore,
      progressCount: user.progress.length
    });
  } catch (error) {
    console.error('Progress Analytics Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
