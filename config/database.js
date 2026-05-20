const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pssms4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function createDatabaseAndTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS pssms4`);
    await connection.query(`USE pssms4`);
    await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);

    // ✅ User table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS User (
        UserId INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(50) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ✅ Car table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Car (
        PlateNumber VARCHAR(20) PRIMARY KEY,
        DriverName VARCHAR(100) NOT NULL,
        PhoneNumber VARCHAR(15) NOT NULL,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ✅ ParkingSlot table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ParkingSlot (
        SlotNumber VARCHAR(10) PRIMARY KEY,
        SlotStatus ENUM('Available', 'Occupied') DEFAULT 'Available',
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ✅ ParkingRecord table - NO foreign keys
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ParkingRecord (
        RecordId INT AUTO_INCREMENT PRIMARY KEY,
        PlateNumber VARCHAR(20) NOT NULL,
        SlotNumber VARCHAR(10) NOT NULL,
        EntryTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ExitTime TIMESTAMP NULL
      ) ENGINE=InnoDB
    `);

    // ✅ Payment table - NO foreign keys
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Payment (
        PaymentId INT AUTO_INCREMENT PRIMARY KEY,
        RecordId INT NOT NULL,
        Amount DECIMAL(10,2) NOT NULL,
        PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);

    // ✅ Create default admin
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.query(`
      INSERT IGNORE INTO User (Username, Password) 
      VALUES ('admin', ?)
    `, [hashedPassword]);

    console.log('✅ MySQL Database Connected Successfully');
    console.log('✅ All tables created successfully');
    console.log('✅ Default admin: username=admin password=admin123');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  } finally {
    await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
    await connection.end();
  }
}

createDatabaseAndTables();

module.exports = pool;