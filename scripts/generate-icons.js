// Run with: node scripts/generate-icons.js
// Generates public/icon-192.png and public/icon-512.png from public/splitceipt-icon.svg
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const svg = readFileSync(join(root, 'public', 'splitceipt-icon.svg'))

for (const size of [192, 512]) {
  const outPath = join(root, 'public', `icon-${size}.png`)
  await sharp(svg, { density: Math.ceil((size / 1254) * 72 * 4) })
    .resize(size, size, { fit: 'contain', background: { r: 245, g: 242, b: 236, alpha: 1 } })
    .png()
    .toFile(outPath)
  console.log(`✓ icon-${size}.png`)
}
