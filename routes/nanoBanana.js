/**
 * Generación de imagen vía Gemini API (Nano Banana / Nano Banana Pro).
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Referencias de personaje: hasta 5 PNG (Gemini 3 Pro Image — consistencia).
 *
 * Modelos típicos:
 * - gemini-3-pro-image-preview (Nano Banana Pro)
 * - gemini-3.1-flash-image-preview (Nano Banana 2)
 * - gemini-2.5-flash-image (Nano Banana)
 */

const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();

/** Orden fijo: archivos en storage/referencias-personajes */
const CHARACTER_SHEETS = [
  { file: 'man-blue.png', shortDesc: 'male worker, blue workwear' },
  { file: 'man-red.png', shortDesc: 'male worker, red workwear' },
  { file: 'woman-dress.png', shortDesc: 'female, dress' },
  { file: 'woman-green.png', shortDesc: 'female, green outfit' },
  { file: 'woman-pink.png', shortDesc: 'female, pink outfit' },
];

const CHARACTER_REF_DIR = path.join(__dirname, '..', 'storage', 'referencias-personajes');

/** undefined = no calculado; array tras primera resolución */
let cachedCharacterRefParts;

function resolveModelId() {
  return (
    process.env.NANO_BANANA_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    'gemini-3-pro-image-preview'
  );
}

