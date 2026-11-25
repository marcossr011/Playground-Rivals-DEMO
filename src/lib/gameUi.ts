import type { GameMeta } from '../types';

const TONES: Record<string, string> = {
  Puzzle: 'tone-puzzle',
  Cartas: 'tone-cards',
  Palabras: 'tone-words',
  Trivia: 'tone-trivia',
  Arcade: 'tone-arcade',
  Estrategia: 'tone-estrategia',
  Fiesta: 'tone-fiesta',
  'Aire libre': 'tone-aire'
};

export function categoryTone(category: string): string {
  return TONES[category] ?? 'tone-puzzle';
}

export function primaryMode(meta: GameMeta): string {
  if (meta.modes.includes('online')) return 'Salas online';
  if (meta.modes.includes('local')) return meta.players;
  return '1 jugador';
}

export function gameHref(meta: GameMeta): string {
  if (meta.family === 'outdoor') return `/vida-real/${String(meta.config.outdoorId ?? meta.id)}`;
  return `/juego/${meta.id}`;
}
