import { useEffect, useRef, useState } from 'react';
import type { GameMeta } from '../../types';
import { uid } from '../../lib/random';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { Joystick } from '../../components/Joystick';
import { useApp } from '../../state/AppContext';
import { useCountdown, useGameReport, useKeyboard, useSwipe, type Direction } from '../hooks';

/* ───────────────────────────── Serpiente ───────────────────────────── */

const SNAKE_SIZE = 15;

function spawnFood(snake: number[]): number {
  const occupied = new Set(snake);
  const options: number[] = [];
  for (let index = 0; index < SNAKE_SIZE * SNAKE_SIZE; index++) if (!occupied.has(index)) options.push(index);
  return options[Math.floor(Math.random() * options.length)] ?? 0;
}

export function SnakeGame({ meta }: { meta: GameMeta }) {
  const { state } = useApp();
  const config = meta.config as { speed?: number; wrap?: boolean };
  const speed = config.speed ?? 145;
  const wrap = Boolean(config.wrap);
  const [round, setRound] = useState(0);
  const [snake, setSnake] = useState(() => [7 * SNAKE_SIZE + 7, 7 * SNAKE_SIZE + 6, 7 * SNAKE_SIZE + 5]);
  const [dir, setDir] = useState<Direction>('right');
  const [food, setFood] = useState(() => 7 * SNAKE_SIZE + 11);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  useEffect(() => {
    if (!started || dead) return;
    const timer = window.setTimeout(() => {
      const head = snake[0];
      const row = Math.floor(head / SNAKE_SIZE);
      const col = head % SNAKE_SIZE;
      const nextRow = dir === 'up' ? row - 1 : dir === 'down' ? row + 1 : row;
      const nextCol = dir === 'left' ? col - 1 : dir === 'right' ? col + 1 : col;
      let hitWall = nextRow < 0 || nextCol < 0 || nextRow >= SNAKE_SIZE || nextCol >= SNAKE_SIZE;
      let next = nextRow * SNAKE_SIZE + nextCol;
      if (hitWall && wrap) {
        next = ((nextRow + SNAKE_SIZE) % SNAKE_SIZE) * SNAKE_SIZE + ((nextCol + SNAKE_SIZE) % SNAKE_SIZE);
        hitWall = false;
      }
      if (hitWall || snake.slice(0, -1).includes(next)) {
        setDead(true);
        setResultOpen(true);
        setStarted(false);
        sfx.lose();
        vibrate([50, 40, 80]);
        report({ score, won: false });
        return;
      }
      const eat = next === food;
      const nextSnake = [next, ...(eat ? snake : snake.slice(0, -1))];
      setSnake(nextSnake);
      if (eat) {
        const nextScore = score + 10;
        setScore(nextScore);
        setBest((value) => Math.max(value, nextScore));
        setFood(spawnFood(nextSnake));
        sfx.match();
      }
    }, speed);
    return () => window.clearTimeout(timer);
  }, [snake, dir, food, started, dead, speed, wrap, score, report]);

  const turn = (nextDir: Direction) => {
    if (!started || dead) return;
    const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (opposite[nextDir] === dir) return;
    setDir(nextDir);
  };

  useKeyboard((key) => {
    if (key === 'ArrowUp' || key === 'w') turn('up');
    if (key === 'ArrowDown' || key === 's') turn('down');
    if (key === 'ArrowLeft' || key === 'a') turn('left');
    if (key === 'ArrowRight' || key === 'd') turn('right');
  }, started && !dead);

  const swipe = useSwipe<HTMLDivElement>(turn);

  const restart = () => {
    resetReport();
    setSnake([7 * SNAKE_SIZE + 7, 7 * SNAKE_SIZE + 6, 7 * SNAKE_SIZE + 5]);
    setDir('right');
    setFood(7 * SNAKE_SIZE + 11);
    setScore(0);
    setDead(false);
    setStarted(true);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🍎 {score}</span>
        <span className="hud-chip">🏆 {best}</span>
        <span className="hud-chip">{wrap ? '🌀 Portal' : '🧱 Muros'}</span>
      </div>

      <div className="snake-board" style={{ gridTemplateColumns: `repeat(${SNAKE_SIZE}, 1fr)` }} {...swipe}>
        {Array.from({ length: SNAKE_SIZE * SNAKE_SIZE }).map((_, index) => {
          const bodyIndex = snake.indexOf(index);
          const isHead = bodyIndex === 0;
          return (
            <div
              key={`${round}-${index}`}
              className={`snake-cell ${bodyIndex >= 0 ? 'is-body' : ''} ${isHead ? 'is-head' : ''} ${index === food ? 'is-food' : ''}`}
            >
              {index === food ? '🍎' : isHead ? '🙂' : ''}
            </div>
          );
        })}
      </div>

      {!started && !dead ? (
        <button type="button" className="btn btn-primary btn-wide" onClick={() => setStarted(true)}>
          Empezar a mover
        </button>
      ) : null}

      {state.controls === 'joystick' ? <Joystick onDirection={turn} label="Joystick compartido" /> : null}

      <div className="maze-pad">
        <button type="button" className="chip" onClick={() => turn('up')}>↑</button>
        <div>
          <button type="button" className="chip" onClick={() => turn('left')}>←</button>
          <button type="button" className="chip" onClick={() => turn('down')}>↓</button>
          <button type="button" className="chip" onClick={() => turn('right')}>→</button>
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>{dead ? 'Jugar otra vez' : 'Reiniciar'}</button>
      </div>
      <p className="engine-tip">
        Come manzanas y crece sin chocar contigo mismo. {state.controls === 'joystick' ? 'Arrastra el joystick o desliza sobre el tablero.' : 'Desliza sobre el tablero o usa las flechas.'}
      </p>

      <ResultOverlay
        open={resultOpen}
        emoji="🐍"
        title="¡Choque!"
        subtitle={`${score} puntos · ${snake.length} segmentos`}
        score={score}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Secuencia de colores ───────────────────────────── */

const SIMON_COLORS = ['verde', 'rojo', 'amarillo', 'azul'];

export function SimonGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { speed?: number; start?: number };
  const speed = config.speed ?? 750;
  const startLength = config.start ?? 3;
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'over'>('idle');
  const [showIndex, setShowIndex] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [inputIndex, setInputIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  useEffect(() => {
    if (phase !== 'showing') return;
    if (showIndex >= sequence.length) {
      const timer = window.setTimeout(() => {
        setActive(null);
        setPhase('input');
        setInputIndex(0);
      }, Math.max(260, speed * 0.45));
      return () => window.clearTimeout(timer);
    }
    setActive(sequence[showIndex]);
    const off = window.setTimeout(() => setActive(null), speed * 0.55);
    const next = window.setTimeout(() => setShowIndex((index) => index + 1), speed);
    return () => {
      window.clearTimeout(off);
      window.clearTimeout(next);
    };
  }, [phase, showIndex, sequence, speed]);

  const start = () => {
    resetReport();
    const next = Array.from({ length: startLength }, () => Math.floor(Math.random() * 4));
    setSequence(next);
    setShowIndex(0);
    setPhase('showing');
    setCompleted(0);
    setInputIndex(0);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const press = (pad: number) => {
    if (phase !== 'input') return;
    sfx.select();
    setActive(pad);
    window.setTimeout(() => setActive(null), 140);
    if (pad !== sequence[inputIndex]) {
      setPhase('over');
      setResultOpen(true);
      sfx.lose();
      report({ score: completed * 100, won: completed > 0 });
      return;
    }
    if (inputIndex + 1 >= sequence.length) {
      const nextSequence = [...sequence, Math.floor(Math.random() * 4)];
      setCompleted((value) => value + 1);
      setSequence(nextSequence);
      setShowIndex(0);
      setPhase('showing');
      sfx.win();
    } else {
      setInputIndex((index) => index + 1);
    }
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🎨 {sequence.length} pasos</span>
        <span className="hud-chip">✅ {completed} rondas</span>
        <span className="hud-chip">{phase === 'input' ? 'Tu turno' : phase === 'showing' ? 'Observa…' : 'Listo'}</span>
      </div>

      <div className={`simon-board ${phase === 'showing' ? 'is-locked' : ''}`}>
        {SIMON_COLORS.map((color, index) => (
          <button
            key={color}
            type="button"
            className={`simon-pad pad-${index} ${active === index ? 'is-active' : ''}`}
            onClick={() => press(index)}
            disabled={phase !== 'input'}
            aria-label={color}
          />
        ))}
        <span className="simon-center">{phase === 'idle' ? '▶' : phase === 'showing' ? '👀' : phase === 'input' ? '✋' : '💥'}</span>
      </div>

      <div className="game-actions">
        {phase === 'idle' || phase === 'over' ? (
          <button type="button" className="btn btn-primary" onClick={start}>Empezar</button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={start}>Reiniciar ronda</button>
        )}
      </div>
      <p className="engine-tip">Mira la secuencia de colores y repítela en el mismo orden. Cada ronda añade un paso más.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🎨"
        title={completed ? 'Secuencia fallada' : 'Casi'}
        subtitle={`Completaste ${completed} ${completed === 1 ? 'ronda' : 'rondas'}`}
        score={completed * 100}
        onRetry={start}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Reflejos ───────────────────────────── */

export function ReactionGame({ meta }: { meta: GameMeta }) {
  const rounds = (meta.config as { rounds?: number }).rounds ?? 5;
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'go' | 'result' | 'over'>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [early, setEarly] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const startedAt = useRef(0);
  const { report, resetReport } = useGameReport(meta);
  const timeout = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'waiting') return;
    timeout.current = window.setTimeout(() => {
      setPhase('go');
      startedAt.current = performance.now();
    }, 900 + Math.random() * 1800);
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current);
    };
  }, [phase]);

  const finish = (list: number[]) => {
    setPhase('over');
    setResultOpen(true);
    const average = list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
    const score = Math.max(50, Math.round(1200 - average));
    sfx[score > 500 ? 'win' : 'lose']();
    report({ score, won: score > 500 });
  };

  const advance = (list: number[]) => {
    window.setTimeout(() => {
      if (list.length >= rounds) {
        finish(list);
      } else {
        setEarly(false);
        setLast(null);
        setPhase('waiting');
      }
    }, 750);
  };

  const tap = () => {
    if (phase === 'idle') {
      setTimes([]);
      setLast(null);
      setEarly(false);
      setPhase('waiting');
      return;
    }
    if (phase === 'waiting') {
      setEarly(true);
      setPhase('result');
      const list = [...times, 800];
      setTimes(list);
      setLast(800);
      sfx.error();
      advance(list);
      return;
    }
    if (phase === 'go') {
      const value = Math.round(performance.now() - startedAt.current);
      const list = [...times, value];
      setTimes(list);
      setLast(value);
      setPhase('result');
      sfx.match();
      vibrate(10);
      advance(list);
    }
  };

  const average = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;
  const best = times.length ? Math.min(...times) : 0;

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🎯 {times.length}/{rounds}</span>
        <span className="hud-chip">📊 Media {average} ms</span>
        <span className="hud-chip">⚡ Mejor {best || '—'}</span>
      </div>

      <button
        type="button"
        className={`reaction-pad phase-${phase} ${early ? 'is-early' : ''}`}
        onClick={tap}
      >
        <span className="reaction-emoji">
          {phase === 'idle' ? '👆' : phase === 'waiting' ? '🕓' : phase === 'go' ? '⚡' : phase === 'over' ? '🏁' : early ? '🐣' : '✅'}
        </span>
        <span className="reaction-title">
          {phase === 'idle'
            ? 'Toca para empezar'
            : phase === 'waiting'
              ? 'Espera el verde…'
              : phase === 'go'
                ? '¡TOCA YA!'
                : phase === 'over'
                  ? 'Ronda terminada'
                  : early
                    ? 'Te adelantaste (+800 ms)'
                    : `${last} ms`}
        </span>
        <span className="reaction-sub">
          {phase === 'idle' ? `${rounds} rondas de reflejos` : phase === 'waiting' ? 'No toques todavía' : phase === 'go' ? 'Ahora mismo' : 'Siguiente ronda en un momento'}
        </span>
      </button>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={() => { setPhase('idle'); setTimes([]); setLast(null); setEarly(false); }}>Reiniciar</button>
      </div>
      <p className="engine-tip">Espera a que el panel se ponga verde y toca lo antes posible. Si tocas antes, se suma una penalización.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="⚡"
        title="Reflejos medidos"
        subtitle={`Media ${average} ms · mejor ${best} ms`}
        score={Math.max(50, Math.round(1200 - average))}
        scoreLabel="puntos"
        onRetry={() => { resetReport(); setResultOpen(false); setPhase('idle'); setTimes([]); setLast(null); setEarly(false); }}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Topos ───────────────────────────── */

export function WhackGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; seconds?: number; speed?: number };
  const size = config.size ?? 3;
  const seconds = config.seconds ?? 30;
  const speed = config.speed ?? 900;
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [mole, setMole] = useState(-1);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const { remaining, progress } = useCountdown(seconds, running && !done, round, () => {
    setRunning(false);
    setDone(true);
    setMole(-1);
    setResultOpen(true);
    sfx.alarm();
    report({ score: hits * 10, won: hits >= 5 });
  });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setMole(Math.floor(Math.random() * size * size));
    }, speed);
    return () => window.clearInterval(timer);
  }, [running, speed, size]);

  const tap = (index: number) => {
    if (!running) return;
    if (index === mole) {
      setHits((value) => value + 1);
      setMole(-1);
      sfx.match();
      vibrate(12);
    } else {
      setMisses((value) => value + 1);
      sfx.tick();
    }
  };

  const start = () => {
    resetReport();
    setHits(0);
    setMisses(0);
    setMole(-1);
    setDone(false);
    setResultOpen(false);
    setRunning(true);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🔨 {hits}</span>
        <span className="hud-chip">❌ {misses}</span>
        <span className={`hud-chip ${remaining < 8 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="whack-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, index) => (
          <button key={`${round}-${index}`} type="button" className={`whack-hole ${mole === index ? 'is-mole' : ''}`} onClick={() => tap(index)} disabled={!running}>
            <span>{mole === index ? '🐹' : '🕳️'}</span>
          </button>
        ))}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-primary" onClick={start}>{running ? 'Reiniciar' : 'Jugar'}</button>
      </div>
      <p className="engine-tip">Golpea a los topos cuando asomen. Cada topo vale 10 puntos durante {seconds} segundos.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🔨"
        title="¡Se acabó el tiempo!"
        subtitle={`${hits} topos · ${misses} fallos`}
        score={hits * 10}
        onRetry={start}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Puntería ───────────────────────────── */

interface AimTarget {
  id: string;
  x: number;
  y: number;
  born: number;
}

export function AimGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { seconds?: number; size?: number };
  const seconds = config.seconds ?? 30;
  const targetSize = config.size ?? 46;
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [targets, setTargets] = useState<AimTarget[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { report, resetReport } = useGameReport(meta);
  const { remaining, progress } = useCountdown(seconds, running && !done, round, () => {
    setRunning(false);
    setDone(true);
    setTargets([]);
    setResultOpen(true);
    sfx.alarm();
    report({ score: hits * 10, won: hits >= 8 });
  });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);
      setTargets((current) => {
        const alive = current.filter((target) => stamp - target.born < 1500);
        if (alive.length < 3) {
          alive.push({
            id: uid('t'),
            x: 8 + Math.random() * 80,
            y: 10 + Math.random() * 72,
            born: stamp
          });
        }
        return alive;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [running]);

  const start = () => {
    resetReport();
    setHits(0);
    setMisses(0);
    setTargets([]);
    setDone(false);
    setResultOpen(false);
    setRunning(true);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🎯 {hits}</span>
        <span className="hud-chip">❌ {misses}</span>
        <span className={`hud-chip ${remaining < 8 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div
        className="aim-board"
        onClick={() => {
          if (running) {
            setMisses((value) => value + 1);
          }
        }}
      >
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            className="aim-target"
            style={{ left: `${target.x}%`, top: `${target.y}%`, width: targetSize, height: targetSize }}
            onClick={(event) => {
              event.stopPropagation();
              setTargets((current) => current.filter((item) => item.id !== target.id));
              setHits((value) => value + 1);
              sfx.match();
              vibrate(8);
            }}
            aria-label="Diana"
          >
            <span style={{ opacity: Math.max(0.3, 1 - (now - target.born) / 1500) }}>🎯</span>
          </button>
        ))}
        {!running ? (
          <div className="aim-overlay">
            <span className="start-emoji">🎯</span>
            <p>{done ? `¡${hits} dianas!` : `Toca ${targetSize <= 30 ? 'las dianas pequeñas' : 'las dianas'} sin fallar`}</p>
            <button type="button" className="btn btn-primary" onClick={(event) => { event.stopPropagation(); start(); }}>
              {done ? 'Jugar otra vez' : 'Empezar'}
            </button>
          </div>
        ) : null}
      </div>

      <p className="engine-tip">Toca las dianas antes de que desaparezcan. Cada diana vale 10 puntos. Los clics fuera restan precisión.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🎯"
        title="¡Tiempo!"
        subtitle={`${hits} dianas · ${misses} fallos`}
        score={hits * 10}
        onRetry={start}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
