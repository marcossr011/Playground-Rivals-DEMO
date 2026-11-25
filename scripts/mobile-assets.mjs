import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, '..', 'public');
const resources = path.join(root, '..', 'resources');
await mkdir(resources, { recursive: true });

const maskable = path.join(publicDir, 'maskable.svg');
const mark = path.join(publicDir, 'recreo-mark.svg');

// Icono legacy y de tienda: marca sobre fondo oscuro a sangre.
await sharp(maskable).resize(1024, 1024).png().toFile(path.join(resources, 'icon.png'));

const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1A1030"/>
      <stop offset="1" stop-color="#0B0D16"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`;

const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF8A5C"/>
      <stop offset="0.55" stop-color="#FF5D8F"/>
      <stop offset="1" stop-color="#7B61FF"/>
    </linearGradient>
  </defs>
  <g transform="translate(256 256) scale(0.78) translate(-256 -248)">
    <circle cx="256" cy="248" r="168" fill="url(#blob)"/>
    <path d="M256 108c14 0 21 8 26 22l23 66c5 14 12 21 26 26l66 23c14 5 22 12 22 26s-8 21-22 26l-66 23c-14 5-21 12-26 26l-23 66c-5 14-12 22-26 22s-21-8-26-22l-23-66c-5-14-12-21-26-26l-66-23c-14-5-22-12-22-26s8-21 22-26l66-23c14-5 21-12 26-26l23-66c5-14 12-22 26-22Z" fill="#FFF7ED"/>
    <circle cx="352" cy="160" r="26" fill="#42E2A6"/>
  </g>
</svg>`;

await sharp(Buffer.from(backgroundSvg)).png().toFile(path.join(resources, 'icon-background.png'));
await sharp(Buffer.from(foregroundSvg)).resize(1024, 1024).png().toFile(path.join(resources, 'icon-foreground.png'));

const logo = await sharp(mark).resize(720, 720).png().toBuffer();
const splash = await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: '#080A12' }
})
  .composite([{ input: logo, gravity: 'centre' }])
  .png()
  .toBuffer();
await sharp(splash).toFile(path.join(resources, 'splash.png'));
await sharp(splash).toFile(path.join(resources, 'splash-dark.png'));

console.log('Recursos móviles generados en resources/');
