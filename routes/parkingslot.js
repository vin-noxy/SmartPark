const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../config/middleware/auth');
const router = express.Router();

// GET all parking slots
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT SlotNumber, SlotStatus, CreatedAt FROM ParkingSlot ORDER BY SlotNumber'
    );
    
    res.json({
      success: true,
      data: rows,
      count: rows.length,
      available: rows.filter(slot => slot.SlotStatus === 'Available').length,
      occupied: rows.filter(slot => slot.SlotStatus === 'Occupied').length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching parking slots',
      error: error.message
    });
  }
});

// POST new parking slot (INSERT ONLY)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { slotNumber, slotStatus } = req.body;

    if (!slotNumber) {
      return res.status(400).json({
        success: false,
        message: 'Slot number is required'
      });
    }

    // Check if slot already exists
    const [existing] = await db.execute(
      'SELECT SlotNumber FROM ParkingSlot WHERE SlotNumber = ?',
      [slotNumber]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Parking slot already exists'
      });
    }

    // Insert parking slot
    await db.execute(
      'INSERT INTO ParkingSlot (SlotNumber, SlotStatus) VALUES (?, ?)',
      [slotNumber, slotStatus || 'Available']
    );

    res.status(201).json({
      success: true,
      message: 'Parking slot added successfully',
      data: { slotNumber, slotStatus: slotStatus || 'Available' }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding parking slot',
      error: error.message
    });
  }
});

module.exports = router;