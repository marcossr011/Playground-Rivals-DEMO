import { useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { formatClock } from '../../lib/random';
import { sfx } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { Joystick } from '../../components/Joystick';
import { useApp } from '../../state/AppContext';
import { useGameReport, useKeyboard, useStopwatch, useSwipe, type Direction } from '../hooks';

/* ───────────────────────────── Laberinto ───────────────────────────── */

function carveMaze(size: number): number[] {
  const grid = Array<number>(size * size).fill(1);
  const stack: number[][] = [[1, 1]];
  grid[1 * size + 1] = 0;
  const directions = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0]
  ];
  while (stack.length) {
    const [row, col] = stack[stack.length - 1];
    const options = directions
      .map(([dx, dy]) => [row + dy, col + dx])
      .filter(([r, c]) => r > 0 && c > 0 && r < size - 1 && c < size - 1 && grid[r * size + c] === 1);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nextRow, nextCol] = options[Math.floor(Math.random() * options.length)];
    grid[((row + nextRow) / 2) * size + (col + nextCol) / 2] = 0;
    grid[nextRow * size + nextCol] = 0;
    stack.push([nextRow, nextCol]);
  }
  return grid;
}

export function MazeGame({ meta }: { meta: GameMeta }) {
  const { state } = useApp();
  const config = meta.config as { size?: number; fog?: number };
  const size = config.size ?? 13;
  const fog = config.fog ?? 0;
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState(() => carveMaze(size));
  const [position, setPosition] = useState(1 * size + 1);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([1 * size + 1]));
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done, round);
  const exit = (size - 2) * size + (size - 2);
  const radius = fog === 1 ? 5 : fog === 2 ? 2 : size;

  const move = (direction: Direction) => {
    if (done) return;
    const row = Math.floor(position / size);
    const col = position % size;
    const nextRow = direction === 'up' ? row - 1 : direction === 'down' ? row + 1 : row;
    const nextCol = direction === 'left' ? col - 1 : direction === 'right' ? col + 1 : col;
    if (nextRow < 0 || nextCol < 0 || nextRow >= size || nextCol >= size) return;
    const next = nextRow * size + nextCol;
    if (grid[next] === 1) {
      sfx.tick();
      return;
    }
    setPosition(next);
    setVisited((current) => {
      const copy = new Set(current);
      copy.add(next);
      return copy;
    });
    setMoves((value) => value + 1);
    sfx.tap();
    if (next === exit) {
      setDone(true);
      setResultOpen(true);
      sfx.win();
      report({ score: Math.max(120, 1500 - seconds * 3 - moves * 5), won: true });
    }
  };

  useKeyboard((key) => {
    if (key === 'ArrowUp' || key === 'w') move('up');
    if (key === 'ArrowDown' || key === 's') move('down');
    if (key === 'ArrowLeft' || key === 'a') move('left');
    if (key === 'ArrowRight' || key === 'd') move('right');
  }, !done);

  const swipe = useSwipe<HTMLDivElement>(move);

  const restart = () => {
    resetReport();
    setGrid(carveMaze(size));
    setPosition(1 * size + 1);
    setVisited(new Set([1 * size + 1]));
    setMoves(0);
    setDone(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const hidden = useMemo(() => {
    if (!fog) return new Set<number>();
    const playerRow = Math.floor(position / size);
    const playerCol = position % size;
    const set = new Set<number>();
    for (let index = 0; index < grid.length; index++) {
      if (visited.has(index)) continue;
      const row = Math.floor(index / size);
      const col = index % size;
      if (Math.abs(row - playerRow) + Math.abs(col - playerCol) > radius) set.add(index);
    }
    return set;
  }, [fog, position, size, grid, visited, radius]);

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">👣 {moves}</span>
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
        <span className="hud-chip">{fog === 0 ? '👁️ Vista completa' : fog === 1 ? '🌫️ Niebla media' : '🌫️ Niebla densa'}</span>
      </div>

      <div
        className="maze-board"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        {...swipe}
        aria-label="Laberinto"
      >
        {grid.map((cell, index) => {
          const isWall = cell === 1;
          const isPlayer = index === position;
          const isExit = index === exit;
          return (
            <div
              key={`${round}-${index}`}
              className={`maze-cell ${isWall ? 'is-wall' : 'is-path'} ${visited.has(index) ? 'is-visited' : ''} ${
                hidden.has(index) ? 'is-fog' : ''
              }`}
            >
              {isPlayer ? '🙂' : isExit ? '🏁' : ''}
            </div>
          );
        })}
      </div>

      {state.controls === 'joystick' ? <Joystick onDirection={move} label="Joystick compartido" /> : null}

      <div className="maze-pad">
        <button type="button" className="chip" onClick={() => move('up')} aria-label="Arriba">↑</button>
        <div>
          <button type="button" className="chip" onClick={() => move('left')} aria-label="Izquierda">←</button>
          <button type="button" className="chip" onClick={() => move('down')} aria-label="Abajo">↓</button>
          <button type="button" className="chip" onClick={() => move('right')} aria-label="Derecha">→</button>
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nuevo laberinto</button>
      </div>
      <p className="engine-tip">
        {state.controls === 'joystick' ? 'Arrastra el joystick o desliza el dedo' : 'Desliza el dedo o usa las flechas'} para moverte. La meta está en la esquina opuesta. {fog ? 'Con niebla, solo recuerdas lo que ya has visto.' : ''}
      </p>

      <ResultOverlay
        open={resultOpen}
        emoji="🏁"
        title="¡Saliste del laberinto!"
        subtitle={`${moves} pasos · ${formatClock(seconds)}`}
        score={Math.max(120, 1500 - seconds * 3 - moves * 5)}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Luces fuera ───────────────────────────── */

function scrambleLights(size: number, presses: number): boolean[] {
  const lights = Array<boolean>(size * size).fill(true);
  const total = size * size;
  for (let step = 0; step < presses; step++) {
    const index = Math.floor(Math.random() * total);
    const row = Math.floor(index / size);
    const col = index % size;
    const affected = [index];
    if (row > 0) affected.push(index - size);
    if (row < size - 1) affected.push(index + size);
    if (col > 0) affected.push(index - 1);
    if (col < size - 1) affected.push(index + 1);
    for (const item of affected) lights[item] = !lights[item];
  }
  if (lights.every((light) => !light)) return scrambleLights(size, presses);
  return lights;
}

export function LightsOutGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; scramble?: number };
  const size = config.size ?? 4;
  const presses = config.scramble ?? 12;
  const [round, setRound] = useState(0);
  const [lights, setLights] = useState<boolean[]>(() => scrambleLights(size, presses));
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done, round);

  const toggle = (index: number) => {
    if (done) return;
    const row = Math.floor(index / size);
    const col = index % size;
    const affected = [index];
    if (row > 0) affected.push(index - size);
    if (row < size - 1) affected.push(index + size);
    if (col > 0) affected.push(index - 1);
    if (col < size - 1) affected.push(index + 1);
    const next = [...lights];
    for (const item of affected) next[item] = !next[item];
    setLights(next);
    setMoves((value) => value + 1);
    sfx.tap();
    if (next.every((light) => !light)) {
      setDone(true);
      setResultOpen(true);
      sfx.win();
      report({ score: Math.max(100, 900 - moves * 8 - seconds * 2), won: true });
    }
  };

  const restart = () => {
    resetReport();
    setLights(scrambleLights(size, presses));
    setMoves(0);
    setDone(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">👣 {moves}</span>
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
        <span className="hud-chip">💡 {lights.filter(Boolean).length}</span>
      </div>

      <div className="lights-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {lights.map((light, index) => (
          <button
            key={`${round}-${index}`}
            type="button"
            className={`light-cell ${light ? 'is-on' : 'is-off'}`}
            onClick={() => toggle(index)}
            aria-label={light ? 'Luz encendida' : 'Luz apagada'}
          />
        ))}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Mezclar otra vez</button>
      </div>
      <p className="engine-tip">Apaga todas las luces. Cada toque cambia la casilla y sus vecinas de arriba, abajo, izquierda y derecha.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="💡"
        title="¡Todas las luces apagadas!"
        subtitle={`${moves} giros · ${formatClock(seconds)}`}
        score={Math.max(100, 900 - moves * 8 - seconds * 2)}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
