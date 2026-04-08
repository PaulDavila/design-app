/**
 * Añade enviado_en y error_envio a email_envios_solicitud.
 * Uso: desde design-app/ → npm run migrate:email-envio-smtp
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
        ADD COLUMN enviado_en DATETIME NULL DEFAULT NULL AFTER updated_at,
        ADD COLUMN error_envio TEXT NULL DEFAULT NULL AFTER enviado_en
    `);
    console.log('OK: columnas enviado_en / error_envio añadidas.');
  } catch (err) {
    if (String(err.message).includes('Duplicate column')) {
      console.log('OK: columnas ya existían.');
    } else {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  } finally {
    await conn.end();
  }
}

main();
