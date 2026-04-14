/**
 * Utilidades para preparar el clon de html2canvas.
 * Solo inlining de imágenes (SVG→PNG raster). Nada más.
 */

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(new Error('FileReader'))
    fr.readAsDataURL(blob)
  })
}

/**
 * html2canvas 1.4 renderiza mal <img src="...svg">; rasterizar a PNG lo resuelve.
 * Imágenes no-SVG se convierten a data URL directamente.
 */
async function blobToDataUrlForCanvas(blob, mimeHint, imgEl) {
  const mime = (mimeHint || blob.type || '').toLowerCase()
  const isSvg = mime.includes('svg') || mime.includes('image/svg')
  if (!isSvg) return readBlobAsDataUrl(blob)

  const wBox = Math.max(2, imgEl.offsetWidth || imgEl.width || 1080)
  const hBox = Math.max(2, imgEl.offsetHeight || imgEl.height || 1080)
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = (err) => reject(err || new Error('svg img load'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(4096, Math.max(wBox, image.naturalWidth || wBox))
    canvas.height = Math.min(4096, Math.max(hBox, image.naturalHeight || hBox))
    const ctx = canvas.getContext('2d')
    if (!ctx) return readBlobAsDataUrl(blob)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return readBlobAsDataUrl(blob)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Convierte cada <img> del clon a data URL (SVG → PNG raster, resto → data: blob).
 * Esto evita problemas CORS y de renderizado SVG en html2canvas.
 */
export async function inlineRasterImagesAsDataUrls(root) {
  if (!root?.querySelectorAll) return
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      try {
        const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
        if (!res.ok) return
        const blob = await res.blob()
        if (!blob || blob.size === 0) return
        const mime = res.headers.get('content-type') || blob.type || ''
        const dataUrl = await blobToDataUrlForCanvas(blob, mime, img)
        if (!dataUrl.startsWith('data:')) return
        img.removeAttribute('crossorigin')
        img.src = dataUrl
        await img.decode().catch(() => {})
      } catch (e) {
        console.warn('[carrusel jpg] inline img omitido:', src.slice(0, 120), e)
      }
    }),
  )
}
