import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, '..', 'public');
const out = path.join(publicDir, 'icons');
await mkdir(out, { recursive: true });

const mark = path.join(publicDir, 'recreo-mark.svg');
const maskable = path.join(publicDir, 'maskable.svg');

await sharp(mark).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
await sharp(mark).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
await sharp(maskable).resize(512, 512).png().toFile(path.join(out, 'maskable-512.png'));
await sharp(maskable).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));

console.log('Icons generated in public/icons');
