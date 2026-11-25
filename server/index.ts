import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { ONLINE_GAMES, getGame } from '../src/data/catalog';
import { uid } from '../src/lib/random';
import { applyC4, createC4, type C4State } from '../src/shared/connect4';
import { generateTriviaQuestions, type Question } from '../src/shared/quiz';
import { applyReversi, createReversi, legalMoves, countReversi, type ReversiState } from '../src/shared/reversi';
import { applyTtt, createTtt, type TttState } from '../src/shared/ttt';
import type {
  ActionAck,
  ChatMessage,
  MatchResult,
  OnlinePlayerPublic,
  PublicRoom,
  RoomSnapshot
} from '../src/shared/online';
import type { FullClientEvents, FullServerEvents } from '../src/shared/social';
import { installSocial, outdoorRoomCount, tournamentRoomCount } from './social';

const PORT = Number(process.env.PORT ?? 3001);
const TURN_MS = 45_000;
const QUESTION_MS = 20_000;
const REVEAL_MS = 4_000;
const TRIVIA_QUESTIONS = 8;
const MAX_CHAT = 40;

interface ServerPlayer extends OnlinePlayerPublic {
  socketId: string | null;
  lastChatAt: number;
}

type BoardGame =
  | { kind: 'ttt'; state: TttState; deadline: number }
  | { kind: 'c4'; state: C4State; deadline: number }
  | { kind: 'reversi'; state: ReversiState; deadline: number };

interface TriviaGame {
  kind: 'trivia';
  questions: Question[];
  index: number;
  scores: [number, number];
  turn: 0 | 1;
  phase: 'question' | 'reveal';
  correct: number | null;
  deadline: number;
}

type ServerGame = BoardGame | TriviaGame;

interface ServerRoom {
  code: string;
  gameId: string;
  gameTitle: string;
  gameEmoji: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  quick: boolean;
  players: ServerPlayer[];
  chat: ChatMessage[];
  result: MatchResult | null;
  game: ServerGame | null;
  rematchVotes: Set<string>;
  createdAt: number;
}

const rooms = new Map<string, ServerRoom>();
const seats = new Map<string, { code: string; playerId: string }>();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  return uid().slice(0, 6).toUpperCase();
}

function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Jugador';
  const name = raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return name || 'Jugador';
}

const PHOTO_AVATAR = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

function cleanAvatar(raw: unknown): string {
  if (typeof raw !== 'string') return '🙂';
  const value = raw.trim();
  if (value.length <= 120_000 && PHOTO_AVATAR.test(value)) return value;
  const chars = Array.from(value.replace(/[\u0000-\u001f<>]/g, '').trim());
  return chars.length ? chars.slice(0, 2).join('') : '🙂';
}

function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function publicRoom(room: ServerRoom): PublicRoom {
  return {
    code: room.code,
    gameId: room.gameId,
    gameTitle: room.gameTitle,
    gameEmoji: room.gameEmoji,
    hostId: room.hostId,
    status: room.status,
    quick: room.quick,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      seat: player.seat,
      connected: player.connected
    })),
    chat: room.chat,
    result: room.result
  };
}

function gameSnapshot(room: ServerRoom): RoomSnapshot['game'] {
  const game = room.game;
  if (!game) return null;
  if (game.kind === 'trivia') {
    const question = game.questions[game.index];
    if (!question) return null;
    return {
      kind: 'trivia',
      index: game.index,
      total: game.questions.length,
      prompt: question.prompt,
      visual: question.visual,
      options: question.options,
      scores: game.scores,
      turn: game.turn,
      phase: game.phase,
      correct: game.phase === 'reveal' ? game.correct : null,
      deadline: game.deadline
    };
  }
  if (game.kind === 'ttt') return { kind: 'ttt', state: game.state, deadline: game.deadline };
  if (game.kind === 'c4') return { kind: 'c4', state: game.state, deadline: game.deadline };
  return { kind: 'reversi', state: game.state, deadline: game.deadline };
}

