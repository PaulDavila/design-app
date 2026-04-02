/**
 * Crea una imagen base de ejemplo (1080x1080) en storage/plantillas para probar /api/componer.
 * Ejecutar: node scripts/crear-imagen-base-ejemplo.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const outDir = path.join(__dirname, '..', 'storage', 'plantillas');
const outPath = path.join(outDir, 'base-ejemplo.png');

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const svg = `
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#f5f5f5"/>
      <rect x="40" y="40" width="1000" height="1000" fill="#fff" stroke="#ddd" stroke-width="2"/>
      <text x="540" y="520" text-anchor="middle" font-size="24" fill="#999">Imagen base de ejemplo — 1080×1080</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('Creada:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
