/**
 * Crea o actualiza users.id 1, 2 y 3 para coincidir con la app:
 * - id 1: usuario (URL sin ?e1_uid — usa VITE_USER_ID o 1 por defecto)
 * - id 2: admin (?e1_uid=2&e1_role=admin)
 * - id 3: administrativo (?e1_uid=3&e1_role=administrativo)
 *
 * El servidor usa users.role en MySQL para /completar; la URL solo ajusta X-User-Id + UI.
 * Uso: npm run ensure:users-123   (Railway Shell o local)
 */
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');

const USERS_123 = [
  { id: 1, email: 'usuario@abc-design.local', nombre: 'Usuario', role: 'user' },
  { id: 2, email: 'admin@abc-design.local', nombre: 'Administrador', role: 'admin' },
  {
    id: 3,
    email: 'administrativo@abc-design.local',
    nombre: 'Administrativo',
    role: 'administrativo',
  },
];

async function ensureUsers123(conn) {
  for (const u of USERS_123) {
    await conn.query(
      `INSERT INTO users (id, email, nombre, role, activo)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         nombre = VALUES(nombre),
         role = VALUES(role),
         activo = 1`,
      [u.id, u.email, u.nombre, u.role]
    );
  }
}

async function main() {
  const conn = await mysql.createConnection(resolveDbConfig());
  try {
    await ensureUsers123(conn);
    const [rows] = await conn.query(
      'SELECT id, email, nombre, role, activo FROM users WHERE id IN (1,2,3) ORDER BY id'
    );
    console.log('OK: usuarios 1–3 listos:');
    console.table(rows);
  } catch (err) {
    if (String(err.message).includes('Duplicate entry') && String(err.message).includes('uk_email')) {
      console.error(
        'Error: algún email de usuario@abc-design.local / admin@ / administrativo@ ya está en OTRO id.'
      );
      console.error('Revisa: SELECT id, email FROM users; y cambia emails duplicados o ajusta este script.');
    }
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

module.exports = { ensureUsers123, USERS_123 };

if (require.main === module) {
  main();
}