function snapshot(room: ServerRoom): RoomSnapshot {
  return { room: publicRoom(room), game: gameSnapshot(room) };
}

function broadcast(room: ServerRoom): void {
  io.to(room.code).emit('room:update', snapshot(room));
}

function onlineGame(gameId: string) {
  return ONLINE_GAMES.find((game) => game.metaId === gameId);
}

function buildGame(gameId: string): ServerGame | null {
  const meta = getGame(gameId);
  if (!meta) return null;
  if (gameId === 'ttt-3x3-normal') {
    const size = Number(meta.config.size ?? 3);
    const win = Number(meta.config.win ?? 3);
    return { kind: 'ttt', state: createTtt(size, win), deadline: Date.now() + TURN_MS };
  }
  if (gameId === 'c4-7x6-normal') {
    const cols = Number(meta.config.cols ?? 7);
    const rows = Number(meta.config.rows ?? 6);
    return { kind: 'c4', state: createC4(cols, rows), deadline: Date.now() + TURN_MS };
  }
  if (gameId === 'reversi-8x8-normal') {
    const size = Number(meta.config.size ?? 8);
    return { kind: 'reversi', state: createReversi(size), deadline: Date.now() + TURN_MS };
  }
  if (gameId.startsWith('trivia-')) {
    const questions = generateTriviaQuestions(meta.config).slice(0, TRIVIA_QUESTIONS);
    if (!questions.length) return null;
    return {
      kind: 'trivia',
      questions,
      index: 0,
      scores: [0, 0],
      turn: 0,
      phase: 'question',
      correct: null,
      deadline: Date.now() + QUESTION_MS
    };
  }
  return null;
}

function createRoom(gameId: string, profile: { name: string; avatar: string }, quick: boolean) {
  const meta = onlineGame(gameId);
  if (!meta) return null;
  const code = makeCode();
  const host: ServerPlayer = {
    id: uid(),
    name: cleanName(profile.name),
    avatar: cleanAvatar(profile.avatar),
    seat: 0,
    connected: true,
    socketId: null,
    lastChatAt: 0
  };
  const room: ServerRoom = {
    code,
    gameId,
    gameTitle: meta.name,
    gameEmoji: meta.emoji,
    hostId: host.id,
    status: 'waiting',
    quick,
    players: [host],
    chat: [],
    result: null,
    game: null,
    rematchVotes: new Set(),
    createdAt: Date.now()
  };
  rooms.set(code, room);
  return { room, player: host };
}

function partnerOf(room: ServerRoom, playerId: string): ServerPlayer | undefined {
  return room.players.find((player) => player.id !== playerId);
}

function playerOfSocket(room: ServerRoom, socketId: string): ServerPlayer | undefined {
  return room.players.find((player) => player.socketId === socketId);
}

function startGame(room: ServerRoom): boolean {
  const game = buildGame(room.gameId);
  if (!game) return false;
  room.game = game;
  room.status = 'playing';
  room.result = null;
  room.rematchVotes.clear();
  return true;
}

function finishRoom(room: ServerRoom, result: MatchResult): void {
  room.status = 'ended';
  room.result = result;
  if (room.game) room.game.deadline = Date.now();
  room.rematchVotes.clear();
}

function finishBoard(room: ServerRoom, game: BoardGame): boolean {
  if (game.kind === 'ttt' && game.state.status !== 'playing') {
    finishRoom(room, {
      winner: game.state.winner,
      reason:
        game.state.status === 'draw'
          ? 'Tablero completo: empate.'
          : `Línea de ${game.state.win} del jugador ${(game.state.winner ?? 0) + 1}.`
    });
    return true;
  }
  if (game.kind === 'c4' && game.state.status !== 'playing') {
    finishRoom(room, {
      winner: game.state.winner,
      reason: game.state.status === 'draw' ? 'Tablero lleno: empate.' : '¡Cuatro en línea!'
    });
    return true;
  }
  if (game.kind === 'reversi' && game.state.status !== 'playing') {
    const counts = countReversi(game.state.board);
    finishRoom(room, {
      winner: game.state.winner,
      reason:
        game.state.status === 'draw'
          ? `Empate ${counts.black}-${counts.white}.`
          : `Más fichas: ${Math.max(counts.black, counts.white)} a ${Math.min(counts.black, counts.white)}.`
    });
    return true;
  }
  return false;
}

