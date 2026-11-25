import { randomInt, shuffle, type Rng } from '../lib/random';
import type { Mark } from './ttt';

export type C4Status = 'playing' | 'won' | 'draw';

export interface C4State {
  board: Mark[];
  cols: number;
  rows: number;
  turn: 0 | 1;
  status: C4Status;
  winner: 0 | 1 | null;
  line: number[];
  last: number | null;
  moves: number;
}

export function createC4(cols: number, rows: number): C4State {
  return {
    board: Array<Mark>(cols * rows).fill(0),
    cols,
    rows,
    turn: 0,
    status: 'playing',
    winner: null,
    line: [],
    last: null,
    moves: 0
  };
}

export function c4Winner(board: Mark[], cols: number, rows: number): { player: 1 | 2; line: number[] } | null {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const player = board[row * cols + col];
      if (!player) continue;
      for (const [dx, dy] of dirs) {
        const line: number[] = [];
        for (let step = 0; step < 4; step++) {
          const r = row + dy * step;
          const c = col + dx * step;
          if (r < 0 || c < 0 || r >= rows || c >= cols) break;
          if (board[r * cols + c] !== player) break;
          line.push(r * cols + c);
        }
        if (line.length === 4) return { player: player as 1 | 2, line };
      }
    }
  }
  return null;
}

export function dropRow(board: Mark[], cols: number, rows: number, col: number): number {
  for (let row = rows - 1; row >= 0; row--) {
    if (board[row * cols + col] === 0) return row;
  }
  return -1;
}

export function applyC4(state: C4State, col: number): { state: C4State; error?: string } {
  if (state.status !== 'playing') return { state, error: 'La partida ha terminado.' };
  if (col < 0 || col >= state.cols) return { state, error: 'Columna inválida.' };
  const row = dropRow(state.board, state.cols, state.rows, col);
  if (row < 0) return { state, error: 'Esa columna está llena.' };
  const board = [...state.board];
  const player = (state.turn + 1) as 1 | 2;
  const index = row * state.cols + col;
  board[index] = player;
  const result = c4Winner(board, state.cols, state.rows);
  const moves = state.moves + 1;
  return {
    state: {
      ...state,
      board,
      moves,
      turn: state.turn === 0 ? 1 : 0,
      status: result ? 'won' : moves === board.length ? 'draw' : 'playing',
      winner: result ? ((result.player - 1) as 0 | 1) : null,
      line: result?.line ?? [],
      last: index
    }
  };
}

function windowScore(board: Mark[], cols: number, rows: number, player: 1 | 2): number {
  const opponent = (player === 1 ? 2 : 1) as Mark;
  let score = 0;
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (const [dx, dy] of directions) {
        const endR = row + dy * 3;
        const endC = col + dx * 3;
        if (endR < 0 || endC < 0 || endR >= rows || endC >= cols) continue;
        let mine = 0;
        let theirs = 0;
        for (let step = 0; step < 4; step++) {
          const cell = board[(row + dy * step) * cols + (col + dx * step)];
          if (cell === player) mine++;
          else if (cell === opponent) theirs++;
        }
        if (mine && theirs) continue;
        if (mine === 3) score += 70;
        else if (mine === 2) score += 8;
        else if (mine === 1) score += 1;
        if (theirs === 3) score -= 80;
        else if (theirs === 2) score -= 8;
        else if (theirs === 1) score -= 1;
      }
    }
  }
  return score;
}

function validCols(state: C4State): number[] {
  const result: number[] = [];
  for (let col = 0; col < state.cols; col++) {
    if (dropRow(state.board, state.cols, state.rows, col) >= 0) result.push(col);
  }
  return result;
}

function search(state: C4State, depth: number, aiSeat: 0 | 1, alpha: number, beta: number): number {
  if (state.status === 'won') return state.winner === aiSeat ? 100000 + depth : -100000 - depth;
  if (state.status === 'draw') return 0;
  if (depth === 0) {
    return windowScore(state.board, state.cols, state.rows, (aiSeat + 1) as 1 | 2);
  }
  const cols = validCols(state);
  const maximizing = state.turn === aiSeat;
  let best = maximizing ? -Infinity : Infinity;
  for (const col of cols) {
    const next = applyC4(state, col).state;
    const value = search(next, depth - 1, aiSeat, alpha, beta);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseC4Move(state: C4State, difficulty: string, rng: Rng = Math.random): number {
  const cols = validCols(state);
  if (!cols.length) return -1;
  if (difficulty === 'facil' && rng() < 0.45) return shuffle(cols, rng)[0];

  const aiSeat = state.turn;
  const winNow = cols.find((col) => applyC4(state, col).state.status === 'won');
  if (winNow !== undefined) return winNow;

  let best = -Infinity;
  let choice = cols[Math.floor(cols.length / 2)];
  const depth = difficulty === 'dificil' ? 4 : 2;
  const ordered = shuffle(cols, rng).sort(
    (a, b) => Math.abs(a - (state.cols - 1) / 2) - Math.abs(b - (state.cols - 1) / 2)
  );
  for (const col of ordered) {
    const next = applyC4(state, col).state;
    const value = search(next, depth, aiSeat, -Infinity, Infinity) + randomInt(3, rng) * 0.01;
    if (value > best) {
      best = value;
      choice = col;
    }
  }
  return choice;
}
