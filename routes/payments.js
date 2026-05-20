const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../config/middleware/auth');
const router = express.Router();

const RATE_PER_HOUR = 500;

// GET all payments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        p.PaymentId,
        p.Amount,
        p.PaymentDate,
        p.RecordId,
        pr.Car_PlateNumber AS PlateNumber,
        pr.Slot_SlotNumber AS SlotNumber,
        pr.EntryTime,
        pr.ExitTime,
        pr.Duration,
        c.DriverName,
        c.PhoneNumber
      FROM Payment p
      LEFT JOIN ParkingRecord pr ON p.RecordId = pr.RecordId
      LEFT JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      ORDER BY p.PaymentDate DESC
    `);

    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('GET payments error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching payments', error: error.message });
  }
});

// GET unpaid records
router.get('/unpaid', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        pr.RecordId,
        pr.Car_PlateNumber AS PlateNumber,
        pr.Slot_SlotNumber AS SlotNumber,
        pr.EntryTime,
        pr.ExitTime,
        pr.Duration,
        c.DriverName,
        c.PhoneNumber,
        COALESCE(pr.Duration, 1) * 500 AS SuggestedAmount
      FROM ParkingRecord pr
      LEFT JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      LEFT JOIN Payment p ON pr.RecordId = p.RecordId
      WHERE pr.ExitTime IS NOT NULL 
      AND p.PaymentId IS NULL
      ORDER BY pr.ExitTime DESC
    `);

    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('GET unpaid error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching unpaid records', error: error.message });
  }
});

// POST payment - Admin enters the amount customer paid
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { recordId, amount } = req.body;

    if (!recordId) {
      return res.status(400).json({ success: false, message: 'Please select a parking record' });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter the amount paid by customer' });
    }

    // Get record
    const [records] = await db.execute(`
      SELECT pr.*, c.DriverName, c.PhoneNumber 
      FROM ParkingRecord pr
      LEFT JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      WHERE pr.RecordId = ?
    `, [recordId]);

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking record not found' });
    }

    const record = records[0];

    if (!record.ExitTime) {
      return res.status(400).json({ success: false, message: 'Car has not exited yet' });
    }

    // Check already paid
    const [existing] = await db.execute('SELECT PaymentId FROM Payment WHERE RecordId = ?', [recordId]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Already paid' });
    }

    const paidAmount = Number(amount);
    const duration = record.Duration || 1;
    const requiredAmount = duration * RATE_PER_HOUR;

    // Insert payment
    const [result] = await db.execute(
      'INSERT INTO Payment (Amount, RecordId) VALUES (?, ?)',
      [paidAmount, recordId]
    );

    const [newPayment] = await db.execute(
      'SELECT PaymentDate FROM Payment WHERE PaymentId = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: result.insertId,
        plateNumber: record.Car_PlateNumber,
        slotNumber: record.Slot_SlotNumber,
        driverName: record.DriverName,
        phoneNumber: record.PhoneNumber,
        entryTime: record.EntryTime,
        exitTime: record.ExitTime,
        duration: duration,
        requiredAmount: requiredAmount,
        amountPaid: paidAmount,
        change: paidAmount > requiredAmount ? paidAmount - requiredAmount : 0,
        balance: paidAmount < requiredAmount ? requiredAmount - paidAmount : 0,
        paymentDate: newPayment[0]?.PaymentDate || new Date(),
        rate: RATE_PER_HOUR
      }
    });

  } catch (error) {
    console.error('POST payment error:', error.message);
    res.status(500).json({ success: false, message: 'Error processing payment', error: error.message });
  }
});

module.exports = router;