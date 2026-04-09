/**
 * Alias: ahora asegura usuarios 1, 2 y 3 (igual que npm run ensure:users-123).
 * Uso: npm run ensure:demo-user
 */
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');
const { ensureUsers123 } = require('./ensure-users-123');

async function main() {
  const conn = await mysql.createConnection(resolveDbConfig());
  try {
    await ensureUsers123(conn);
    const [rows] = await conn.query(
      'SELECT id, email, role FROM users WHERE id IN (1,2,3) ORDER BY id'
    );
    console.log('OK (usuarios 1–3):');
    console.table(rows);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
