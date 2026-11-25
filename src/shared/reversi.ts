import { shuffle, type Rng } from '../lib/random';
import type { Mark } from './ttt';

export type ReversiStatus = 'playing' | 'won' | 'draw';

export interface ReversiState {
  board: Mark[];
  size: number;
  turn: 0 | 1;
  status: ReversiStatus;
  winner: 0 | 1 | null;
  passed: boolean;
  last: number | null;
  black: number;
  white: number;
}

const DIRS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1]
];

export function createReversi(size: number): ReversiState {
  const board = Array<Mark>(size * size).fill(0);
  const mid = size / 2;
  board[(mid - 1) * size + (mid - 1)] = 2;
  board[mid * size + mid] = 2;
  board[(mid - 1) * size + mid] = 1;
  board[mid * size + (mid - 1)] = 1;
  const counts = countReversi(board);
  return {
    board,
    size,
    turn: 0,
    status: 'playing',
    winner: null,
    passed: false,
    last: null,
    black: counts.black,
    white: counts.white
  };
}

export function countReversi(board: Mark[]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === 1) black++;
    else if (cell === 2) white++;
  }
  return { black, white };
}

export function flipsFor(board: Mark[], size: number, index: number, player: 1 | 2): number[] {
  if (board[index] !== 0) return [];
  const row = Math.floor(index / size);
  const col = index % size;
  const flips: number[] = [];
  for (const [dx, dy] of DIRS) {
    const line: number[] = [];
    let r = row + dy;
    let c = col + dx;
    while (r >= 0 && c >= 0 && r < size && c < size) {
      const cell = board[r * size + c];
      if (cell === 0) break;
      if (cell === player) {
        if (line.length) flips.push(...line);
        break;
      }
      line.push(r * size + c);
      r += dy;
      c += dx;
    }
  }
  return flips;
}

export function legalMoves(board: Mark[], size: number, player: 1 | 2): Map<number, number[]> {
  const moves = new Map<number, number[]>();
  for (let index = 0; index < board.length; index++) {
    if (board[index] !== 0) continue;
    const flips = flipsFor(board, size, index, player);
    if (flips.length) moves.set(index, flips);
  }
  return moves;
}

export function applyReversi(state: ReversiState, index: number): { state: ReversiState; error?: string } {
  if (state.status !== 'playing') return { state, error: 'La partida ha terminado.' };
  const player = (state.turn + 1) as 1 | 2;
  const flips = flipsFor(state.board, state.size, index, player);
  if (!flips.length) return { state, error: 'Ese movimiento no es válido.' };

  const board = [...state.board];
  board[index] = player;
  for (const flip of flips) board[flip] = player;
  const counts = countReversi(board);
  const nextTurn = (state.turn === 0 ? 1 : 0) as 0 | 1;
  const nextPlayer = (nextTurn + 1) as 1 | 2;
  const hasNext = legalMoves(board, state.size, nextPlayer).size > 0;
  const currentPlayer = player;
  const hasCurrent = legalMoves(board, state.size, currentPlayer).size > 0;
  const full = board.every((cell) => cell !== 0);

  if (!hasNext && !hasCurrent) {
    return {
      state: {
        ...state,
        board,
        passed: true,
        last: index,
        black: counts.black,
        white: counts.white,
        status: counts.black === counts.white ? 'draw' : 'won',
        winner: counts.black === counts.white ? null : counts.black > counts.white ? 0 : 1
      }
    };
  }

  return {
    state: {
      ...state,
      board,
      turn: hasNext ? nextTurn : state.turn,
      passed: !hasNext && !full,
      last: index,
      black: counts.black,
      white: counts.white
    }
  };
}

export function chooseReversiMove(
  state: ReversiState,
  difficulty: string,
  rng: Rng = Math.random
): number | null {
  const player = (state.turn + 1) as 1 | 2;
  const moves = legalMoves(state.board, state.size, player);
  if (!moves.size) return null;
  const entries = [...moves.entries()];
  if (difficulty === 'facil' && rng() < 0.5) return shuffle(entries, rng)[0][0];

  const corners = new Set([
    0,
    state.size - 1,
    state.size * (state.size - 1),
    state.size * state.size - 1
  ]);
  const center = (state.size - 1) / 2;

  const evaluate = (index: number, flips: number[]): number => {
    let score = flips.length;
    if (corners.has(index)) score += 30;
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    if (
      (row === 0 || row === state.size - 1 || col === 0 || col === state.size - 1) &&
      !corners.has(index)
    ) {
      score += 4;
    }
    score -= Math.abs(row - center) * 0.1 + Math.abs(col - center) * 0.1;
    return score;
  };

  let bestScore = -Infinity;
  let choice = entries[0][0];
  for (const [index, flips] of entries) {
    let score = evaluate(index, flips);
    if (difficulty === 'dificil') {
      const next = applyReversi(state, index).state;
      const opponent = next.status === 'won' && next.winner === state.turn ? -1000 : 0;
      const opponentMoves = legalMoves(next.board, next.size, (next.turn + 1) as 1 | 2);
      let worst = 0;
      for (const [oppIndex, oppFlips] of opponentMoves) {
        worst = Math.max(worst, evaluate(oppIndex, oppFlips));
      }
      score = score - worst * 0.6 + opponent;
    }
    if (score > bestScore) {
      bestScore = score;
      choice = index;
    }
  }
  return choice;
}
