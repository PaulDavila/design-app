/**
 * Aplica db/migration_email_estado_programado.sql (ENUM estado + programado).
 * Uso: desde design-app/ → npm run migrate:email-estado
 */
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');

async function main() {
  const conn = await mysql.createConnection(resolveDbConfig());
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
