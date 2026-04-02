/**
 * Rellena 17 plantillas: emails, newsletter (1), redes (3 carrusel + 1 imagen + 6 portadas).
 * npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const BASE = 'bases/base.png';
const THUMB = 'miniaturas/miniaturas.png';

function def(ancho, alto, extra = {}) {
  return JSON.stringify({
    dimensiones: { ancho, alto },
    capas: [],
    ...extra,
  });
}

/** Email 1 — editor HTML (paletas fijas; ver client/src/emailPalettes.js) */
const EMAIL1_FONDO = ['#dfe3e6', '#c4dce9', '#e1edd2', '#ecdfc3', '#efddeb', '#ebd2cb'];
const EMAIL1_IMG = ['#80beda', '#b4d173', '#e4c97d', '#d593c0', '#d7796b'];

function defEmail1() {
  return JSON.stringify({
    dimensiones: { ancho: 600, alto: 2400 },
    tipoPlantilla: 'email_html',
    email1: {
      paletaFondoCorreo: EMAIL1_FONDO,
      paletaCuadroImagen: EMAIL1_IMG,
      logoRuta: 'miniaturas/logo-abc-logistica.svg',
    },
    capas: [],
  });
}

function buildRows() {
  const rows = [];

  // Avisos / comunicados / email: 6 plantillas (1–4 numeradas; Cumpleaños; Aniversarios) + miniaturas propias
  const avisosEmails = [
    { nombre: 'Email 1', layout_indice: 1, grupo_layout: 'email_1', ruta_miniatura: 'miniaturas/email-1.png' },
    { nombre: 'Email 2', layout_indice: 2, grupo_layout: 'email_2', ruta_miniatura: 'miniaturas/email-2.png' },
    { nombre: 'Email 3', layout_indice: 3, grupo_layout: 'email_3', ruta_miniatura: 'miniaturas/email-3.png' },
    { nombre: 'Email 4', layout_indice: 4, grupo_layout: 'email_4', ruta_miniatura: 'miniaturas/email-4.png' },
    {
      nombre: 'Cumpleaños',
      layout_indice: 5,
      grupo_layout: 'email_5',
      ruta_miniatura: 'miniaturas/email-cumpleanos.png',
    },
    {
      nombre: 'Aniversarios',
      layout_indice: 6,
      grupo_layout: 'email_6',
      ruta_miniatura: 'miniaturas/email-aniversarios.png',
    },
  ];
  for (const a of avisosEmails) {
    rows.push({
      nombre: a.nombre,
      tipo: 'avisos_comunicados_emails',
      categoria: 'avisos_comunicados_emails',
      red_social: null,
      formato_redes: null,
      layout_indice: a.layout_indice,
      ratio_variante: null,
      grupo_layout: a.grupo_layout,
      definicion: a.grupo_layout === 'email_1' ? defEmail1() : def(600, 1200),
      ruta_imagen_base: BASE,
      ruta_miniatura: a.ruta_miniatura,
    });
  }

  rows.push({
    nombre: 'Newsletter 1',
    tipo: 'newsletter',
    categoria: 'newsletter',
    red_social: null,
    formato_redes: null,
    layout_indice: 1,
    ratio_variante: null,
    grupo_layout: 'newsletter_1',
    definicion: def(600, 1200),
    ruta_imagen_base: BASE,
    ruta_miniatura: 'miniaturas/newsletter.png',
  });

  // Redes — carrusel: tres opciones (mismas plantillas para todas las redes, sin red_social)
  const carruselNota = { notaCarrusel: 'Fase 3+: número de diapositivas 1–20' };
  rows.push({
    nombre: 'Carusel 1',
    tipo: 'redes_sociales',
    categoria: 'redes_sociales',
    red_social: null,
    formato_redes: 'carrusel',
    layout_indice: 1,
    ratio_variante: null,
    grupo_layout: 'carrusel_1',
    definicion: def(1080, 1080, {
      ...carruselNota,
      carrusel1: { ratiosSoportados: ['1_1', '4_5'], ratioDefault: '1_1' },
    }),
    ruta_imagen_base: BASE,
    ruta_miniatura: 'miniaturas/carrusel-14.png',
  });
  rows.push({
    nombre: 'Carusel 2',
    tipo: 'redes_sociales',
    categoria: 'redes_sociales',
    red_social: null,
    formato_redes: 'carrusel',
    layout_indice: 2,
    ratio_variante: null,
    grupo_layout: 'carrusel_2',
    definicion: def(1080, 1080, carruselNota),
    ruta_imagen_base: BASE,
    ruta_miniatura: 'miniaturas/carrusel-16.png',
  });
  rows.push({
    nombre: 'Carrusel Numerado',
    tipo: 'redes_sociales',
    categoria: 'redes_sociales',
    red_social: null,
    formato_redes: 'carrusel',
    layout_indice: 3,
    ratio_variante: null,
    grupo_layout: 'carrusel_numerado',
    definicion: def(1080, 1080, carruselNota),
    ruta_imagen_base: BASE,
    ruta_miniatura: 'miniaturas/carrusel-15.png',
  });
  rows.push({
    nombre: 'Imagen 1',
    tipo: 'redes_sociales',
    categoria: 'redes_sociales',
    red_social: null,
    formato_redes: 'imagen',
    layout_indice: 1,
    ratio_variante: null,
    grupo_layout: 'imagen_1',
    definicion: def(1080, 1080, { ratios: ['1:1', '9:16'] }),
    ruta_imagen_base: BASE,
    ruta_miniatura: 'miniaturas/imagen.png',
  });

  // Portadas redes sociales (globales, sin red_social)
  const thumbsRedes = [
    'miniaturas/portadas redes-24.png',
    'miniaturas/portadas redes-23.png',
    'miniaturas/portadas redes-22.png',
  ];
  for (let i = 0; i < 3; i++) {
    rows.push({
      nombre: `Portada ${i + 1}`,
      tipo: 'redes_sociales',
      categoria: 'redes_sociales',
      red_social: null,
      formato_redes: 'portadas_redes_sociales',
      layout_indice: i + 1,
      ratio_variante: null,
      grupo_layout: `portada_redes_${i + 1}`,
      definicion: def(1584, 396),
      ruta_imagen_base: BASE,
      ruta_miniatura: thumbsRedes[i],
    });
  }
  const thumbsGoogle = [
    'miniaturas/portadas google-19.png',
    'miniaturas/portadas google-20.png',
    'miniaturas/portadas google-21.png',
  ];
  for (let i = 0; i < 3; i++) {
    rows.push({
      nombre: `Portada ${i + 1}`,
      tipo: 'redes_sociales',
      categoria: 'redes_sociales',
      red_social: null,
      formato_redes: 'portadas_google_forms',
      layout_indice: i + 1,
      ratio_variante: null,
      grupo_layout: `portada_google_${i + 1}`,
      definicion: def(1600, 400),
      ruta_imagen_base: BASE,
      ruta_miniatura: thumbsGoogle[i],
    });
  }

  return rows.map((r, i) => ({
    ...r,
    id_externo: `tpl_${String(i + 1).padStart(6, '0')}`,
  }));
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DELETE FROM plantillas_favoritas');
    await conn.query('DELETE FROM comunicados');
    await conn.query('DELETE FROM plantillas');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const rows = buildRows();
    const sql = `INSERT INTO plantillas (
      id_externo, nombre, tipo, categoria, red_social, formato_redes, layout_indice, ratio_variante, grupo_layout,
      definicion, ruta_imagen_base, ruta_miniatura, activo
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`;

    for (const r of rows) {
      await conn.query(sql, [
        r.id_externo,
        r.nombre,
        r.tipo,
        r.categoria,
        r.red_social,
        r.formato_redes,
        r.layout_indice,
        r.ratio_variante,
        r.grupo_layout,
        r.definicion,
        r.ruta_imagen_base,
        r.ruta_miniatura,
      ]);
    }

    // Usuario de prueba para favoritos (auth Opción A)
    await conn.query(
      `INSERT IGNORE INTO users (id, email, nombre) VALUES (1, 'demo@design.local', 'Usuario demo')`
    );

    console.log(`Insertadas ${rows.length} plantillas (id_externo opacos tpl_000001…).`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
