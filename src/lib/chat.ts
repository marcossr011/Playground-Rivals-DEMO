import { useCallback, useEffect, useState } from 'react';

export const REPORT_REASONS = [
  'Insultos u odio',
  'Acoso o amenazas',
  'Spam o publicidad',
  'Contenido inapropiado'
];

const keyFor = (scope: string) => `recreo.mute.${scope}`;

export function loadMutes(scope: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(keyFor(scope));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function useMutes(scope: string) {
  const [muted, setMuted] = useState<Set<string>>(() => loadMutes(scope));

  useEffect(() => {
    setMuted(loadMutes(scope));
  }, [scope]);

  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(scope), JSON.stringify([...muted]));
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [muted, scope]);

  const toggle = useCallback((id: string) => {
    setMuted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { muted, toggle, isMuted: (id: string) => muted.has(id) };
}
