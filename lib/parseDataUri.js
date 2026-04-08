/** Tamaño máximo imagen embebida (data URI) antes de rechazar — Gmail también limita el mensaje. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * @param {string} dataUri
 * @returns {{ mime: string, buffer: Buffer } | null}
 */
function parseDataUriBase64(dataUri) {
  const s = String(dataUri || '').trim();
  const m = s.match(/^data:([\w/+.-]+);base64,(.*)$/is);
  if (!m) return null;
  const mime = m[1].trim() || 'image/png';
  const b64 = m[2].replace(/\s/g, '');
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

/**
 * @param {string} dataUri
 * @returns {{ mime: string, buffer: Buffer } | null}
 * @throws {Error} si excede MAX_IMAGE_BYTES
 */
function parseDataUriForEmail(dataUri) {
  const parsed = parseDataUriBase64(dataUri);
  if (!parsed) return null;
  if (parsed.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `La imagen embebida supera el límite (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB) para envío por correo`
    );
  }
  return parsed;
}

module.exports = { parseDataUriBase64, parseDataUriForEmail, MAX_IMAGE_BYTES };
