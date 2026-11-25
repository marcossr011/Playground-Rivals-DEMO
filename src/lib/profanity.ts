import type { ProfanityLevel } from '../types';

const HARD = [
  'hijodeputa',
  'hijoputa',
  'gilipollas',
  'cabron',
  'cabrona',
  'maricon',
  'maricona',
  'subnormal',
  'retrasado',
  'retrasada',
  'pendejo',
  'pendeja',
  'culero',
  'culera',
  'verga',
  'zorra',
  'puta',
  'puto',
  'coño',
  'joder',
  'jodete',
  'mierda',
  'hostia',
  'capullo',
  'capulla'
];

const SOFT = ['idiota', 'imbecil', 'estupido', 'estupida', 'tonto', 'tonta', 'tarado', 'tarada', 'inutil', 'asqueroso', 'asquerosa', 'menso', 'mensa'];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const listFor = (level: ProfanityLevel): string[] => {
  if (level === 'off') return [];
  if (level === 'strict') return [...HARD, ...SOFT];
  return HARD;
};

function mask(word: string): string {
  const letters = Array.from(word);
  if (letters.length <= 2) return '•'.repeat(letters.length);
  return letters[0] + '•'.repeat(letters.length - 1);
}

export function filterProfanity(text: string, level: ProfanityLevel): string {
  const blocked = listFor(level);
  if (!blocked.length || !text) return text;
  const normalized = normalize(text);
  const tokens: { start: number; end: number }[] = [];
  for (const word of blocked) {
    let from = 0;
    while (from < normalized.length) {
      const at = normalized.indexOf(word, from);
      if (at < 0) break;
      const before = at === 0 ? '' : normalized[at - 1];
      const after = normalized[at + word.length] ?? '';
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) tokens.push({ start: at, end: at + word.length });
      from = at + word.length;
    }
  }
  if (!tokens.length) return text;
  tokens.sort((a, b) => a.start - b.start);
  let output = '';
  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) continue;
    output += text.slice(cursor, token.start);
    output += mask(text.slice(token.start, token.end));
    cursor = token.end;
  }
  output += text.slice(cursor);
  return output;
}

export const PROFANITY_OPTIONS: { id: ProfanityLevel; label: string; help: string }[] = [
  { id: 'off', label: 'Sin filtro', help: 'Los mensajes se muestran tal cual.' },
  { id: 'soft', label: 'Suave', help: 'Tapa los insultos más fuertes.' },
  { id: 'strict', label: 'Estricto', help: 'Tapa también los insultos leves.' }
];