function skipBoardTurn(room: ServerRoom, game: BoardGame): void {
  game.deadline = Date.now() + TURN_MS;
  if (game.kind === 'reversi') {
    const nextTurn = (game.state.turn === 0 ? 1 : 0) as 0 | 1;
    const nextPlayer = (nextTurn + 1) as 1 | 2;
    const nextMoves = legalMoves(game.state.board, game.state.size, nextPlayer);
    if (nextMoves.size) {
      game.state.turn = nextTurn;
      return;
    }
    const currentPlayer = (game.state.turn + 1) as 1 | 2;
    const currentMoves = legalMoves(game.state.board, game.state.size, currentPlayer);
    if (!currentMoves.size) {
      const counts = countReversi(game.state.board);
      finishRoom(room, {
        winner: counts.black === counts.white ? null : counts.black > counts.white ? 0 : 1,
        reason: 'No quedan jugadas posibles.'
      });
    }
    return;
  }
  game.state.turn = game.state.turn === 0 ? 1 : 0;
}

function advanceTrivia(room: ServerRoom, game: TriviaGame): void {
  const next = game.index + 1;
  if (next >= game.questions.length) {
    const [a, b] = game.scores;
    finishRoom(room, {
      winner: a === b ? null : a > b ? 0 : 1,
      reason: a === b ? `Empate ${a}-${b}.` : `Resultado ${Math.max(a, b)}-${Math.min(a, b)}.`
    });
    return;
  }
  game.index = next;
  game.turn = game.turn === 0 ? 1 : 0;
  game.phase = 'question';
  game.correct = null;
  game.deadline = Date.now() + QUESTION_MS;
}

