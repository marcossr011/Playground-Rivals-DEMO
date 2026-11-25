import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { formatClock, shuffle, uid } from '../../lib/random';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { Joystick } from '../../components/Joystick';
import { useApp } from '../../state/AppContext';
import { useCountdown, useGameReport, useKeyboard, useStopwatch, useSwipe, type Direction } from '../hooks';

/* ───────────────────────────── 2048 ───────────────────────────── */

function slideLine(line: number[]): { line: number[]; gained: number } {
  const values = line.filter((value) => value !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(values[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

function spawnTile(board: number[], size: number): number[] {
  const empties = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
  if (!empties.length) return board;
  const index = empties[Math.floor(Math.random() * empties.length)];
  const next = [...board];
  next[index] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function hasMoves(board: number[], size: number): boolean {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = board[row * size + col];
      if (!value) return true;
      if (col + 1 < size && board[row * size + col + 1] === value) return true;
      if (row + 1 < size && board[(row + 1) * size + col] === value) return true;
    }
  }
  return false;
}

function moveBoard(board: number[], size: number, direction: Direction): { board: number[]; gained: number } {
  const next = [...board];
  let gained = 0;
  const horizontal = direction === 'left' || direction === 'right';
  for (let outer = 0; outer < size; outer++) {
    const line: number[] = [];
    for (let inner = 0; inner < size; inner++) {
      const index = horizontal ? outer * size + inner : inner * size + outer;
      line.push(board[index]);
    }
    if (direction === 'right' || direction === 'down') line.reverse();
    const result = slideLine(line);
    gained += result.gained;
    let out = result.line;
    if (direction === 'right' || direction === 'down') out = out.slice().reverse();
    for (let inner = 0; inner < size; inner++) {
      const index = horizontal ? outer * size + inner : inner * size + outer;
      next[index] = out[inner];
    }
  }
  return { board: next, gained };
}

export function Game2048({ meta }: { meta: GameMeta }) {
  const { state } = useApp();
  const config = meta.config as { size?: number; target?: number };
  const size = config.size ?? 4;
  const target = config.target ?? 2048;
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<number[]>(() => spawnTile(spawnTile(Array(size * size).fill(0), size), size));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [targetHit, setTargetHit] = useState(false);
  const [result, setResult] = useState<'win' | 'over' | null>(null);
  const { report, resetReport } = useGameReport(meta);

  const doMove = (direction: Direction) => {
    if (over) return;
    const resultMove = moveBoard(board, size, direction);
    if (resultMove.board.every((value, index) => value === board[index])) return;
    const spawned = spawnTile(resultMove.board, size);
    const nextScore = score + resultMove.gained;
    setBoard(spawned);
    setScore(nextScore);
    setBest((value) => Math.max(value, nextScore));
    sfx.tap();
    vibrate(8);
    if (!targetHit && spawned.some((value) => value >= target)) {
      setTargetHit(true);
      setResult('win');
      sfx.win();
      report({ score: nextScore, won: true });
      return;
    }
    if (!hasMoves(spawned, size)) {
      setOver(true);
      setResult('over');
      sfx.lose();
      report({ score: nextScore, won: false });
    }
  };

  useKeyboard((key) => {
    const map: Record<string, Direction | undefined> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      a: 'left',
      d: 'right',
      w: 'up',
      s: 'down'
    };
    const direction = map[key] ?? map[key.toLowerCase()];
    if (direction) doMove(direction);
  }, !over);

  const swipe = useSwipe<HTMLDivElement>(doMove);

  const restart = () => {
    resetReport();
    setBoard(spawnTile(spawnTile(Array(size * size).fill(0), size), size));
    setScore(0);
    setOver(false);
    setTargetHit(false);
    setResult(null);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">💯 {score}</span>
        <span className="hud-chip">🏆 {Math.max(best, score)}</span>
        <span className="hud-chip">🎯 {target}</span>
      </div>

      <div className="g2048-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} {...swipe}>
        {board.map((value, index) => (
          <div key={`${round}-${index}`} className={`g2048-cell ${value ? `value-${Math.min(value, 8192)}` : ''} ${value > 2048 ? 'is-huge' : ''}`}>
            {value || ''}
          </div>
        ))}
      </div>

      {state.controls === 'joystick' ? <Joystick onDirection={doMove} label="Joystick compartido" /> : null}

      <div className="g2048-pad">
        <button type="button" className="chip" onClick={() => doMove('up')}>↑</button>
        <div>
          <button type="button" className="chip" onClick={() => doMove('left')}>←</button>
          <button type="button" className="chip" onClick={() => doMove('down')}>↓</button>
          <button type="button" className="chip" onClick={() => doMove('right')}>→</button>
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>
      <p className="engine-tip">
        {state.controls === 'joystick' ? 'Arrastra el joystick o desliza' : 'Desliza con el dedo o usa las flechas'} para mover las fichas. Las iguales se fusionan y suman puntos.
      </p>

      <ResultOverlay
        open={result !== null}
        emoji={result === 'win' ? '🏆' : '🧩'}
        title={result === 'win' ? `¡Llegaste a ${target}!` : 'Sin movimientos'}
        subtitle={result === 'win' ? 'Puedes seguir jugando para batir tu marca' : `Puntuación final: ${score}`}
        score={score}
        retryLabel={result === 'win' ? 'Seguir jugando' : 'Jugar otra vez'}
        onRetry={() => {
          if (result === 'win') {
            setResult(null);
          } else {
            restart();
          }
        }}
        onExit={() => setResult(null)}
      />
    </div>
  );
}

/* ───────────────────────────── Buscaminas ───────────────────────────── */

interface MineState {
  mines: Set<number>;
  revealed: Set<number>;
  flags: Set<number>;
  started: boolean;
  over: boolean;
  won: boolean;
  boom: number | null;
}

function neighbors(index: number, cols: number, rows: number): number[] {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const r = row + dy;
      const c = col + dx;
      if (r >= 0 && c >= 0 && r < rows && c < cols) out.push(r * cols + c);
    }
  }
  return out;
}

