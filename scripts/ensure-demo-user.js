/**
 * Garantiza users.id=1 para X-User-Id / VITE_USER_ID por defecto.
 * INSERT IGNORE puede no crear la fila si otro id ya usa el mismo email.
 * Uso: npm run ensure:demo-user  (Railway Shell o local)
 */
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');

async function main() {
  const conn = await mysql.createConnection(resolveDbConfig());
  try {
    await conn.query(
      `INSERT INTO users (id, email, nombre, role, activo)
       VALUES (1, 'demo@design.local', 'Usuario demo', 'user', 1)
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         email = VALUES(email),
         role = VALUES(role),
         activo = VALUES(activo)`
    );
    const [rows] = await conn.query('SELECT id, email, role FROM users WHERE id = 1');
    console.log('OK: usuario demo para API:', rows[0]);
  } catch (err) {
    if (String(err.message).includes('Duplicate entry') && String(err.message).includes('uk_email')) {
      console.error(
        'Error: el email demo@design.local ya está en otro users.id. Actualiza ese email en MySQL o borra la fila conflictiva, luego vuelve a ejecutar este script.'
      );
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    console.error(err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