function applyMove(room: ServerRoom, player: ServerPlayer, move: unknown): string | null {
  const game = room.game;
  if (!game || room.status !== 'playing') return 'La partida no está en marcha.';

  if (game.kind === 'trivia') {
    if (game.phase !== 'question') return 'Espera a la siguiente pregunta.';
    if (game.turn !== player.seat) return 'Le toca al otro jugador.';
    const raw =
      typeof move === 'number'
        ? move
        : typeof move === 'object' && move !== null
          ? Number((move as { option?: unknown; index?: unknown }).option ?? (move as { index?: unknown }).index)
          : NaN;
    const question = game.questions[game.index];
    if (!Number.isInteger(raw) || raw < 0 || raw >= question.options.length) return 'Opción inválida.';
    game.correct = question.answer;
    if (raw === question.answer) game.scores[game.turn] += 1;
    game.phase = 'reveal';
    game.deadline = Date.now() + REVEAL_MS;
    return null;
  }

  if (game.state.turn !== player.seat) return 'Le toca al otro jugador.';
  const numeric =
    typeof move === 'number'
      ? move
      : typeof move === 'object' && move !== null
        ? Number((move as { index?: unknown; col?: unknown }).index ?? (move as { col?: unknown }).col)
        : NaN;
  if (!Number.isInteger(numeric)) return 'Movimiento inválido.';

  let error: string | undefined;
  if (game.kind === 'ttt') {
    const result = applyTtt(game.state, numeric);
    game.state = result.state;
    error = result.error;
  } else if (game.kind === 'c4') {
    const result = applyC4(game.state, numeric);
    game.state = result.state;
    error = result.error;
  } else {
    const result = applyReversi(game.state, numeric);
    game.state = result.state;
    error = result.error;
  }
  if (error) return error;
  game.deadline = Date.now() + TURN_MS;
  finishBoard(room, game);
  return null;
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        outdoor: outdoorRoomCount(),
        tournaments: tournamentRoomCount(),
        uptime: Math.round(process.uptime())
      })
    );
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Método no permitido');
    return;
  }
  if (!existsSync(dist)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Recreo API en marcha. Abre el cliente de desarrollo en el puerto 5173.');
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Ruta inválida');
    return;
  }
  const candidate = path.normalize(path.join(dist, pathname));
  if (!candidate.startsWith(dist)) {
    res.writeHead(403).end('Prohibido');
    return;
  }
  let filePath = candidate;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (path.extname(pathname)) {
      res.writeHead(404).end('No encontrado');
      return;
    }
    filePath = path.join(dist, 'index.html');
    if (!existsSync(filePath)) {
      res.writeHead(404).end('No encontrado');
      return;
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const isHashed = filePath.includes(`${path.sep}assets${path.sep}`);
  const body = readFileSync(filePath);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const httpServer = createServer(serveStatic);
const io = new Server<FullClientEvents, FullServerEvents>(httpServer, {
  cors: { origin: true, credentials: true }
});
installSocial(io);

function attachSocket(socketId: string, room: ServerRoom, player: ServerPlayer): void {
  player.socketId = socketId;
  player.connected = true;
  seats.set(socketId, { code: room.code, playerId: player.id });
  const socket = io.sockets.sockets.get(socketId);
  socket?.join(room.code);
}

function respond(ack: ((response: ActionAck) => void) | undefined, response: ActionAck): void {
  if (typeof ack === 'function') ack(response);
}

function joinRoomByCode(
  socketId: string,
  code: string,
  profile: { name: string; avatar: string },
  rejoinId?: string
) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'No encontramos esa sala. Revisa el código.' as string };

  if (rejoinId) {
    const player = room.players.find((item) => item.id === rejoinId);
    if (!player) return { error: 'Tu asiento ya no está en esta sala.' };
    attachSocket(socketId, room, player);
    return { room, player };
  }

  if (room.status !== 'waiting') return { error: 'Esa partida ya ha empezado.' };
  if (room.players.length >= 2) return { error: 'La sala está completa.' };

  const player: ServerPlayer = {
    id: uid(),
    name: cleanName(profile.name),
    avatar: cleanAvatar(profile.avatar),
    seat: 1,
    connected: true,
    socketId: null,
    lastChatAt: 0
  };
  room.players.push(player);
  attachSocket(socketId, room, player);
  if (!startGame(room)) {
    room.players.pop();
    return { error: 'Ese juego no está disponible online.' };
  }
  return { room, player };
}

