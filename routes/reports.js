const express = require('express');
const moment = require('moment');
const db = require('../config/database');
const { authenticateToken } = require('../config/middleware/auth');
const router = express.Router();

// GET bill for specific record
router.get('/bill/:recordId', authenticateToken, async (req, res) => {
  try {
    const { recordId } = req.params;

    const [rows] = await db.execute(`
      SELECT 
        c.PlateNumber,
        c.DriverName,
        c.PhoneNumber,
        pr.EntryTime,
        pr.ExitTime,
        pr.Duration,
        p.Amount AS AmountPaid,
        p.PaymentDate,
        COALESCE(pr.Duration, 0) * 500 AS AmountDue
      FROM ParkingRecord pr
      JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      LEFT JOIN Payment p ON pr.RecordId = p.RecordId
      WHERE pr.RecordId = ?
    `, [recordId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({
      success: true,
      data: { ...rows[0], parkingFeeRate: '500 RWF per hour' }
    });

  } catch (error) {
    console.error('Bill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error generating bill',
      error: error.message
    });
  }
});

// GET daily report
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const reportDate = req.query.date || moment().format('YYYY-MM-DD');

    const [rows] = await db.execute(`
      SELECT 
        c.PlateNumber,
        pr.EntryTime,
        pr.ExitTime,
        pr.Duration,
        COALESCE(p.Amount, COALESCE(pr.Duration, 0) * 500) AS AmountPaid,
        p.PaymentDate
      FROM ParkingRecord pr
      JOIN Car c ON pr.Car_PlateNumber = c.PlateNumber
      LEFT JOIN Payment p ON pr.RecordId = p.RecordId
      WHERE DATE(pr.EntryTime) = ?
      ORDER BY pr.EntryTime DESC
    `, [reportDate]);

    const totalRevenue = rows.reduce((s, r) => s + Number(r.AmountPaid || 0), 0);
    const totalHours = rows.reduce((s, r) => s + Number(r.Duration || 0), 0);

    res.json({
      success: true,
      date: reportDate,
      data: rows,
      count: rows.length,
      summary: {
        totalCars: rows.length,
        totalHours,
        totalRevenue,
        averagePerCar: rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0
      }
    });

  } catch (error) {
    console.error('Daily report error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
});

module.exports = router;