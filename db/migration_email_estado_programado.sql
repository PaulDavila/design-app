-- Añade estado programado (revisado por admin) para calendario verde/ámbar en Home.
-- mysql ... < db/migration_email_estado_programado.sql

ALTER TABLE email_envios_solicitud
  MODIFY COLUMN estado ENUM('pendiente_revision', 'programado') NOT NULL DEFAULT 'pendiente_revision';
