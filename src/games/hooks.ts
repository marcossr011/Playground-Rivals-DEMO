import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMeta } from '../types';
import { useApp } from '../state/AppContext';
import { clearRandomSession, readRandomSession } from '../lib/randomSession';

export interface GameSession {
  report: (result: { score?: number; won?: boolean }) => void;
  resetReport: () => void;
}

export function useGameReport(meta: GameMeta): GameSession {
  const { recordResult, recordLeagueResult } = useApp();
  const reported = useRef(false);

  const report = useCallback(
    (result: { score?: number; won?: boolean }) => {
      if (reported.current) return;
      reported.current = true;
      recordResult(meta.family, result);
      const random = readRandomSession();
      if (random) {
        recordLeagueResult(Boolean(result.won));
        clearRandomSession();
      }
    },
    [meta.family, recordResult, recordLeagueResult]
  );

  const resetReport = useCallback(() => {
    reported.current = false;
  }, []);

  return { report, resetReport };
}

export function useCountdown(seconds: number, active: boolean, resetKey: number, onEnd?: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    setRemaining(seconds);
    if (!active) return;
    const start = performance.now();
    let fired = false;
    const id = window.setInterval(() => {
      const next = Math.max(0, seconds - (performance.now() - start) / 1000);
      setRemaining(next);
      if (next <= 0 && !fired) {
        fired = true;
        window.clearInterval(id);
        onEndRef.current?.();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, active, resetKey]);

  return { remaining, progress: seconds > 0 ? remaining / seconds : 0 };
}

export function useStopwatch(running: boolean, resetKey = 0) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    if (!running) return;
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [running, resetKey]);

  return seconds;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export function useSwipe<T extends HTMLElement>(onSwipe: (direction: Direction) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const callback = useRef(onSwipe);
  callback.current = onSwipe;

  const onPointerDown = (event: React.PointerEvent<T>) => {
    start.current = { x: event.clientX, y: event.clientY };
  };

  const finish = (event: React.PointerEvent<T>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) callback.current(dx > 0 ? 'right' : 'left');
    else callback.current(dy > 0 ? 'down' : 'up');
  };

  return {
    onPointerDown,
    onPointerUp: finish,
    onPointerCancel: () => {
      start.current = null;
    }
  };
}

export function useKeyboard(handler: (key: string) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      ref.current(event.key);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active]);
}
