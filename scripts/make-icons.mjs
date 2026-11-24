// Genera los iconos PNG (web, Android, iOS) y la imagen destacada de Google Play a partir de public/icon.svg.
// Uso: npm i -D sharp && node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('public/icon.svg');
await mkdir('public/icons', { recursive: true });
await mkdir('store', { recursive: true });

for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
// Icono "maskable": el dibujo más pequeño y fondo a sangre para que Android pueda recortarlo en círculo.
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#1450a3"/></svg>`;
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp(Buffer.from(bg)).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/icons/maskable-512.png');

// Tiendas: icono 1024 (App Store) y 512 (Google Play) sin transparencia.
await sharp(svg).resize(1024, 1024).flatten({ background: '#1450a3' }).png().toFile('store/icon-1024.png');
await sharp(svg).resize(512, 512).flatten({ background: '#1450a3' }).png().toFile('store/play-icon-512.png');

// Imagen destacada de Google Play (1024 × 500).
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <rect width="1024" height="500" fill="#1450a3"/>
  <text x="400" y="215" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="800" fill="#fff">Surtidor</text>
  <text x="402" y="285" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#dbe6ff">La gasolinera más barata, cerca de ti</text>
  <g transform="translate(402 320)">
    <rect width="150" height="64" rx="12" fill="#168c4b"/><text x="75" y="44" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="#fff">1,429</text>
    <rect x="166" width="150" height="64" rx="12" fill="#fff"/><text x="241" y="44" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="#14171c">1,519</text>
    <rect x="332" width="150" height="64" rx="12" fill="#fff"/><text x="407" y="44" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="#cd2d28">1,649</text>
  </g>
</svg>`;
const icon = await sharp(svg).resize(300, 300).png().toBuffer();
await sharp(Buffer.from(feature)).composite([{ input: icon, left: 60, top: 100 }]).png().toFile('store/play-feature-1024x500.png');
await writeFile('store/README.txt', 'Imágenes para las fichas de Google Play y App Store. Las capturas de pantalla hazlas desde el móvil con la app abierta.\n');
console.log('Iconos generados en public/icons y store/');
