const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../config/middleware/auth');
const router = express.Router();

// GET all cars
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT PlateNumber, DriverName, PhoneNumber, CreatedAt FROM Car ORDER BY CreatedAt DESC'
    );

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cars',
      error: error.message
    });
  }
});

// POST new car (INSERT ONLY as per exam requirements)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { plateNumber, driverName, phoneNumber } = req.body;

    // Validation
    if (!plateNumber || !driverName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Plate number, driver name, and phone number are required'
      });
    }

    // Check if car already exists
    const [existing] = await db.execute(
      'SELECT PlateNumber FROM Car WHERE PlateNumber = ?',
      [plateNumber]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Car with this plate number already exists'
      });
    }

    // Insert car
    await db.execute(
      'INSERT INTO Car (PlateNumber, DriverName, PhoneNumber) VALUES (?, ?, ?)',
      [plateNumber.toUpperCase(), driverName, phoneNumber]
    );

    res.status(201).json({
      success: true,
      message: 'Car added successfully',
      data: { plateNumber, driverName, phoneNumber }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding car',
      error: error.message
    });
  }
});

module.exports = router;