function resolveApiUrl() {
  if (process.env.NANO_BANANA_API_URL) return process.env.NANO_BANANA_API_URL;
  const model = resolveModelId();
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function resolveApiKey() {
  return process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY || '';
}

function safeText(s, max = 8000) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Devuelve `#rrggbb` o `null` si no es un hex valido (3 o 6 digitos). */
function parseBackgroundHex(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const CAROUSEL_BACKGROUND_HEX = '#e9edef';
const FIXED_VARIATION_SEED = '1';
const EMAIL_ASPECT_RATIO = '21:9';

/** Reglas de estilo fijas (email y carrusel), entre BACKGROUND y CAST. */
const STYLE_RULES_BLOCK =
  'STYLE (always): Isometric illustration only; flat background as specified. Entire scene inset from all four edges—no element may reach the border. No crop, no bleed, no partial objects at edges or corners.';

function useCharacterRefImages() {
  const v = process.env.NANO_BANANA_USE_CHARACTER_REFS;
  if (v === '0' || v === 'false') return false;
  return true;
}

/**
 * Parts con inlineData (REST JSON camelCase) para cada PNG del elenco.
 * Cache en memoria tras la primera carga exitosa.
 */
function getCharacterRefImageParts() {
  if (cachedCharacterRefParts !== undefined) return cachedCharacterRefParts;
  if (!useCharacterRefImages()) {
    cachedCharacterRefParts = [];
    return cachedCharacterRefParts;
  }

  const parts = [];
  for (const { file } of CHARACTER_SHEETS) {
    const fp = path.join(CHARACTER_REF_DIR, file);
    if (!fs.existsSync(fp)) {
      console.warn(`[nanoBanana] Falta referencia de personaje: ${fp}`);
      continue;
    }
    const buf = fs.readFileSync(fp);
    const ext = path.extname(file).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/png';
    parts.push({
      inlineData: {
        mimeType,
        data: buf.toString('base64'),
      },
    });
  }

  cachedCharacterRefParts = parts;
  if (parts.length > 0 && parts.length < CHARACTER_SHEETS.length) {
    console.warn(
      `[nanoBanana] Solo ${parts.length}/${CHARACTER_SHEETS.length} referencias cargadas; conviene tener las 5.`,
    );
  }
  return parts;
}

function buildCastBlock(hasReferenceImages) {
  const roster = CHARACTER_SHEETS.map(
    (c, i) =>
      `Sheet ${i + 1} (${c.file}): ${c.shortDesc}.`,
  ).join(' ');

  const refLine = hasReferenceImages
    ? 'The PNG sheets above are the canonical look for each character (four isometric views per sheet: back-left, back-right, front-left, front-right). Match proportions, colors, and style exactly—do not redesign.'
    : 'Character reference images are unavailable on disk; still use only these five archetypes when describing people.';

  return [
    'CAST (locked): Only these five character designs may appear in the scene. Strict isometric projection only (no free perspective).',
    roster,
    refLine,
    'Do not invent any sixth person, face, body type, or outfit not listed above.',
    'How many people: If SCENE DESCRIPTION states a specific number, render exactly that many visible people—each must be one of these five designs.',
    'If the count is vague or fewer than five are needed, choose a random subset from these five.',
    'If more than five people are needed, repeat the same five designs (duplicate individuals allowed); never introduce a new character design.',
  ].join(' ');
}

/** Extrae base64 + mime de la respuesta REST de Gemini (camelCase y snake_case). */
function extractImageFromResponse(data) {
  if (!data || typeof data !== 'object') return null;

  const tryPart = (p) => {
    if (!p || typeof p !== 'object') return null;
    const inline = p.inlineData || p.inline_data;
    if (!inline || typeof inline !== 'object') return null;
    const raw = inline.data;
    if (typeof raw !== 'string' || !raw.length) return null;
    const mime =
      inline.mimeType ||
      inline.mime_type ||
      'image/png';
    return { b64: raw, mime };
  };

  const candidates = data.candidates;
  if (!Array.isArray(candidates)) return null;

  for (const c of candidates) {
    const parts = c.content?.parts || c.content?.Parts;
    if (!Array.isArray(parts)) continue;
    for (const p of parts) {
      const hit = tryPart(p);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Cuerpo REST alineado con la documentación oficial (generateContent + imageConfig).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
function buildRequestBody(prompt, ratio, backgroundHexParsed) {
  const imageSize = process.env.NANO_BANANA_IMAGE_SIZE || '1K';

  let aspectRatio;
  let headerBlock;

  if (backgroundHexParsed) {
    aspectRatio = EMAIL_ASPECT_RATIO;
    const { r, g, b } = hexToRgb(backgroundHexParsed);
    headerBlock = [
      `BACKGROUND (highest priority): one flat opaque fill only, exact ${backgroundHexParsed} rgb(${r}, ${g}, ${b}). No gradients, textures, patterns, checkerboard, or any other background color.`,
      `No color drift: the fill must remain visually identical to ${backgroundHexParsed} across the entire image.`,
      `Aspect ratio ${aspectRatio}, email asset; keep background ${backgroundHexParsed}.`,
      `Variation seed: ${FIXED_VARIATION_SEED}.`,
    ].join(' ');
  } else {
    aspectRatio = ratio === '4_5' ? '4:5' : '1:1';
    const { r, g, b } = hexToRgb(CAROUSEL_BACKGROUND_HEX);
    headerBlock = [
      `BACKGROUND (highest priority): one flat opaque fill only, exact ${CAROUSEL_BACKGROUND_HEX} rgb(${r}, ${g}, ${b}). No gradients, textures, patterns, checkerboard, or any other background color.`,
      `No color drift: the fill must remain visually identical to ${CAROUSEL_BACKGROUND_HEX} across the entire image.`,
      `Aspect ratio ${aspectRatio}, social carousel asset; keep background ${CAROUSEL_BACKGROUND_HEX}.`,
      `Variation seed: ${FIXED_VARIATION_SEED}.`,
    ].join(' ');
  }

  const refParts = getCharacterRefImageParts();
  const hasRefs = refParts.length > 0;
  const castBlock = buildCastBlock(hasRefs);

  const instructionText = [
    headerBlock,
    '',
    STYLE_RULES_BLOCK,
    '',
    castBlock,
    '',
    `SCENE DESCRIPTION: ${prompt}`,
  ].join('\n');

  const parts = [];
  if (hasRefs) {
    parts.push({
      text: 'REFERENCE INPUT: The next parts are exactly five PNG character sheets in fixed order. Each sheet is one approved character in strict isometric style with four turnaround views. Use only these designs for every human figure.',
    });
    parts.push(...refParts);
  }
  parts.push({ text: instructionText });

  return {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  };
}

async function callGeminiGenerateContent(body) {
  const url = resolveApiUrl();
  const key = resolveApiKey();
  if (!key) {
    const err = new Error('MISSING_KEY');
    err.code = 'MISSING_KEY';
    throw err;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  return { status: res.status, ok: res.ok, raw };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

router.post('/generate', async (req, res) => {
  try {
    const ratio = req.body?.ratio === '4_5' ? '4_5' : '1_1';
    const prompt = safeText(req.body?.prompt || '');
    const backgroundHexParsed = parseBackgroundHex(req.body?.backgroundHex);

    if (!prompt) {
      return res.status(400).json({ ok: false, error: 'Prompt vacío' });
    }

    const key = resolveApiKey();
    if (!key) {
      return res.status(500).json({
        ok: false,
        error: 'Falta API key. Configura GEMINI_API_KEY o NANO_BANANA_API_KEY en design-app/.env y reinicia el servidor.',
      });
    }

    const body = buildRequestBody(prompt, ratio, backgroundHexParsed);

    let attempt = 0;
    const maxAttempts = 2;
    let last = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      last = await callGeminiGenerateContent(body);

      if (last.ok) break;

      const is429 = last.status === 429;
      if (is429 && attempt < maxAttempts) {
        await sleep(4500);
        continue;
      }

      let detail = last.raw.slice(0, 800);
      try {
        const errJson = JSON.parse(last.raw);
        if (errJson?.error?.message) detail = String(errJson.error.message);
      } catch {
        /* mantener slice */
      }

      return res.status(502).json({
        ok: false,
        error: `Gemini (${last.status}): ${detail}`,
      });
    }

    let data = {};
    try {
      data = JSON.parse(last.raw);
    } catch {
      return res.status(502).json({
        ok: false,
        error: 'Respuesta de Gemini no es JSON válido.',
        debugPreview: last.raw.slice(0, 400),
      });
    }

    const extracted = extractImageFromResponse(data);
    if (extracted) {
      return res.json({
        ok: true,
        imageUrl: `data:${extracted.mime};base64,${extracted.b64}`,
      });
    }

    return res.status(502).json({
      ok: false,
      error:
        'Respuesta sin imagen en candidates[].content.parts (inlineData). Revisa el modelo y el prompt.',
      debugPreview: last.raw.slice(0, 500),
    });
  } catch (err) {
    if (err.code === 'MISSING_KEY') {
      return res.status(500).json({
        ok: false,
        error: 'Falta GEMINI_API_KEY en el backend.',
      });
    }
    res.status(500).json({
      ok: false,
      error: err.message || 'No se pudo generar la imagen',
    });
  }
});

module.exports = router;
