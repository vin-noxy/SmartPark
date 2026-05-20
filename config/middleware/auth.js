const jwt = require('jsonwebtoken');
const db = require('../database');
const bcrypt = require('bcryptjs');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const [rows] = await db.execute(
      'SELECT UserId, Username FROM User WHERE UserId = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = { authenticateToken };