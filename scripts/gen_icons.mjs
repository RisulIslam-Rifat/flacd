// Generates the PWA icons (192x192 and 512x512) as PNGs.
// Uses sharp (already a dependency) to compose a simple amber/orange
// rounded-square icon with a white "music note" silhouette.

import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

// A music note drawn as an SVG path. Composed over a rounded amber gradient
// background to create the icon.
function svgFor(size) {
  const noteSize = size * 0.55
  const cx = size / 2
  const cy = size / 2
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="55%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
    <radialGradient id="hl" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.45)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" ry="${size * 0.22}" fill="url(#bg)" />
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" ry="${size * 0.22}" fill="url(#hl)" />

  <!-- Music note silhouette -->
  <g transform="translate(${cx - noteSize * 0.32}, ${cy - noteSize * 0.42}) scale(${noteSize / 100})" fill="white">
    <!-- Vertical stem -->
    <rect x="55" y="0" width="10" height="80" rx="2" />
    <!-- Top flag -->
    <path d="M 55 0 Q 90 6 95 30 Q 100 50 75 55 L 75 45 Q 90 42 85 25 Q 80 12 55 14 Z" />
    <!-- Bottom note head -->
    <ellipse cx="35" cy="80" rx="22" ry="14" transform="rotate(-15 35 80)" />
  </g>
</svg>
`
}

async function main() {
  await sharp(Buffer.from(svgFor(512)))
    .png()
    .toFile(join(outDir, 'icon-512.png'))

  await sharp(Buffer.from(svgFor(192)))
    .png()
    .toFile(join(outDir, 'icon-192.png'))

  console.log('Generated icons:')
  console.log('  public/icons/icon-192.png')
  console.log('  public/icons/icon-512.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