function plantMines(total: number, mines: number, safe: number, cols: number, rows: number): Set<number> {
  const forbidden = new Set([safe, ...neighbors(safe, cols, rows)]);
  const candidates = Array.from({ length: total }, (_, index) => index).filter((index) => !forbidden.has(index));
  return new Set(shuffle(candidates).slice(0, mines));
}

export function MinesweeperGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { cols?: number; rows?: number; mines?: number };
  const cols = config.cols ?? 9;
  const rows = config.rows ?? 9;
  const mines = config.mines ?? 10;
  const total = cols * rows;
  const [round, setRound] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [state, setState] = useState<MineState>(() => ({
    mines: new Set(),
    revealed: new Set(),
    flags: new Set(),
    started: false,
    over: false,
    won: false,
    boom: null
  }));
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(state.started && !state.over, round);

  const counts = useMemo(() => {
    const list = Array(total).fill(0);
    if (!state.started) return list;
    for (let index = 0; index < total; index++) {
      if (state.mines.has(index)) continue;
      list[index] = neighbors(index, cols, rows).filter((item) => state.mines.has(item)).length;
    }
    return list;
  }, [state.mines, state.started, total, cols, rows]);

  const reveal = (index: number) => {
    if (state.over) return;
    if (state.flags.has(index)) return;
    if (state.revealed.has(index)) return;
    if (flagMode) {
      const nextFlags = new Set(state.flags);
      if (nextFlags.has(index)) nextFlags.delete(index);
      else nextFlags.add(index);
      setState({ ...state, flags: nextFlags });
      sfx.select();
      return;
    }
    let next: MineState = { ...state };
    if (!state.started) {
      const planted = plantMines(total, mines, index, cols, rows);
      next = { ...next, mines: planted, started: true };
    }
    if (next.mines.has(index)) {
      const revealed = new Set(next.revealed);
      revealed.add(index);
      setState({ ...next, revealed, over: true, boom: index });
      setResultOpen(true);
      sfx.lose();
      vibrate([60, 40, 80]);
      report({ score: 0, won: false });
      return;
    }
    const revealed = new Set(next.revealed);
    const queue = [index];
    while (queue.length) {
      const current = queue.pop() as number;
      if (revealed.has(current) || next.flags.has(current)) continue;
      revealed.add(current);
      const adjacent = neighbors(current, cols, rows);
      if (!adjacent.some((item) => next.mines.has(item))) {
        for (const item of adjacent) if (!revealed.has(item)) queue.push(item);
      }
    }
    const won = revealed.size === total - mines;
    setState({ ...next, revealed, over: won, won });
    if (won) {
      setResultOpen(true);
      sfx.win();
      report({ score: Math.max(100, 800 - seconds * 4), won: true });
    } else {
      sfx.tap();
    }
  };

  const restart = () => {
    resetReport();
    setState({ mines: new Set(), revealed: new Set(), flags: new Set(), started: false, over: false, won: false, boom: null });
    setResultOpen(false);
    setFlagMode(false);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">💣 {Math.max(0, mines - state.flags.size)}</span>
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
        <button type="button" className={`chip tiny ${flagMode ? 'active' : ''}`} onClick={() => setFlagMode((value) => !value)}>
          🚩 {flagMode ? 'Bandera' : 'Descubrir'}
        </button>
      </div>

      <div className="mine-scroll">
        <div className="mine-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: Math.max(280, cols * 26) }}>
          {Array.from({ length: total }).map((_, index) => {
            const isRevealed = state.revealed.has(index);
            const isMine = state.mines.has(index);
            const flag = state.flags.has(index);
            return (
              <button
                key={`${round}-${index}`}
                type="button"
                className={`mine-cell ${isRevealed ? 'is-revealed' : ''} ${state.boom === index ? 'is-boom' : ''} ${flag ? 'is-flag' : ''} ${
                  isRevealed && isMine ? 'is-mine' : ''
                }`}
                onClick={() => reveal(index)}
                disabled={state.over}
                aria-label={`Casilla ${index + 1}`}
              >
                {isRevealed ? (isMine ? '💥' : counts[index] || '') : flag ? '🚩' : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nuevo tablero</button>
        <button type="button" className={`chip ${flagMode ? 'active' : ''}`} onClick={() => setFlagMode((value) => !value)}>
          🚩 Poner banderas
        </button>
      </div>
      <p className="engine-tip">El primer toque siempre es seguro. Los números indican minas alrededor. Marca con bandera las casillas sospechosas.</p>

      <ResultOverlay
        open={resultOpen}
        emoji={state.won ? '🥳' : '💣'}
        title={state.won ? '¡Campo despejado!' : '¡Boom!'}
        subtitle={state.won ? `Terminado en ${formatClock(seconds)}` : 'Pisaste una mina'}
        score={state.won ? Math.max(100, 800 - seconds * 4) : 0}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Sudoku ───────────────────────────── */

function boxShape(size: number): { height: number; width: number } {
  return size === 6 ? { height: 2, width: 3 } : { height: 3, width: 3 };
}

function canPlace(grid: number[], size: number, index: number, value: number): boolean {
  const row = Math.floor(index / size);
  const col = index % size;
  const { height, width } = boxShape(size);
  for (let i = 0; i < size; i++) {
    if (grid[row * size + i] === value) return false;
    if (grid[i * size + col] === value) return false;
  }
  const startRow = Math.floor(row / height) * height;
  const startCol = Math.floor(col / width) * width;
  for (let r = startRow; r < startRow + height; r++) {
    for (let c = startCol; c < startCol + width; c++) {
      if (grid[r * size + c] === value) return false;
    }
  }
  return true;
}

function fillGrid(grid: number[], size: number, position = 0): boolean {
  if (position === grid.length) return true;
  if (grid[position]) return fillGrid(grid, size, position + 1);
  const values = shuffle(Array.from({ length: size }, (_, index) => index + 1));
  for (const value of values) {
    if (canPlace(grid, size, position, value)) {
      grid[position] = value;
      if (fillGrid(grid, size, position + 1)) return true;
      grid[position] = 0;
    }
  }
  return false;
}

function createSudoku(size: number, difficulty: string): { puzzle: number[]; solution: number[] } {
  const solution = Array<number>(size * size).fill(0);
  fillGrid(solution, size);
  const clues = size === 6 ? (difficulty === 'facil' ? 28 : difficulty === 'medio' ? 22 : 18) : difficulty === 'facil' ? 45 : difficulty === 'medio' ? 36 : 30;
  const puzzle = [...solution];
  const positions = shuffle(Array.from({ length: puzzle.length }, (_, index) => index));
  const remove = Math.max(0, puzzle.length - clues);
  for (const position of positions.slice(0, remove)) puzzle[position] = 0;
  return { puzzle, solution };
}

export function SudokuGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; difficulty?: string };
  const size = config.size ?? 9;
  const difficulty = config.difficulty ?? 'medio';
  const [round, setRound] = useState(0);
  const [game, setGame] = useState(() => createSudoku(size, difficulty));
  const [values, setValues] = useState<number[]>(game.puzzle);
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done, round);

  const conflicts = useMemo(() => {
    const set = new Set<number>();
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (!value) continue;
      const row = Math.floor(index / size);
      const col = index % size;
      for (let i = 0; i < size; i++) {
        if (i !== col && values[row * size + i] === value) set.add(index);
        if (i !== row && values[i * size + col] === value) set.add(index);
      }
      const { height, width } = boxShape(size);
      const sr = Math.floor(row / height) * height;
      const sc = Math.floor(col / width) * width;
      for (let r = sr; r < sr + height; r++) {
        for (let c = sc; c < sc + width; c++) {
          const other = r * size + c;
          if (other !== index && values[other] === value) set.add(index);
        }
      }
    }
    return set;
  }, [values, size]);

  const enter = (value: number) => {
    if (selected === null || done) return;
    if (game.puzzle[selected] !== 0) return;
    const next = [...values];
    next[selected] = value;
    setValues(next);
    if (value === 0) {
      sfx.tap();
    } else if (game.solution[selected] !== value) {
      setMistakes((count) => count + 1);
      sfx.error();
    } else {
      sfx.select();
    }
    if (next.every((item, index) => item === game.solution[index])) {
      setDone(true);
      setResultOpen(true);
      sfx.win();
      report({ score: Math.max(150, 1400 - seconds * 2 - mistakes * 50), won: true });
    }
  };

  const restart = () => {
    resetReport();
    const next = createSudoku(size, difficulty);
    setGame(next);
    setValues(next.puzzle);
    setSelected(null);
    setMistakes(0);
    setDone(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const remaining = (value: number) => size - values.filter((item) => item === value).length;

  const { height, width } = boxShape(size);

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
        <span className="hud-chip">❌ {mistakes}</span>
        <span className="hud-chip">{difficulty}</span>
      </div>

      <div
        className="sudoku-board"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {values.map((value, index) => {
          const row = Math.floor(index / size);
          const col = index % size;
          const given = game.puzzle[index] !== 0;
          return (
            <button
              key={`${round}-${index}`}
              type="button"
              className={`sudoku-cell ${given ? 'is-given' : ''} ${selected === index ? 'is-selected' : ''} ${
                conflicts.has(index) ? 'is-conflict' : ''
              } ${selected !== null && value !== 0 && value === values[selected] ? 'is-same' : ''} ${
                row % height === height - 1 && row !== size - 1 ? 'box-bottom' : ''
              } ${col % width === width - 1 && col !== size - 1 ? 'box-right' : ''}`}
              onClick={() => setSelected(index)}
            >
              {value || ''}
            </button>
          );
        })}
      </div>

      <div className="sudoku-pad">
        {Array.from({ length: size }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" className="sudoku-key" onClick={() => enter(value)} disabled={done}>
            {value}
            <small>{remaining(value)}</small>
          </button>
        ))}
        <button type="button" className="sudoku-key is-erase" onClick={() => enter(0)} disabled={done}>
          ⌫
        </button>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Otro sudoku</button>
      </div>
      <p className="engine-tip">Selecciona una casilla y toca un número. Las celdas en conflicto se marcan en rojo. Los números pequeños muestran cuántos quedan.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🔢"
        title="¡Sudoku completado!"
        subtitle={`${formatClock(seconds)} · ${mistakes} fallos`}
        score={Math.max(150, 1400 - seconds * 2 - mistakes * 50)}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Puzle deslizante ───────────────────────────── */

function createSliding(size: number): number[] {
  const total = size * size;
  const tiles = Array.from({ length: total }, (_, index) => (index + 1) % total);
  let blank = total - 1;
  for (let step = 0; step < 160; step++) {
    const row = Math.floor(blank / size);
    const col = blank % size;
    const options: number[] = [];
    if (row > 0) options.push(blank - size);
    if (row < size - 1) options.push(blank + size);
    if (col > 0) options.push(blank - 1);
    if (col < size - 1) options.push(blank + 1);
    const choice = options[Math.floor(Math.random() * options.length)];
    [tiles[blank], tiles[choice]] = [tiles[choice], tiles[blank]];
    blank = choice;
  }
  if (tiles.every((value, index) => value === (index + 1) % (size * size))) return createSliding(size);
  return tiles;
}

export function SlidingGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; mode?: string };
  const size = config.size ?? 4;
  const timed = config.mode === 'crono';
  const total = size * size;
  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<number[]>(() => createSliding(size));
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done && !timed, round);
  const { remaining, progress } = useCountdown(300, timed && !done, round, () => {
    if (done) return;
    setDone(true);
    setResultOpen(true);
    sfx.lose();
    report({ score: Math.max(50, 600 - moves * 2), won: false });
  });
  const clock = timed ? Math.ceil(remaining) : seconds;

  const slide = (index: number) => {
    if (done) return;
    const blank = tiles.indexOf(0);
    const row = Math.floor(blank / size);
    const col = blank % size;
    const targetRow = Math.floor(index / size);
    const targetCol = index % size;
    if (Math.abs(row - targetRow) + Math.abs(col - targetCol) !== 1) return;
    const next = [...tiles];
    [next[blank], next[index]] = [next[index], next[blank]];
    setTiles(next);
    setMoves((value) => value + 1);
    sfx.tap();
    if (next.every((value, position) => value === (position + 1) % total)) {
      setDone(true);
      setWon(true);
      setResultOpen(true);
      sfx.win();
      report({ score: Math.max(100, 1200 - moves * 3 - clock * 2), won: true });
    }
  };

  const restart = () => {
    resetReport();
    setTiles(createSliding(size));
    setMoves(0);
    setDone(false);
    setWon(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">👣 {moves}</span>
        <span className={`hud-chip ${timed && remaining < 20 ? 'is-danger' : ''}`}>⏱️ {formatClock(clock)}</span>
        <span className="hud-chip">{size}×{size}</span>
      </div>
      {timed ? (
        <div className="meter">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}

      <div className="sliding-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, fontSize: size <= 3 ? 34 : size === 4 ? 26 : 20 }}>
        {tiles.map((value, index) => (
          <button
            key={`${round}-${index}`}
            type="button"
            className={`sliding-tile ${value === 0 ? 'is-blank' : ''} ${value !== 0 && value === index + 1 ? 'is-home' : ''}`}
            onClick={() => slide(index)}
            disabled={value === 0 || done}
          >
            {value || ''}
          </button>
        ))}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Mezclar de nuevo</button>
      </div>
      <p className="engine-tip">Desliza las fichas hacia el hueco hasta ordenarlas del 1 al {total - 1}. Las fichas en su sitio se iluminan.</p>

      <ResultOverlay
        open={resultOpen}
        emoji={won ? '🧩' : '⏳'}
        title={won ? '¡Puzle ordenado!' : 'Se acabó el tiempo'}
        subtitle={`${moves} movimientos · ${formatClock(clock)}`}
        score={won ? Math.max(100, 1200 - moves * 3 - clock * 2) : Math.max(50, 600 - moves * 2)}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
