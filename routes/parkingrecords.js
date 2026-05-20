const express = require('express');
const moment = require('moment');
const db = require('../config/database');
const { authenticateToken } = require('../config/middleware/auth');
const router = express.Router();

// GET all parking records
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        pr.RecordId,
        pr.EntryTime,
        pr.ExitTime,
        pr.Duration,
        pr.Car_PlateNumber AS PlateNumber,
        pr.Slot_SlotNumber AS SlotNumber,
        c.DriverName,
        c.PhoneNumber,
        ps.SlotStatus,
        CASE WHEN p.PaymentId IS NOT NULL THEN 1 ELSE 0 END AS IsPaid
      FROM ParkingRecord pr
      LEFT JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      LEFT JOIN ParkingSlot ps ON pr.Slot_SlotNumber = ps.SlotNumber
      LEFT JOIN Payment p ON pr.RecordId = p.RecordId
      ORDER BY pr.EntryTime DESC
    `);

    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('GET records error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching parking records',
      error: error.message
    });
  }
});

// POST new parking record (Entry)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { carPlateNumber, slotNumber, entryTime } = req.body;

    if (!carPlateNumber || !slotNumber) {
      return res.status(400).json({
        success: false,
        message: 'Car plate number and slot number are required'
      });
    }

    // Check if car exists
    const [car] = await db.execute(
      'SELECT PlateNumber FROM Car WHERE PlateNumber = ?',
      [carPlateNumber]
    );
    if (car.length === 0) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    // Check slot exists and available
    const [slot] = await db.execute(
      'SELECT SlotNumber, SlotStatus FROM ParkingSlot WHERE SlotNumber = ?',
      [slotNumber]
    );
    if (slot.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking slot not found' });
    }
    if (slot[0].SlotStatus === 'Occupied') {
      return res.status(400).json({ success: false, message: 'Parking slot is already occupied' });
    }

    const actualEntryTime = entryTime || moment().format('YYYY-MM-DD HH:mm:ss');

    // Insert record
    const [result] = await db.execute(
      'INSERT INTO ParkingRecord (EntryTime, Car_PlateNumber, Slot_SlotNumber) VALUES (?, ?, ?)',
      [actualEntryTime, carPlateNumber, slotNumber]
    );

    // Mark slot as occupied
    await db.execute(
      'UPDATE ParkingSlot SET SlotStatus = "Occupied" WHERE SlotNumber = ?',
      [slotNumber]
    );

    res.status(201).json({
      success: true,
      message: 'Car parked successfully',
      data: {
        recordId: result.insertId,
        entryTime: actualEntryTime,
        carPlateNumber,
        slotNumber
      }
    });

  } catch (error) {
    console.error('POST record error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error parking car',
      error: error.message
    });
  }
});

// PUT record exit - /api/parkingrecords/:id/exit
router.put('/:id/exit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [record] = await db.execute(
      'SELECT EntryTime, Slot_SlotNumber, ExitTime FROM ParkingRecord WHERE RecordId = ?',
      [id]
    );

    if (record.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (record[0].ExitTime) {
      return res.status(400).json({ success: false, message: 'Exit already recorded' });
    }

    const entryTime = moment(record[0].EntryTime);
    const exitTime = moment();
    const durationMs = exitTime.diff(entryTime);
    const duration = Math.ceil(durationMs / (1000 * 60 * 60));
    const finalDuration = duration < 1 ? 1 : duration;

    await db.execute(
      'UPDATE ParkingRecord SET ExitTime = ?, Duration = ? WHERE RecordId = ?',
      [exitTime.format('YYYY-MM-DD HH:mm:ss'), finalDuration, id]
    );

    await db.execute(
      'UPDATE ParkingSlot SET SlotStatus = "Available" WHERE SlotNumber = ?',
      [record[0].Slot_SlotNumber]
    );

    res.json({
      success: true,
      message: 'Exit recorded',
      data: {
        recordId: id,
        duration: finalDuration,
        amountDue: finalDuration * 500
      }
    });

  } catch (error) {
    console.error('PUT exit error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error recording exit',
      error: error.message
    });
  }
});

// PUT update record - /api/parkingrecords/:id (with exitTime in body)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { exitTime } = req.body;

    if (!exitTime) {
      return res.status(400).json({ success: false, message: 'Exit time is required' });
    }

    const [record] = await db.execute(
      'SELECT EntryTime, Slot_SlotNumber FROM ParkingRecord WHERE RecordId = ?',
      [id]
    );

    if (record.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const entryTime = moment(record[0].EntryTime);
    const exit = moment(exitTime);

    if (exit.isBefore(entryTime)) {
      return res.status(400).json({
        success: false,
        message: 'Exit time cannot be before entry time'
      });
    }

    const durationMs = exit.diff(entryTime);
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
    const finalDuration = durationHours < 1 ? 1 : durationHours;
    const amountDue = finalDuration * 500;

    await db.execute(
      'UPDATE ParkingRecord SET ExitTime = ?, Duration = ? WHERE RecordId = ?',
      [exit.format('YYYY-MM-DD HH:mm:ss'), finalDuration, id]
    );

    await db.execute(
      'UPDATE ParkingSlot SET SlotStatus = "Available" WHERE SlotNumber = ?',
      [record[0].Slot_SlotNumber]
    );

    res.json({
      success: true,
      message: 'Exit recorded successfully',
      data: { recordId: id, durationHours: finalDuration, amountDue }
    });

  } catch (error) {
    console.error('PUT record error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error updating parking record',
      error: error.message
    });
  }
});

// DELETE record
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [record] = await db.execute(
      'SELECT Slot_SlotNumber, ExitTime FROM ParkingRecord WHERE RecordId = ?',
      [id]
    );

    if (record.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    // Delete related payments first – use the correct column name
    await db.execute('DELETE FROM Payment WHERE RecordId = ?', [id]);

    // Delete the parking record
    await db.execute('DELETE FROM ParkingRecord WHERE RecordId = ?', [id]);

    // Free the slot if the car was still parked (no exit time)
    if (!record[0].ExitTime) {
      await db.execute(
        'UPDATE ParkingSlot SET SlotStatus = "Available" WHERE SlotNumber = ?',
        [record[0].Slot_SlotNumber]
      );
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('DELETE record error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error deleting record',
      error: error.message
    });
  }
});

module.exports = router;