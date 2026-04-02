-- Design App — esquema completo (Sprint 1 + Fase 2)
-- Nueva instalación: mysql -u design_app -p design_comunicados < db/schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) DEFAULT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plantillas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_externo VARCHAR(128) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(64) NOT NULL,
  categoria VARCHAR(64) NOT NULL DEFAULT 'legacy',
  red_social VARCHAR(32) NULL DEFAULT NULL,
  formato_redes VARCHAR(32) NULL DEFAULT NULL,
  layout_indice TINYINT UNSIGNED NULL DEFAULT NULL,
  ratio_variante VARCHAR(32) NULL DEFAULT NULL,
  grupo_layout VARCHAR(64) NULL DEFAULT NULL,
  definicion JSON NOT NULL,
  ruta_imagen_base VARCHAR(512) NOT NULL,
  ruta_miniatura VARCHAR(512) NOT NULL DEFAULT 'miniaturas/miniaturas.png',
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_id_externo (id_externo),
  KEY idx_categoria (categoria),
  KEY idx_red_formato (red_social, formato_redes),
  KEY idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS comunicados (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED DEFAULT NULL,
  plantilla_id INT UNSIGNED NOT NULL,
  datos JSON NOT NULL,
  estado ENUM('borrador','generado') DEFAULT 'borrador',
  ruta_salida VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_usuario (usuario_id),
  KEY idx_plantilla (plantilla_id),
  KEY idx_estado (estado),
  CONSTRAINT fk_comunicados_usuario FOREIGN KEY (usuario_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_comunicados_plantilla FOREIGN KEY (plantilla_id) REFERENCES plantillas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
