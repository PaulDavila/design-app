/**
 * Inserta la plantilla Reconocimientos si no existe (BD sembrada antes de añadirla al seed).
 * Uso: desde design-app/ → npm run migrate:plantilla-reconocimientos
 */
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../config/db');

const ID_EXTERNO = 'tpl_reconocimientos_1';
const BASE = 'bases/base.png';

function def600x1200() {
  return JSON.stringify({
    dimensiones: { ancho: 600, alto: 1200 },
    capas: [],
  });
}

async function main() {
  const conn = await mysql.createConnection(resolveDbConfig());
  try {
    const [rows] = await conn.query(
      `SELECT id FROM plantillas
       WHERE grupo_layout = ? OR nombre = ? OR id_externo = ?
       LIMIT 1`,
      ['reconocimientos_1', 'Reconocimientos', ID_EXTERNO]
    );
    if (rows.length > 0) {
      console.log('OK: plantilla Reconocimientos ya existe (omitido).');
      return;
    }

    await conn.query(
      `INSERT INTO plantillas (
        id_externo, nombre, tipo, categoria, red_social, formato_redes,
        layout_indice, ratio_variante, grupo_layout,
        definicion, ruta_imagen_base, ruta_miniatura, activo
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        ID_EXTERNO,
        'Reconocimientos',
        'avisos_comunicados_emails',
        'avisos_comunicados_emails',
        null,
        null,
        7,
        null,
        'reconocimientos_1',
        def600x1200(),
        BASE,
        'miniaturas/email-aniversarios.png',
      ]
    );
    console.log('OK: plantilla Reconocimientos insertada.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
