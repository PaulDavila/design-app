require('dotenv').config();
const mysql = require('mysql2/promise');

function resolveDbConfig() {
  if (process.env.MYSQLHOST && process.env.MYSQLUSER) {
    return {
      host: process.env.MYSQLHOST,
      port: parseInt(process.env.MYSQLPORT, 10) || 3306,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD || '',
      database: process.env.MYSQLDATABASE,
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

const pool = mysql.createPool({
  ...resolveDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    return true;
  } catch (err) {
    console.error('Error conectando a MySQL:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection, resolveDbConfig };
