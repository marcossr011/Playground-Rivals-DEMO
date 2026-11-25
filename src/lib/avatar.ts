import type { PlayerProfile } from '../types';

const IMAGE_AVATAR = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_AVATAR_CHARS = 200_000;

export function isImageAvatar(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_AVATAR_CHARS && IMAGE_AVATAR.test(value);
}

export function displayAvatar(profile: Pick<PlayerProfile, 'avatar' | 'photo'>): string {
  return isImageAvatar(profile.photo) ? profile.photo : profile.avatar;
}

export function networkAvatar(profile: Pick<PlayerProfile, 'avatar' | 'photoSmall'>): string {
  return isImageAvatar(profile.photoSmall) ? profile.photoSmall : profile.avatar;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer esa imagen. Prueba con JPG, PNG o WebP.'));
    };
    image.src = url;
  });
}

function squareJpeg(image: HTMLImageElement, size: number, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no puede procesar la foto.');
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;
  context.fillStyle = '#0b0d16';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function fileToAvatar(file: File): Promise<{ photo: string; photoSmall: string }> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('La foto pesa demasiado. Usa una de menos de 15 MB.');
  }
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('No se pudo leer esa imagen. Prueba con JPG, PNG o WebP.');
  }
  return {
    photo: squareJpeg(image, 256, 0.82),
    photoSmall: squareJpeg(image, 96, 0.72)
  };
}