io.on('connection', (socket) => {
  const finishAck = (response: ActionAck) => ({
    ...response,
    snapshot: response.snapshot
  });

  socket.on('room:create', (payload, ack) => {
    if (!payload || typeof payload !== 'object') {
      respond(ack, { ok: false, error: 'Datos incompletos.' });
      return;
    }
    const created = createRoom(String(payload.gameId), payload, false);
    if (!created) {
      respond(ack, { ok: false, error: 'Ese juego no está disponible online.' });
      return;
    }
    attachSocket(socket.id, created.room, created.player);
    broadcast(created.room);
    respond(ack, finishAck({ ok: true, code: created.room.code, playerId: created.player.id, snapshot: snapshot(created.room) }));
  });

  socket.on('room:quick', (payload, ack) => {
    if (!payload || typeof payload !== 'object') {
      respond(ack, { ok: false, error: 'Datos incompletos.' });
      return;
    }
    const gameId = String(payload.gameId);
    if (!onlineGame(gameId)) {
      respond(ack, { ok: false, error: 'Ese juego no está disponible online.' });
      return;
    }
    const waiting = [...rooms.values()].find(
      (room) => room.quick && room.status === 'waiting' && room.gameId === gameId && room.players.length === 1
    );
    if (waiting) {
      const joined = joinRoomByCode(socket.id, waiting.code, payload);
      if ('error' in joined) {
        respond(ack, { ok: false, error: joined.error });
        return;
      }
      broadcast(joined.room);
      respond(
        ack,
        finishAck({ ok: true, code: joined.room.code, playerId: joined.player.id, snapshot: snapshot(joined.room) })
      );
      return;
    }
    const created = createRoom(gameId, payload, true);
    if (!created) {
      respond(ack, { ok: false, error: 'Ese juego no está disponible online.' });
      return;
    }
    attachSocket(socket.id, created.room, created.player);
    respond(ack, finishAck({ ok: true, code: created.room.code, playerId: created.player.id, snapshot: snapshot(created.room) }));
  });

  socket.on('room:join', (payload, ack) => {
    if (!payload || typeof payload !== 'object' || !payload.code) {
      respond(ack, { ok: false, error: 'Falta el código de la sala.' });
      return;
    }
    const joined = joinRoomByCode(socket.id, String(payload.code), payload);
    if ('error' in joined) {
      respond(ack, { ok: false, error: joined.error });
      return;
    }
    broadcast(joined.room);
    respond(
      ack,
      finishAck({ ok: true, code: joined.room.code, playerId: joined.player.id, snapshot: snapshot(joined.room) })
    );
  });

  socket.on('room:rejoin', (payload, ack) => {
    if (!payload || !payload.code || !payload.playerId) {
      respond(ack, { ok: false, error: 'No se pudo recuperar la partida.' });
      return;
    }
    const joined = joinRoomByCode(socket.id, String(payload.code), { name: 'Jugador', avatar: '🙂' }, String(payload.playerId));
    if ('error' in joined) {
      respond(ack, { ok: false, error: joined.error });
      return;
    }
    broadcast(joined.room);
    respond(
      ack,
      finishAck({ ok: true, code: joined.room.code, playerId: joined.player.id, snapshot: snapshot(joined.room) })
    );
  });

  socket.on('room:leave', (payload) => {
    const seat = seats.get(socket.id);
    if (!seat || !payload || seat.code !== String(payload.code).toUpperCase()) return;
    const room = rooms.get(seat.code);
    seats.delete(socket.id);
    socket.leave(seat.code);
    if (!room) return;
    const player = room.players.find((item) => item.id === seat.playerId);
    if (player) {
      player.connected = false;
      player.socketId = null;
    }
    if (room.status === 'waiting') {
      for (const other of room.players) {
        other.connected = false;
        if (other.socketId) {
          const otherSocket = io.sockets.sockets.get(other.socketId);
          otherSocket?.leave(room.code);
          seats.delete(other.socketId);
          other.socketId = null;
        }
      }
      io.to(room.code).emit('room:closed', { reason: 'El anfitrión ha cerrado la sala.' });
      rooms.delete(room.code);
      return;
    }
    if (room.status === 'playing') {
      const partner = partnerOf(room, seat.playerId);
      finishRoom(room, {
        winner: partner && partner.connected ? partner.seat : null,
        reason: 'El rival ha abandonado la partida.'
      });
    }
    if (room.players.every((item) => !item.connected)) {
      rooms.delete(room.code);
      return;
    }
    broadcast(room);
  });

  socket.on('game:move', (payload, ack) => {
    const seat = seats.get(socket.id);
    const room = seat ? rooms.get(seat.code) : undefined;
    if (!seat || !room) {
      respond(ack, { ok: false, error: 'No estás en una sala.' });
      return;
    }
    if (payload && payload.code && String(payload.code).toUpperCase() !== room.code) {
      respond(ack, { ok: false, error: 'Sala incorrecta.' });
      return;
    }
    const player = room.players.find((item) => item.id === seat.playerId);
    if (!player) {
      respond(ack, { ok: false, error: 'Jugador desconocido.' });
      return;
    }
    const error = applyMove(room, player, payload?.move);
    if (error) {
      respond(ack, { ok: false, error });
      return;
    }
    broadcast(room);
    respond(ack, { ok: true, snapshot: snapshot(room) });
  });

  socket.on('chat:send', (payload, ack) => {
    const seat = seats.get(socket.id);
    const room = seat ? rooms.get(seat.code) : undefined;
    if (!seat || !room) {
      respond(ack, { ok: false, error: 'No estás en una sala.' });
      return;
    }
    const player = room.players.find((item) => item.id === seat.playerId);
    const text = cleanText(payload?.text);
    if (!player) {
      respond(ack, { ok: false, error: 'Jugador desconocido.' });
      return;
    }
    if (!text) {
      respond(ack, { ok: false, error: 'Escribe un mensaje.' });
      return;
    }
    const now = Date.now();
    if (now - player.lastChatAt < 1200) {
      respond(ack, { ok: false, error: 'Espera un segundo entre mensajes.' });
      return;
    }
    player.lastChatAt = now;
    const message: ChatMessage = {
      id: uid(),
      playerId: player.id,
      name: player.name,
      text,
      at: now
    };
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
    broadcast(room);
    respond(ack, { ok: true });
  });

  socket.on('room:rematch', (payload, ack) => {
    const seat = seats.get(socket.id);
    const room = seat ? rooms.get(seat.code) : undefined;
    if (!seat || !room || (payload && payload.code && String(payload.code).toUpperCase() !== room.code)) {
      respond(ack, { ok: false, error: 'No estás en una sala.' });
      return;
    }
    if (room.status !== 'ended') {
      respond(ack, { ok: false, error: 'La partida todavía no ha terminado.' });
      return;
    }
    room.rematchVotes.add(seat.playerId);
    const partner = partnerOf(room, seat.playerId);
    if (partner && !partner.connected) {
      respond(ack, { ok: false, error: 'Tu rival se ha desconectado.' });
      return;
    }
    if (room.rematchVotes.size < 2) {
      io.to(room.code).emit('toast', { message: 'Tu rival quiere la revancha.' });
      respond(ack, { ok: true });
      return;
    }
    if (!startGame(room)) {
      respond(ack, { ok: false, error: 'No se pudo iniciar la revancha.' });
      return;
    }
    broadcast(room);
    respond(ack, { ok: true, snapshot: snapshot(room) });
  });

  socket.on('disconnect', () => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    seats.delete(socket.id);
    const room = rooms.get(seat.code);
    if (!room) return;
    const player = room.players.find((item) => item.id === seat.playerId);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    if (room.status === 'waiting') {
      io.to(room.code).emit('room:closed', { reason: 'El anfitrión se ha desconectado.' });
      rooms.delete(room.code);
      return;
    }
    broadcast(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status !== 'playing' || !room.game) continue;
    if (room.game.deadline > now) continue;
    const game = room.game;
    if (game.kind === 'trivia') {
      if (game.phase === 'question') {
        game.phase = 'reveal';
        game.correct = game.questions[game.index]?.answer ?? null;
        game.deadline = now + REVEAL_MS;
        broadcast(room);
      } else {
        advanceTrivia(room, game);
        broadcast(room);
      }
      continue;
    }
    skipBoardTurn(room, game);
    broadcast(room);
  }
}, 1000).unref();

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const age = now - room.createdAt;
    const nobody = room.players.every((player) => !player.connected);
    if ((room.status === 'ended' && age > 20 * 60_000) || (nobody && age > 10 * 60_000) || age > 3 * 60 * 60_000) {
      rooms.delete(code);
    }
  }
}, 60_000).unref();

httpServer.listen(PORT, () => {
  console.log(`Recreo online en http://localhost:${PORT}`);
});
