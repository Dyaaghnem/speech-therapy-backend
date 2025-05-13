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

    // Find user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Keep only the last 10 entries
    user.progress = [...user.progress.slice(-9), progressData];
    await user.save();

    // Logging
    console.log('✅ Progress saved for:', user._id);
    console.log('🧠 New progress array:', user.progress);

    // Recompute analytics
    const entries = user.progress;
    const correctCount = entries.filter(p => p.accuracy === 100).length;
    const incorrectCount = entries.filter(p => p.accuracy === 0).length;

    let streak = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].accuracy === 100) streak++;
      else break;
    }

    const totalExercises = entries.reduce((sum, e) => sum + (e.completedExercises || 0), 0);
    const averageAccuracy = entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.accuracy || 0), 0) / entries.length
      : 0;
    const bestScore = entries.reduce((max, e) => (e.score > max ? e.score : max), 0);

    console.log('📊 Analytics after update for:', user._id);
    console.log('   totalExercises =', totalExercises);
    console.log('   averageAccuracy =', averageAccuracy.toFixed(2));
    console.log('   bestScore =', bestScore);
    console.log('   correctCount =', correctCount);
    console.log('   incorrectCount =', incorrectCount);
    console.log('   streak =', streak);

    // Respond with both progress list and fresh analytics
    return res.status(200).json({
      message: 'Progress updated successfully',
      progress: entries,
      analytics: {
        totalExercises,
        averageAccuracy,
        bestScore,
        progressCount: entries.length,
        correctCount,
        incorrectCount,
        streak
      }
    });
  } catch (error) {
    console.error('Progress Update Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


/**
 * GET /progress/analytics/:userId
 * Protected route: Retrieves aggregated progress analytics.
 */
router.get('/progress/analytics/:userId', verifyToken, async (req, res) => {
  try {
    // 1) Auth check
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to analytics.' });
    }

    // 2) Load user & their progress array
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const entries = user.progress || [];

    // 3) Filter only today's entries
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const todays = entries.filter(e =>
      e.lastUpdated.toISOString().slice(0, 10) === today
    );

    // 4) Today's metrics
    const correctCount   = todays.filter(p => p.accuracy === 100).length;
    const incorrectCount = todays.filter(p => p.accuracy === 0).length;
    const progressCount  = todays.length;

    // 5) Today's streak (break on first non-perfect today)
    let streak = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryDay = entries[i].lastUpdated.toISOString().slice(0, 10);
      if (entryDay === today && entries[i].accuracy === 100) {
        streak++;
      } else {
        break;
      }
    }

    // 6) Overall stats (unchanged)
    const totalExercises = entries.reduce((sum, e) => sum + (e.completedExercises || 0), 0);
    const averageAccuracy = entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.accuracy || 0), 0) / entries.length
      : 0;
    const bestScore = entries.reduce((max, e) => (e.score > max ? e.score : max), 0);

    // 7) Logging for debugging
    console.log('📊 Returning analytics for:', user._id);
    console.log('   totalExercises   =', totalExercises);
    console.log('   averageAccuracy  =', averageAccuracy.toFixed(2));
    console.log('   bestScore        =', bestScore);
    console.log('   progressCount    =', progressCount);
    console.log('   correctCount     =', correctCount);
    console.log('   incorrectCount   =', incorrectCount);
    console.log('   streak           =', streak);

    // 8) Response JSON exactly matches your original shape
    return res.status(200).json({
      totalExercises,
      averageAccuracy,
      bestScore,
      progressCount,
      correctCount,
      incorrectCount,
      streak
    });
  } catch (error) {
    console.error('Progress Analytics Error:', error);
    return res.status(500).json({ message: 'Server error' });
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
