import type { Category } from '../types';

const KEY = 'recreo.random.session';

export interface RandomSession {
  mode: 'bots' | 'people';
  category: Category | 'Todas';
  level: 'facil' | 'normal' | 'dificil';
  format: '1v1' | 'tournament';
}

export function rememberRandomSession(session: RandomSession): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function readRandomSession(): RandomSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RandomSession>;
    if (parsed.mode !== 'bots' && parsed.mode !== 'people') return null;
    return {
      mode: parsed.mode,
      category: parsed.category ?? 'Todas',
      level: parsed.level === 'facil' || parsed.level === 'dificil' ? parsed.level : 'normal',
      format: parsed.format === 'tournament' ? 'tournament' : '1v1'
    };
  } catch {
    return null;
  }
}

export function clearRandomSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function friendCodeFor(profileId: string): string {
  const clean = profileId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return (clean.slice(-6) || 'RECREO').padEnd(6, 'X');
}
