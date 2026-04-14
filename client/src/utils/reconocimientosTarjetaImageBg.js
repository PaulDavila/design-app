/**
 * Gemini suele devolver fondo blanco opaco (#fff) aunque el prompt pida #f8fafc.
 * Sustituye píxeles casi blancos (RGB >= minChannel) por el gris de la tarjeta.
 * Solo usar en imágenes de tarjeta Reconocimientos (no en héroes ni otros).
 */

const RECO_R = 248
const RECO_G = 250
const RECO_B = 252
const DEFAULT_MIN_CHANNEL = 253

/**
 * @param {string} dataUrl - data:image/png|jpeg;base64,...
 * @param {{ minChannel?: number }} [opts]
 * @returns {Promise<string>} data URL JPEG
 */
export async function postProcessRecoTarjetaImageDataUrl(dataUrl, opts = {}) {
  const src = String(dataUrl || '').trim()
  if (!src.startsWith('data:')) return src
  const minChannel =
    typeof opts.minChannel === 'number' && Number.isFinite(opts.minChannel)
      ? Math.min(255, Math.max(240, Math.floor(opts.minChannel)))
      : DEFAULT_MIN_CHANNEL

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('reco tarjeta img load'))
    img.src = src
  })

  const w = Math.max(1, img.naturalWidth || img.width)
  const h = Math.max(1, img.naturalHeight || img.height)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= minChannel && d[i + 1] >= minChannel && d[i + 2] >= minChannel) {
      d[i] = RECO_R
      d[i + 1] = RECO_G
      d[i + 2] = RECO_B
      d[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
