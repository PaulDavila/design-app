-- Fase 2: columnas de catálogo + favoritos (ejecutar una vez)
-- mysql -u design_app -p design_comunicados < db/migration_fase2.sql

SET NAMES utf8mb4;

-- Si ya existen las columnas, este ALTER fallará: ignorar esas líneas o ejecutar manualmente lo que falte.

ALTER TABLE plantillas
  ADD COLUMN categoria VARCHAR(64) NOT NULL DEFAULT 'legacy' AFTER nombre,
  ADD COLUMN red_social VARCHAR(32) NULL DEFAULT NULL AFTER categoria,
  ADD COLUMN formato_redes VARCHAR(32) NULL DEFAULT NULL AFTER red_social,
  ADD COLUMN layout_indice TINYINT UNSIGNED NULL DEFAULT NULL AFTER formato_redes,
  ADD COLUMN ratio_variante VARCHAR(32) NULL DEFAULT NULL AFTER layout_indice,
  ADD COLUMN grupo_layout VARCHAR(64) NULL DEFAULT NULL AFTER ratio_variante,
  ADD COLUMN ruta_miniatura VARCHAR(512) NOT NULL DEFAULT 'miniaturas/miniaturas.png' AFTER ruta_imagen_base;

CREATE TABLE IF NOT EXISTS plantillas_favoritas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  plantilla_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_plantilla (usuario_id, plantilla_id),
  KEY idx_usuario (usuario_id),
  KEY idx_plantilla (plantilla_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (usuario_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_plantilla FOREIGN KEY (plantilla_id) REFERENCES plantillas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
