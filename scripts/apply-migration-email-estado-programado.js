/**
 * Aplica db/migration_email_estado_programado.sql (ENUM estado + programado).
 * Uso: desde design-app/ → npm run migrate:email-estado
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await conn.query(`
      ALTER TABLE email_envios_solicitud
        MODIFY COLUMN estado ENUM('pendiente_revision', 'programado') NOT NULL DEFAULT 'pendiente_revision'
    `);
    console.log('OK: email_envios_solicitud.estado admite programado. Ya puedes probar Programar / completar.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
