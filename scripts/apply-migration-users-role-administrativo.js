/**
 * Aplica db/migration_users_role_administrativo.sql (ENUM role + administrativo).
 * Uso: desde design-app/ → npm run migrate:users-role
 */
require('dotenv').config()
const mysql = require('mysql2/promise')

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })
  try {
    await conn.query(`
      ALTER TABLE users
        MODIFY COLUMN role ENUM('user', 'admin', 'administrativo') NOT NULL DEFAULT 'user'
    `)
    console.log('OK: users.role admite administrativo. Asigna role en MySQL y alinea VITE_USER_ID.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exitCode = 1
  } finally {
    await conn.end()
  }
}

main()
