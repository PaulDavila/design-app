-- Email 1: roles + cola de revisión (ejecutar una vez)
-- mysql -h ... -u ... -p TU_BASE < db/migration_email_revision.sql
-- Si `role` ya existe, omitir el ALTER de users o ajustar manualmente.

SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER nombre;

-- Usuarios demo (ajusta emails si ya existen otros ids)
INSERT IGNORE INTO users (id, email, nombre, activo, role) VALUES
  (1, 'admin@local', 'Administrador', 1, 'admin'),
  (2, 'usuario@local', 'Usuario', 1, 'user');

UPDATE users SET role = 'admin' WHERE id = 1;
UPDATE users SET role = 'user' WHERE id = 2 AND email = 'usuario@local';

CREATE TABLE IF NOT EXISTS email_envios_solicitud (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plantilla_id INT UNSIGNED NOT NULL,
  creado_por_user_id INT UNSIGNED NOT NULL,
  editor_tipo VARCHAR(32) NOT NULL DEFAULT 'email1',
  payload JSON NOT NULL,
  enviar_todos TINYINT(1) NOT NULL DEFAULT 1,
  destinatarios TEXT NULL,
  fecha_hora_programada DATETIME NOT NULL,
  estado ENUM('pendiente_revision', 'programado') NOT NULL DEFAULT 'pendiente_revision',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_estado (estado),
  KEY idx_fecha_prog (fecha_hora_programada),
  KEY idx_creador (creado_por_user_id),
  CONSTRAINT fk_ees_plantilla FOREIGN KEY (plantilla_id) REFERENCES plantillas (id) ON DELETE CASCADE,
  CONSTRAINT fk_ees_user FOREIGN KEY (creado_por_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
