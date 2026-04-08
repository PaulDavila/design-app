-- Añade rol administrativo para usuarios que programan sus propios envíos sin cola de revisión.
-- Aplicar con: npm run migrate:users-role (desde design-app/)

ALTER TABLE users
  MODIFY COLUMN role ENUM('user', 'admin', 'administrativo') NOT NULL DEFAULT 'user';
