const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Login attempt:', username); // ← ADD THIS

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user
    const [rows] = await db.execute(
      'SELECT * FROM User WHERE Username = ?',
      [username]
    );

    console.log('👤 User found:', rows.length); // ← ADD THIS

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.Password);

    console.log('🔑 Password valid:', isValidPassword); // ← ADD THIS

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.UserId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.UserId,
        username: user.Username
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message); // ← ADD THIS
    console.error('❌ Full error:', error);           // ← ADD THIS
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Register - Add this BEFORE module.exports in auth.js
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [existing] = await db.execute('SELECT * FROM User WHERE Username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute('INSERT INTO User (Username, Password) VALUES (?, ?)', [username, hashedPassword]);

    const token = jwt.sign({ userId: result.insertId, username }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ success: true, message: 'Registration successful', token, user: { id: result.insertId, username } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}); 

module.exports = router;