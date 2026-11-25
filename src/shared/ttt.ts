import { randomInt, shuffle, type Rng } from '../lib/random';

export type Mark = 0 | 1 | 2;
export type TttStatus = 'playing' | 'won' | 'draw';

export interface TttState {
  board: Mark[];
  size: number;
  win: number;
  turn: 0 | 1;
  status: TttStatus;
  winner: 0 | 1 | null;
  line: number[];
  moves: number;
}

export function createTtt(size: number, win: number): TttState {
  return {
    board: Array<Mark>(size * size).fill(0),
    size,
    win,
    turn: 0,
    status: 'playing',
    winner: null,
    line: [],
    moves: 0
  };
}

export function tttWinner(board: Mark[], size: number, win: number): { player: 1 | 2; line: number[] } | null {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const player = board[row * size + col];
      if (!player) continue;
      for (const [dx, dy] of dirs) {
        const line: number[] = [];
        for (let step = 0; step < win; step++) {
          const r = row + dy * step;
          const c = col + dx * step;
          if (r < 0 || c < 0 || r >= size || c >= size) break;
          if (board[r * size + c] !== player) break;
          line.push(r * size + c);
        }
        if (line.length === win) return { player: player as 1 | 2, line };
      }
    }
  }
  return null;
}

export function applyTtt(state: TttState, index: number): { state: TttState; error?: string } {
  if (state.status !== 'playing') return { state, error: 'La partida ha terminado.' };
  if (index < 0 || index >= state.board.length || state.board[index] !== 0) {
    return { state, error: 'Esa casilla no está libre.' };
  }
  const board = [...state.board];
  const player = (state.turn + 1) as 1 | 2;
  board[index] = player;
  const result = tttWinner(board, state.size, state.win);
  const moves = state.moves + 1;
  const draw = !result && moves === board.length;
  return {
    state: {
      ...state,
      board,
      moves,
      turn: state.turn === 0 ? 1 : 0,
      status: result ? 'won' : draw ? 'draw' : 'playing',
      winner: result ? ((result.player - 1) as 0 | 1) : null,
      line: result?.line ?? []
    }
  };
}

function lineScore(board: Mark[], size: number, win: number, player: Mark): number {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  let score = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dx, dy] of dirs) {
        const endR = row + dy * (win - 1);
        const endC = col + dx * (win - 1);
        if (endR < 0 || endC < 0 || endR >= size || endC >= size) continue;
        let mine = 0;
        let theirs = 0;
        for (let step = 0; step < win; step++) {
          const cell = board[(row + dy * step) * size + (col + dx * step)];
          if (cell === player) mine++;
          else if (cell !== 0) theirs++;
        }
        if (theirs === 0) score += mine === 0 ? 0 : 10 ** mine;
      }
    }
  }
  return score;
}

function minimax(
  board: Mark[],
  size: number,
  win: number,
  turn: 0 | 1,
  ai: 0 | 1,
  depth: number,
  maxDepth: number,
  alpha: number,
  beta: number
): number {
  const result = tttWinner(board, size, win);
  if (result) return result.player - 1 === ai ? 10000 - (maxDepth - depth) : -10000 + (maxDepth - depth);
  if (board.every((cell) => cell !== 0)) return 0;
  const player = (turn + 1) as 1 | 2;
  const maximizing = turn === ai;
  let best = maximizing ? -Infinity : Infinity;

  const candidates = board.map((cell, index) => (cell === 0 ? index : -1)).filter((index) => index >= 0);
  const ordered = candidates.sort((a, b) => {
    const center = (size - 1) / 2;
    const da = Math.abs((a % size) - center) + Math.abs(Math.floor(a / size) - center);
    const db = Math.abs((b % size) - center) + Math.abs(Math.floor(b / size) - center);
    return da - db;
  });

  for (const index of ordered) {
    board[index] = player;
    const value = minimax(board, size, win, turn === 0 ? 1 : 0, ai, depth + 1, maxDepth, alpha, beta);
    board[index] = 0;
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

export function chooseTttMove(state: TttState, difficulty: string, rng: Rng = Math.random): number {
  const empty = state.board.map((cell, index) => (cell === 0 ? index : -1)).filter((index) => index >= 0);
  if (!empty.length) return -1;
  const aiSeat = state.turn;
  const aiMark = (aiSeat + 1) as 1 | 2;

  if (difficulty === 'facil' && rng() < 0.55) return shuffle(empty, rng)[0];

  const board = [...state.board];
  const center = (state.size - 1) / 2;
  const scored = empty.map((index) => {
    board[index] = aiMark;
    const attack = lineScore(board, state.size, state.win, aiMark);
    board[index] = (aiMark === 1 ? 2 : 1) as Mark;
    const defend = lineScore(board, state.size, state.win, (aiMark === 1 ? 2 : 1) as Mark);
    board[index] = 0;
    const dist = Math.abs((index % state.size) - center) + Math.abs(Math.floor(index / state.size) - center);
    return { index, score: attack * 3 + defend * 2 - dist * 0.5 };
  });

  if (state.size === 3 && difficulty === 'dificil') {
    let best = -Infinity;
    let choice = scored[0].index;
    for (const candidate of scored) {
      board[candidate.index] = aiMark;
      const value = minimax(board, state.size, state.win, state.turn === 0 ? 1 : 0, aiSeat, 1, 9, -Infinity, Infinity);
      board[candidate.index] = 0;
      if (value > best) {
        best = value;
        choice = candidate.index;
      }
    }
    return choice;
  }

  scored.sort((a, b) => b.score - a.score);
  if (difficulty === 'normal' && rng() < 0.2 && scored[1]) return scored[1].index;
  return scored[0].index;
}
