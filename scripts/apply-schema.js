/**
 * Aplica db/schema.sql (instalación nueva o alinear tablas con repo).
 * Railway: usa MYSQL* del plugin o DB_* si los definiste.
 * Uso: npm run db:schema
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');

async function main() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const conn = await mysql.createConnection({
    ...resolveDbConfig(),
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(sql);
    console.log('OK: schema aplicado desde', schemaPath);
  } catch (err) {
    console.error('Error aplicando schema:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
