const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const STORAGE_PLANTILLAS = path.join(__dirname, '..', 'storage', 'plantillas');
const STORAGE_SALIDA = path.join(__dirname, '..', 'storage', 'salida');

/**
 * Genera un buffer SVG con texto para superponer.
 * @param {string} text - Texto a mostrar
 * @param {object} opts - { width, height, left, top, fontSize, color }
 */
function createTextSvg(text, opts = {}) {
  const w = opts.width || 800;
  const h = opts.height || 80;
  const fontSize = opts.fontSize || 48;
  const color = opts.color || '#000000';
  const safeText = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="${fontSize * 0.8}" font-size="${fontSize}" fill="${color}" font-family="Arial, sans-serif">${safeText}</text>
</svg>`;
  return Buffer.from(svg);
}

/**
 * Componer una imagen a partir de plantilla + datos.
 * @param {object} plantilla - { definicion, ruta_imagen_base }
 * @param {object} datos - Valores por id de capa: { titulo: "...", cuerpo: "...", imagen_1: "/ruta/o/base64" }
 * @param {object} options - { formato: 'png' | 'pdf', nombreSalida?: string }
 * @returns {Promise<{ path: string, buffer: Buffer }>}
 */
async function componer(plantilla, datos, options = {}) {
  const { definicion, ruta_imagen_base } = plantilla;
  const formato = (options.formato || 'png').toLowerCase();
  const dimensiones = definicion.dimensiones || { ancho: 1080, alto: 1080 };
  const ancho = dimensiones.ancho || 1080;
  const alto = dimensiones.alto || 1080;

  const basePath = path.join(STORAGE_PLANTILLAS, ruta_imagen_base);
  try {
    await fs.access(basePath);
  } catch (e) {
    throw new Error(`Imagen base no encontrada: ${ruta_imagen_base}`);
  }

  let image = sharp(basePath).resize(ancho, alto);

  const capas = definicion.capas || [];
  const composites = [];

  for (const capa of capas) {
    const valor = datos[capa.id];
    if (valor == null || valor === '') continue;

    const left = capa.left ?? 40;
    const top = capa.top ?? 100;

    if (capa.tipo === 'texto' || capa.tipo === 'texto_largo' || capa.tipo === 'titulo' || capa.tipo === 'cta' || capa.tipo === 'fecha') {
      const text = String(valor).slice(0, capa.maxCaracteres || 500);
      const w = capa.ancho ?? ancho - left - 40;
      const h = capa.alto ?? 120;
      const fontSize = capa.tamano ?? 48;
      const color = capa.color ?? '#000000';
      const svg = createTextSvg(text, { width: w, height: h, fontSize, color });
      composites.push({ input: svg, left, top });
    }

    if (capa.tipo === 'imagen' || capa.tipo === 'imagen_gemini' || capa.tipo === 'personaje') {
      let imgBuffer = null;
      if (Buffer.isBuffer(valor)) {
        imgBuffer = valor;
      } else if (typeof valor === 'string') {
        if (valor.startsWith('data:')) {
          const base64 = valor.split(',')[1];
          if (base64) imgBuffer = Buffer.from(base64, 'base64');
        } else {
          const ruta = path.isAbsolute(valor) ? valor : path.join(STORAGE_ASSETS, valor);
          try {
            imgBuffer = await fs.readFile(ruta);
          } catch (e) {
            console.warn('No se pudo cargar imagen para capa', capa.id, valor);
          }
        }
      }
      if (imgBuffer) {
        const w = capa.ancho || 400;
        const h = capa.alto || 400;
        const resized = await sharp(imgBuffer).resize(w, h, { fit: 'cover' }).toBuffer();
        composites.push({ input: resized, left, top });
      }
    }
  }

  if (composites.length > 0) {
    image = image.composite(composites);
  }

  const ext = formato === 'pdf' ? 'png' : (formato === 'jpg' || formato === 'jpeg' ? 'jpg' : 'png');
  const nombreSalida = options.nombreSalida || `comunicado_${Date.now()}.${ext}`;
  const salidaPath = path.join(STORAGE_SALIDA, nombreSalida);

  // PNG/JPG; PDF se puede añadir después con pdf-lib (embed PNG en una página)
  const buffer = ext === 'jpg' ? await image.jpeg().toBuffer() : await image.png().toBuffer();
  await fs.writeFile(salidaPath, buffer);
  return { path: salidaPath, buffer };
}

const STORAGE_ASSETS = path.join(__dirname, '..', 'storage', 'assets');

module.exports = { componer, createTextSvg, STORAGE_PLANTILLAS, STORAGE_SALIDA };
