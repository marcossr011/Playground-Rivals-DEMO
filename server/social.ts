import type { Server } from 'socket.io';
import nodemailer from 'nodemailer';
import { getGame } from '../src/data/catalog';
import { uid } from '../src/lib/random';
import { applyC4, createC4, type C4State } from '../src/shared/connect4';
import { applyReversi, createReversi, legalMoves, countReversi, type ReversiState } from '../src/shared/reversi';
import { applyTtt, createTtt, type TttState } from '../src/shared/ttt';
import type { GameSnapshot } from '../src/shared/online';
import type {
  DirectMessage,
  DmThreadAck,
  FullClientEvents,
  FullServerEvents,
  GeoPoint,
  OutdoorAck,
  OutdoorChatMessage,
  OutdoorPlayerPublic,
  OutdoorRoomPublic,
  OutdoorSnapshot,
  OutdoorZonePublic,
  ReportPayload,
  TournamentAck,
  TournamentMatchPublic,
  TournamentPlayerPublic,
  TournamentRoomPublic,
  TournamentSnapshot
} from '../src/shared/social';

type SocialServer = Server<FullClientEvents, FullServerEvents>;

const OUTDOOR_UPDATE_MS = 5 * 60_000;
const OUTDOOR_MATCH_MS = 30 * 60_000;
const OUTDOOR_GRACE_MS = 60_000;
const OUTDOOR_ZONE_MIN = 50;
const OUTDOOR_ZONE_MAX = 50_000;
const OUTDOOR_ZONE_SHRINK = 0.85;
const MAX_OUTDOOR_PLAYERS = 24;
const MAX_CHAT = 60;
const MAX_DM = 200;
const TURN_MS = 45_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* ─────────────────────────── Utilidades ─────────────────────────── */

function makeCode(taken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 300; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!taken(code)) return code;
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

function cleanText(raw: unknown, max = 180): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10);
}

function respond<T>(ack: ((value: T) => void) | undefined, value: T): void {
  if (typeof ack === 'function') ack(value);
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radius = 6_371_000;
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ─────────────────────────── Salas de vida real ─────────────────────────── */

interface OutdoorPlayer extends OutdoorPlayerPublic {
  socketId: string | null;
  lastChatAt: number;
  pending: GeoPoint | null;
  latest: GeoPoint | null;
}

interface OutdoorRoom {
  code: string;
  gameId: string;
  gameTitle: string;
  gameEmoji: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  createdAt: number;
  nextReveal: number;
  updateEveryMs: number;
  graceMs: number;
  matchMs: number;
  endsAt: number;
  zone: OutdoorZonePublic | null;
  result: { winnerId: string | null; reason: string } | null;
  players: OutdoorPlayer[];
  chat: OutdoorChatMessage[];
}

const outdoorRooms = new Map<string, OutdoorRoom>();
const outdoorSeats = new Map<string, { code: string; playerId: string }>();
const reports: (ReportPayload & { reporterId: string; at: number })[] = [];

function publicOutdoor(room: OutdoorRoom): OutdoorRoomPublic {
  return {
    code: room.code,
    gameId: room.gameId,
    gameTitle: room.gameTitle,
    gameEmoji: room.gameEmoji,
    hostId: room.hostId,
    status: room.status,
    createdAt: room.createdAt,
    nextReveal: room.nextReveal,
    updateEveryMs: room.updateEveryMs,
    graceMs: room.graceMs,
    matchMs: room.matchMs,
    endsAt: room.endsAt,
    zone: room.zone,
    result: room.result,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      connected: player.connected,
      isHost: player.isHost,
      position: player.position,
      pendingPosition: Boolean(player.pending),
      outside: Boolean(
        room.zone && player.latest && distanceMeters(room.zone, player.latest) > room.zone.radius
      ),
      outsideSince: player.outsideSince,
      eliminated: player.eliminated
    })),
    chat: room.chat
  };
}

function outdoorSnapshot(room: OutdoorRoom): OutdoorSnapshot {
  return { room: publicOutdoor(room) };
}

function outdoorSystemMessage(room: OutdoorRoom, text: string): void {
  room.chat.push({ id: uid('m'), playerId: 'system', name: 'Recreo', text, at: Date.now(), system: true });
  if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
}

function broadcastOutdoor(io: SocialServer, room: OutdoorRoom): void {
  io.to(room.code).emit('outdoor:update', outdoorSnapshot(room));
}

function endOutdoorRoom(room: OutdoorRoom, winnerId: string | null, reason: string): void {
  if (room.status === 'ended') return;
  room.status = 'ended';
  room.result = { winnerId, reason };
  room.nextReveal = 0;
  outdoorSystemMessage(room, reason);
}

function shrinkOutdoorZone(room: OutdoorRoom): boolean {
  if (!room.zone) return false;
  const next = Math.max(OUTDOOR_ZONE_MIN, Math.round(room.zone.radius * OUTDOOR_ZONE_SHRINK));
  if (next >= room.zone.radius) return false;
  room.zone = { ...room.zone, radius: next };
  outdoorSystemMessage(room, `La zona se ha reducido a ${next} m de radio.`);
  return true;
}

function refreshOutdoorOutside(room: OutdoorRoom, now: number): boolean {
  if (!room.zone || room.status !== 'playing') return false;
  const zone = room.zone;
  let changed = false;
  for (const player of room.players) {
    if (player.eliminated || !player.latest) continue;
    const outside = distanceMeters(zone, player.latest) > zone.radius;
    if (outside) {
      if (player.outsideSince === null) {
        player.outsideSince = now;
        changed = true;
      }
      if (now - player.outsideSince >= room.graceMs) {
        player.eliminated = true;
        player.outsideSince = null;
        outdoorSystemMessage(room, `${player.name} ha quedado eliminado por pasar demasiado tiempo fuera de la zona.`);
        changed = true;
      }
    } else if (player.outsideSince !== null) {
      player.outsideSince = null;
      changed = true;
    }
  }
  const alive = room.players.filter((player) => !player.eliminated);
  if (alive.length === 0) {
    endOutdoorRoom(room, null, 'Nadie queda dentro de la zona.');
    changed = true;
  } else if (room.players.length > 1 && alive.length === 1) {
    endOutdoorRoom(room, alive[0].id, `¡${alive[0].name} gana! Es el último dentro de la zona.`);
    changed = true;
  }
  return changed;
}

function outdoorGameMeta(gameId: string): { title: string; emoji: string } | null {
  const meta = getGame(gameId);
  if (!meta || meta.family !== 'outdoor') return null;
  return { title: meta.title, emoji: meta.emoji };
}

function attachOutdoor(socketId: string, room: OutdoorRoom, player: OutdoorPlayer): void {
  player.socketId = socketId;
  player.connected = true;
  player.pending = player.pending ?? null;
  outdoorSeats.set(socketId, { code: room.code, playerId: player.id });
  ioRef?.sockets.sockets.get(socketId)?.join(room.code);
}

let ioRef: SocialServer | null = null;

function createOutdoorRoom(gameId: string, profile: { name: string; avatar: string }): OutdoorRoom | null {
  const meta = outdoorGameMeta(gameId);
  if (!meta) return null;
  const code = makeCode((candidate) => outdoorRooms.has(candidate));
  const host: OutdoorPlayer = {
    id: uid(),
    name: cleanName(profile.name),
    avatar: cleanAvatar(profile.avatar),
    connected: true,
    isHost: true,
    position: null,
    pendingPosition: false,
    outside: false,
    outsideSince: null,
    eliminated: false,
    socketId: null,
    lastChatAt: 0,
    pending: null,
    latest: null
  };
  const room: OutdoorRoom = {
    code,
    gameId,
    gameTitle: meta.title,
    gameEmoji: meta.emoji,
    hostId: host.id,
    status: 'waiting',
    createdAt: Date.now(),
    nextReveal: 0,
    updateEveryMs: OUTDOOR_UPDATE_MS,
    graceMs: OUTDOOR_GRACE_MS,
    matchMs: OUTDOOR_MATCH_MS,
    endsAt: 0,
    zone: null,
    result: null,
    players: [host],
    chat: []
  };
  outdoorSystemMessage(room, 'Sala creada. Solo tus amigos deberían tener este código.');
  outdoorRooms.set(code, room);
  return room;
}

/* ─────────────────────────── Torneos ─────────────────────────── */

type MatchGame =
  | { kind: 'ttt'; state: TttState; deadline: number }
  | { kind: 'c4'; state: C4State; deadline: number }
  | { kind: 'reversi'; state: ReversiState; deadline: number };

interface TournamentMatch {
  id: string;
  round: 0 | 1;
  a: string | null;
  b: string | null;
  winner: string | null;
  game: MatchGame | null;
}

interface TournamentPlayer extends TournamentPlayerPublic {
  socketId: string | null;
  lastChatAt: number;
}

interface TournamentRoom {
  code: string;
  gameId: string;
  gameTitle: string;
  gameEmoji: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  championId: string | null;
  chat: OutdoorChatMessage[];
  createdAt: number;
}

const tournamentRooms = new Map<string, TournamentRoom>();
const tournamentSeats = new Map<string, { code: string; playerId: string }>();

function createMatchGame(gameId: string): MatchGame | null {
  const meta = getGame(gameId);
  if (!meta) return null;
  if (gameId === 'ttt-3x3-normal') {
    return { kind: 'ttt', state: createTtt(Number(meta.config.size ?? 3), Number(meta.config.win ?? 3)), deadline: Date.now() + TURN_MS };
  }
  if (gameId === 'c4-7x6-normal') {
    return {
      kind: 'c4',
      state: createC4(Number(meta.config.cols ?? 7), Number(meta.config.rows ?? 6)),
      deadline: Date.now() + TURN_MS
    };
  }
  if (gameId === 'reversi-8x8-normal') {
    return { kind: 'reversi', state: createReversi(Number(meta.config.size ?? 8)), deadline: Date.now() + TURN_MS };
  }
  return null;
}

function gamePublic(game: MatchGame): GameSnapshot {
  if (game.kind === 'ttt') return { kind: 'ttt', state: game.state, deadline: game.deadline };
  if (game.kind === 'c4') return { kind: 'c4', state: game.state, deadline: game.deadline };
  return { kind: 'reversi', state: game.state, deadline: game.deadline };
}

function publicTournament(room: TournamentRoom): TournamentRoomPublic {
  const matches: TournamentMatchPublic[] = room.matches.map((match) => ({
    id: match.id,
    round: match.round,
    a: match.a,
    b: match.b,
    winner: match.winner,
    game: match.game ? gamePublic(match.game) : null
  }));
  return {
    code: room.code,
    gameId: room.gameId,
    gameTitle: room.gameTitle,
    gameEmoji: room.gameEmoji,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      eliminated: player.eliminated
    })),
    matches,
    championId: room.championId,
    chat: room.chat,
    createdAt: room.createdAt
  };
}

function tournamentSnapshot(room: TournamentRoom): TournamentSnapshot {
  return { room: publicTournament(room) };
}

function broadcastTournament(io: SocialServer, room: TournamentRoom): void {
  io.to(room.code).emit('tournament:update', tournamentSnapshot(room));
}

function tournamentSystem(room: TournamentRoom, text: string): void {
  room.chat.push({ id: uid('m'), playerId: 'system', name: 'Recreo', text, at: Date.now(), system: true });
  if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
}

function attachTournament(socketId: string, room: TournamentRoom, player: TournamentPlayer): void {
  player.socketId = socketId;
  tournamentSeats.set(socketId, { code: room.code, playerId: player.id });
  ioRef?.sockets.sockets.get(socketId)?.join(room.code);
}

function createTournament(gameId: string): TournamentRoom | null {
  if (!createMatchGame(gameId)) return null;
  const meta = getGame(gameId);
  if (!meta) return null;
  const code = makeCode((candidate) => tournamentRooms.has(candidate));
  const room: TournamentRoom = {
    code,
    gameId,
    gameTitle: meta.title,
    gameEmoji: meta.emoji,
    hostId: '',
    status: 'waiting',
    players: [],
    matches: [],
    championId: null,
    chat: [],
    createdAt: Date.now()
  };
  tournamentSystem(room, `Torneo de ${meta.title} para 4 jugadores.`);
  tournamentRooms.set(code, room);
  return room;
}

function startTournament(room: TournamentRoom): void {
  const order = [...room.players].sort(() => Math.random() - 0.5);
  room.hostId = order[0].id;
  const gameA = createMatchGame(room.gameId);
  const gameB = createMatchGame(room.gameId);
  if (!gameA || !gameB) return;
  room.matches = [
    { id: uid('semi'), round: 0, a: order[0].id, b: order[1].id, winner: null, game: gameA },
    { id: uid('semi'), round: 0, a: order[2].id, b: order[3].id, winner: null, game: gameB }
  ];
  room.status = 'playing';
  tournamentSystem(room, `¡Empieza el torneo! Semifinales: ${order[0].name} vs ${order[1].name} y ${order[2].name} vs ${order[3].name}.`);
}

function playerName(room: TournamentRoom, id: string | null): string {
  return room.players.find((player) => player.id === id)?.name ?? 'Jugador';
}

function concludeMatch(room: TournamentRoom, match: TournamentMatch): boolean {
  const game = match.game;
  if (!game || game.state.status === 'playing') return false;
  const winnerSlot = game.state.winner;
  match.winner = winnerSlot === 1 ? match.b : match.a;
  if (match.winner === match.a) {
    const loser = room.players.find((player) => player.id === match.b);
    if (loser && match.b) loser.eliminated = true;
  } else {
    const loser = room.players.find((player) => player.id === match.a);
    if (loser && match.a) loser.eliminated = true;
  }
  tournamentSystem(
    room,
    `Ganador de la ${match.round === 0 ? 'semifinal' : 'final'}: ${playerName(room, match.winner)}${winnerSlot === null ? ' (empate desempatado)' : ''}.`
  );
  const semis = room.matches.filter((item) => item.round === 0);
  if (room.matches.length === 2 && semis.every((item) => item.winner)) {
    const finalGame = createMatchGame(room.gameId);
    if (finalGame) {
      room.matches.push({
        id: uid('final'),
        round: 1,
        a: semis[0].winner,
        b: semis[1].winner,
        winner: null,
        game: finalGame
      });
      tournamentSystem(room, `Final: ${playerName(room, semis[0].winner)} vs ${playerName(room, semis[1].winner)}.`);
    }
  }
  if (match.round === 1 && match.winner) {
    room.status = 'ended';
    room.championId = match.winner;
    tournamentSystem(room, `¡${playerName(room, match.winner)} gana el torneo!`);
  }
  return true;
}

function applyTournamentMove(room: TournamentRoom, match: TournamentMatch, playerId: string, move: unknown): string | null {
  const game = match.game;
  if (!game || match.winner) return 'Ese cruce ya está decidido.';
  const slot = match.a === playerId ? 0 : match.b === playerId ? 1 : null;
  if (slot === null) return 'No juegas en ese cruce.';
  if (game.state.turn !== slot) return 'Le toca al rival.';
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
  concludeMatch(room, match);
  return null;
}

function skipTournamentTurn(room: TournamentRoom, match: TournamentMatch): void {
  const game = match.game;
  if (!game || match.winner) return;
  game.deadline = Date.now() + TURN_MS;
  if (game.kind === 'reversi') {
    const nextTurn = (game.state.turn === 0 ? 1 : 0) as 0 | 1;
    const moves = legalMoves(game.state.board, game.state.size, (nextTurn + 1) as 1 | 2);
    if (moves.size) {
      game.state.turn = nextTurn;
      return;
    }
    const counts = countReversi(game.state.board);
    game.state.winner = counts.black === counts.white ? null : counts.black > counts.white ? 0 : 1;
    game.state.status = counts.black === counts.white ? 'draw' : 'won';
    concludeMatch(room, match);
    return;
  }
  game.state.turn = game.state.turn === 0 ? 1 : 0;
}

/* ─────────────────────────── Mensajes privados ─────────────────────────── */

interface Registration {
  code: string;
  name: string;
  avatar: string;
}

const registrations = new Map<string, Registration>();
const dmThreads = new Map<string, DirectMessage[]>();
interface PendingFriendRequest {
  requesterCode: string;
  requesterName: string;
  requesterAvatar: string;
  targetCode: string;
  at: number;
}
const pendingFriendRequests = new Map<string, PendingFriendRequest>();

function threadKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function receiveDm(io: SocialServer, to: string, message: DirectMessage): void {
  for (const [socketId, registration] of registrations) {
    if (registration.code === to) io.to(socketId).emit('dm:message', { threadWith: message.from, message });
  }
}

async function deliverReportEmail(report: ReportPayload & { reporterId: string; at: number }): Promise<void> {
    const webhook = process.env.REPORT_WEBHOOK_URL?.trim();
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'jarvisai123455@gmail.com', report })
      });
      if (!response.ok) throw new Error(`Webhook de reportes HTTP ${response.status}`);
      return;
}

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) {
      throw new Error('Correo no configurado');
    }
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? 'true') !== 'false',
      auth: { user, pass }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || user,
      to: 'jarvisai123455@gmail.com',
      subject: `Reporte Recreo: ${report.context}`,
      text:
        `Contexto: ${report.context}\n` +
        `Código remitente: ${report.reporterId}\n` +
        `Objetivo: ${report.targetName ?? report.targetId ?? '-'}\n` +
        `Razón: ${report.reason}\n` +
        `Fecha: ${new Date(report.at).toISOString()}`
    });
  }
/* ─────────────────────────── Instalación ─────────────────────────── */

export function installSocial(io: SocialServer): void {
  ioRef = io;

  io.on('connection', (socket) => {
    socket.on('friend:register', (payload, ack) => {
      const code = cleanCode(payload?.code);
      if (code.length < 4) {
        respond(ack, { ok: false, error: 'Código de amigo inválido.' });
        return;
      }
      registrations.set(socket.id, { code, name: cleanName(payload.name), avatar: cleanAvatar(payload.avatar) });
      for (const request of pendingFriendRequests.values()) {
        if (request.targetCode !== code) continue;
        socket.emit('friend:request', {
          code: request.requesterCode,
          name: request.requesterName,
          avatar: request.requesterAvatar,
          at: request.at
        });
      }
      respond(ack, { ok: true });
    });

    socket.on('friend:request', (payload, ack) => {
      const me = registrations.get(socket.id);
      const targetCode = cleanCode(payload?.targetCode);
      if (!me || !targetCode) {
        respond(ack, { ok: false, error: 'Debes registrarte para enviar una solicitud.' });
        return;
      }
      if (targetCode === me.code) {
        respond(ack, { ok: false, error: 'No puedes añadirte a ti mismo.' });
        return;
      }
      const key = `${me.code}|${targetCode}`;
      const request: PendingFriendRequest = {
        requesterCode: me.code,
        requesterName: me.name,
        requesterAvatar: me.avatar,
        targetCode,
        at: Date.now()
      };
      pendingFriendRequests.set(key, request);
      for (const [socketId, registration] of registrations) {
        if (registration.code === targetCode) {
          io.to(socketId).emit('friend:request', {
            code: me.code,
            name: me.name,
            avatar: me.avatar,
            at: request.at
          });
        }
      }
      respond(ack, { ok: true });
    });

    socket.on('friend:accept', (payload, ack) => {
      const me = registrations.get(socket.id);
      const requesterCode = cleanCode(payload?.code);
      if (!me || !requesterCode) {
        respond(ack, { ok: false, error: 'Solicitud inválida.' });
        return;
      }
      const key = `${requesterCode}|${me.code}`;
      pendingFriendRequests.delete(key);
      const accepted = {
        code: me.code,
        name: cleanName(payload.name),
        avatar: cleanAvatar(payload.avatar),
        at: Date.now()
      };
      for (const [socketId, registration] of registrations) {
        if (registration.code === requesterCode) {
          io.to(socketId).emit('friend:accepted', accepted);
        }
      }
      respond(ack, { ok: true });
    });

    socket.on('friend:decline', (payload, ack) => {
      const me = registrations.get(socket.id);
      const requesterCode = cleanCode(payload?.code);
      if (!me || !requesterCode) {
        respond(ack, { ok: false, error: 'Solicitud inválida.' });
        return;
      }
      pendingFriendRequests.delete(`${requesterCode}|${me.code}`);
      for (const [socketId, registration] of registrations) {
        if (registration.code === requesterCode) io.to(socketId).emit('friend:declined', { code: me.code });
      }
      respond(ack, { ok: true });
    });

    socket.on('dm:history', (payload, ack: (response: DmThreadAck) => void) => {
      const me = registrations.get(socket.id);
      const withCode = cleanCode(payload?.withCode);
      if (!me || !withCode) {
        respond(ack, { ok: false, error: 'Debes registrarte para ver privados.' });
        return;
      }
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const messages = (dmThreads.get(threadKey(me.code, withCode)) ?? []).filter((message) => message.at >= cutoff);
      respond(ack, { ok: true, messages });
    });

    socket.on('dm:send', (payload, ack) => {
      const me = registrations.get(socket.id);
      const to = cleanCode(payload?.to);
      const text = cleanText(payload?.text, 160);
      if (!me || !to) {
        respond(ack, { ok: false, error: 'No se pudo enviar el mensaje.' });
        return;
      }
      if (!text) {
        respond(ack, { ok: false, error: 'Escribe un mensaje.' });
        return;
      }
      if (to === me.code) {
        respond(ack, { ok: false, error: 'No puedes escribirte a ti mismo.' });
        return;
      }
      const message: DirectMessage = { id: uid('dm'), from: me.code, fromName: me.name, text, at: Date.now() };
      const key = threadKey(me.code, to);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const thread = (dmThreads.get(key) ?? []).filter((item) => item.at >= cutoff);
      thread.push(message);
      if (thread.length > MAX_DM) thread.splice(0, thread.length - MAX_DM);
      dmThreads.set(key, thread);
      receiveDm(io, to, message);
      receiveDm(io, me.code, message);
      respond(ack, { ok: true });
    });

    socket.on('report:send', async (payload, ack) => {
      const reason = cleanText(payload?.reason, 120);
      if (!reason) {
        respond(ack, { ok: false, error: 'Cuéntanos qué ha pasado.' });
        return;
      }
      const report = { ...payload, reason, reporterId: registrations.get(socket.id)?.code ?? 'anon', at: Date.now() };
      reports.push(report);
      if (reports.length > 500) reports.splice(0, reports.length - 500);
      try {
        await deliverReportEmail(report);
        respond(ack, { ok: true });
        socket.emit('social:toast', { message: 'Reporte enviado por correo. Gracias por cuidar el recreo.' });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'No se pudo enviar';
        respond(ack, { ok: false, error: `Reporte guardado, pero no pudo enviarse por correo: ${detail}.` });
      }
    });

    /* ── Vida real ── */

    socket.on('outdoor:create', (payload, ack: (response: OutdoorAck) => void) => {
      const room = createOutdoorRoom(String(payload?.gameId), payload);
      if (!room) {
        respond(ack, { ok: false, error: 'Ese juego de calle no existe.' });
        return;
      }
      const host = room.players[0];
      attachOutdoor(socket.id, room, host);
      broadcastOutdoor(io, room);
      respond(ack, { ok: true, code: room.code, playerId: host.id, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:join', (payload, ack: (response: OutdoorAck) => void) => {
      const room = outdoorRooms.get(String(payload?.code ?? '').toUpperCase());
      if (!room) {
        respond(ack, { ok: false, error: 'No encontramos esa sala de calle.' });
        return;
      }
      if (room.players.length >= MAX_OUTDOOR_PLAYERS) {
        respond(ack, { ok: false, error: 'La sala está completa (24 jugadores).' });
        return;
      }
      const player: OutdoorPlayer = {
        id: uid('p'),
        name: cleanName(payload.name),
        avatar: cleanAvatar(payload.avatar),
        connected: true,
        isHost: false,
        position: null,
        pendingPosition: false,
        outside: false,
        outsideSince: null,
        eliminated: false,
        socketId: null,
        lastChatAt: 0,
        pending: null,
        latest: null
      };
      room.players.push(player);
      attachOutdoor(socket.id, room, player);
      outdoorSystemMessage(room, `${player.name} se ha unido.`);
      broadcastOutdoor(io, room);
      respond(ack, { ok: true, code: room.code, playerId: player.id, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:rejoin', (payload, ack: (response: OutdoorAck) => void) => {
      const room = outdoorRooms.get(String(payload?.code ?? '').toUpperCase());
      const player = room?.players.find((item) => item.id === payload?.playerId);
      if (!room || !player) {
        respond(ack, { ok: false, error: 'Tu asiento ya no está en esa sala.' });
        return;
      }
      attachOutdoor(socket.id, room, player);
      broadcastOutdoor(io, room);
      respond(ack, { ok: true, code: room.code, playerId: player.id, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:start', (payload, ack?: (response: OutdoorAck) => void) => {
      const seat = outdoorSeats.get(socket.id);
      const room = seat ? outdoorRooms.get(seat.code) : undefined;
      if (!room || !seat) {
        respond(ack, { ok: false, error: 'No estás en una sala.' });
        return;
      }
      if (room.hostId !== seat.playerId) {
        respond(ack, { ok: false, error: 'Solo el anfitrión puede empezar.' });
        return;
      }
      if (!room.zone) {
        respond(ack, { ok: false, error: 'Define la zona de juego antes de empezar.' });
        return;
      }
      const now = Date.now();
      room.status = 'playing';
      room.nextReveal = now + room.updateEveryMs;
      room.endsAt = now + room.matchMs;
      room.result = null;
      for (const player of room.players) {
        player.outsideSince = null;
        player.eliminated = false;
      }
      outdoorSystemMessage(
        room,
        `La partida ha empezado: ${Math.max(1, Math.round(room.matchMs / 60_000))} min de juego y la zona se actualiza cada ${Math.max(
          1,
          Math.round(room.updateEveryMs / 60_000)
        )} min.`
      );
      broadcastOutdoor(io, room);
      respond(ack, { ok: true, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:config', (payload, ack?: (response: OutdoorAck) => void) => {
      const seat = outdoorSeats.get(socket.id);
      const room = seat ? outdoorRooms.get(seat.code) : undefined;
      if (!room || !seat) {
        respond(ack, { ok: false, error: 'No estás en una sala.' });
        return;
      }
      if (room.hostId !== seat.playerId) {
        respond(ack, { ok: false, error: 'Solo el anfitrión ajusta la partida.' });
        return;
      }
      if (room.status !== 'waiting') {
        respond(ack, { ok: false, error: 'Los tiempos ya no se pueden cambiar con la partida en marcha.' });
        return;
      }
      const clamp = (raw: unknown, current: number, min: number, max: number) => {
        const value = Number(raw);
        return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : current;
      };
      const updateMs = clamp(payload?.updateMinutes, room.updateEveryMs / 60_000, 1, 30) * 60_000;
      const matchMs = clamp(payload?.matchMinutes, room.matchMs / 60_000, 5, 180) * 60_000;
      const graceMs = clamp(payload?.graceSeconds, room.graceMs / 1000, 15, 600) * 1000;
      const changed = updateMs !== room.updateEveryMs || matchMs !== room.matchMs || graceMs !== room.graceMs;
      room.updateEveryMs = updateMs;
      room.matchMs = matchMs;
      room.graceMs = graceMs;
      if (changed) {
        outdoorSystemMessage(
          room,
          `Ajustes: partida de ${matchMs / 60_000} min, zona cada ${updateMs / 60_000} min, eliminación tras ${graceMs / 1000} s fuera.`
        );
        broadcastOutdoor(io, room);
      }
      respond(ack, { ok: true, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:zone', (payload, ack?: (response: OutdoorAck) => void) => {
      const seat = outdoorSeats.get(socket.id);
      const room = seat ? outdoorRooms.get(seat.code) : undefined;
      if (!room || !seat) {
        respond(ack, { ok: false, error: 'No estás en una sala.' });
        return;
      }
      if (room.hostId !== seat.playerId) {
        respond(ack, { ok: false, error: 'Solo el anfitrión define la zona.' });
        return;
      }
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);
      const radius = Math.min(OUTDOOR_ZONE_MAX, Math.max(OUTDOOR_ZONE_MIN, Number(payload?.radius) || 300));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        respond(ack, { ok: false, error: 'Coordenadas inválidas.' });
        return;
      }
      if (room.status === 'ended') {
        respond(ack, { ok: false, error: 'La partida ya ha terminado.' });
        return;
      }
      room.zone = { lat, lng, radius };
      outdoorSystemMessage(room, `Zona de juego ajustada (${radius} m de radio).`);
      refreshOutdoorOutside(room, Date.now());
      broadcastOutdoor(io, room);
      respond(ack, { ok: true, snapshot: outdoorSnapshot(room) });
    });

    socket.on('outdoor:position', (payload, ack?: (response: { ok: boolean; error?: string }) => void) => {
      const seat = outdoorSeats.get(socket.id);
      const room = seat ? outdoorRooms.get(seat.code) : undefined;
      const player = room && seat ? room.players.find((item) => item.id === seat.playerId) : undefined;
      if (!room || !player) {
        respond(ack, { ok: false, error: 'No estás en una sala.' });
        return;
      }
      if (room.status !== 'playing') {
        respond(ack, { ok: false, error: room.status === 'ended' ? 'La partida ya ha terminado.' : 'La partida todavía no ha empezado.' });
        return;
      }
      if (player.eliminated) {
        respond(ack, { ok: false, error: 'Estás eliminado: ya no cuentas tu posición.' });
        return;
      }
      if (!room.zone) {
        respond(ack, { ok: false, error: 'La zona de juego aún no está definida.' });
        return;
      }
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        respond(ack, { ok: false, error: 'Ubicación inválida.' });
        return;
      }
      const now = Date.now();
      const point = { lat, lng, at: now };
      player.latest = point;
      if (distanceMeters(room.zone, point) > room.zone.radius) {
        player.position = point;
        player.pending = null;
        if (player.outsideSince === null) player.outsideSince = now;
      } else {
        player.pending = point;
        player.outsideSince = null;
      }
      broadcastOutdoor(io, room);
      respond(ack, { ok: true });
    });

    socket.on('outdoor:chat', (payload, ack?: (response: { ok: boolean; error?: string }) => void) => {
      const seat = outdoorSeats.get(socket.id);
      const room = seat ? outdoorRooms.get(seat.code) : undefined;
      const player = room && seat ? room.players.find((item) => item.id === seat.playerId) : undefined;
      const text = cleanText(payload?.text);
      if (!room || !player) {
        respond(ack, { ok: false, error: 'No estás en una sala.' });
        return;
      }
      if (!text) {
        respond(ack, { ok: false, error: 'Escribe un mensaje.' });
        return;
      }
      const now = Date.now();
      if (now - player.lastChatAt < 1000) {
        respond(ack, { ok: false, error: 'Espera un segundo entre mensajes.' });
        return;
      }
      player.lastChatAt = now;
      room.chat.push({ id: uid('m'), playerId: player.id, name: player.name, text, at: now, system: false });
      if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
      broadcastOutdoor(io, room);
      respond(ack, { ok: true });
    });

    socket.on('outdoor:leave', (payload) => {
      const seat = outdoorSeats.get(socket.id);
      if (!seat || String(payload?.code ?? '').toUpperCase() !== seat.code) return;
      const room = outdoorRooms.get(seat.code);
      outdoorSeats.delete(socket.id);
      socket.leave(seat.code);
      if (!room) return;
      const player = room.players.find((item) => item.id === seat.playerId);
      if (player) player.connected = false;
      if (room.players.every((item) => !item.connected)) {
        outdoorRooms.delete(room.code);
        return;
      }
      if (room.hostId === seat.playerId) {
        const next = room.players.find((item) => item.connected);
        if (next) {
          next.isHost = true;
          room.hostId = next.id;
        }
      }
      broadcastOutdoor(io, room);
    });

    /* ── Torneos ── */

    socket.on('tournament:join', (payload, ack: (response: TournamentAck) => void) => {
      const gameId = String(payload?.gameId);
      const waiting = [...tournamentRooms.values()].find(
        (room) => room.status === 'waiting' && room.gameId === gameId && room.players.length < 4
      );
      const room = waiting ?? createTournament(gameId);
      if (!room) {
        respond(ack, { ok: false, error: 'Ese juego no admite torneos.' });
        return;
      }
      const player: TournamentPlayer = {
        id: uid('p'),
        name: cleanName(payload.name),
        avatar: cleanAvatar(payload.avatar),
        eliminated: false,
        socketId: null,
        lastChatAt: 0
      };
      room.players.push(player);
      attachTournament(socket.id, room, player);
      tournamentSystem(room, `${player.name} entra en el torneo (${room.players.length}/4).`);
      if (room.players.length === 4) startTournament(room);
      broadcastTournament(io, room);
      respond(ack, { ok: true, code: room.code, playerId: player.id, snapshot: tournamentSnapshot(room) });
    });

    socket.on('tournament:move', (payload, ack?: (response: TournamentAck) => void) => {
      const seat = tournamentSeats.get(socket.id);
      const room = seat ? tournamentRooms.get(seat.code) : undefined;
      const match = room?.matches.find((item) => item.id === payload?.matchId);
      if (!room || !seat || !match) {
        respond(ack, { ok: false, error: 'Cruce no encontrado.' });
        return;
      }
      const error = applyTournamentMove(room, match, seat.playerId, payload.move);
      if (error) {
        respond(ack, { ok: false, error });
        return;
      }
      broadcastTournament(io, room);
      respond(ack, { ok: true, snapshot: tournamentSnapshot(room) });
    });

    socket.on('tournament:chat', (payload, ack?: (response: { ok: boolean; error?: string }) => void) => {
      const seat = tournamentSeats.get(socket.id);
      const room = seat ? tournamentRooms.get(seat.code) : undefined;
      const player = room && seat ? room.players.find((item) => item.id === seat.playerId) : undefined;
      const text = cleanText(payload?.text);
      if (!room || !player) {
        respond(ack, { ok: false, error: 'No estás en un torneo.' });
        return;
      }
      if (!text) {
        respond(ack, { ok: false, error: 'Escribe un mensaje.' });
        return;
      }
      const now = Date.now();
      if (now - player.lastChatAt < 1000) {
        respond(ack, { ok: false, error: 'Espera un segundo entre mensajes.' });
        return;
      }
      player.lastChatAt = now;
      room.chat.push({ id: uid('m'), playerId: player.id, name: player.name, text, at: now, system: false });
      if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
      broadcastTournament(io, room);
      respond(ack, { ok: true });
    });

    socket.on('tournament:leave', (payload) => {
      const seat = tournamentSeats.get(socket.id);
      if (!seat || String(payload?.code ?? '').toUpperCase() !== seat.code) return;
      const room = tournamentRooms.get(seat.code);
      tournamentSeats.delete(socket.id);
      socket.leave(seat.code);
      if (!room) return;
      const player = room.players.find((item) => item.id === seat.playerId);
      if (!player) return;
      if (room.status === 'waiting') {
        room.players = room.players.filter((item) => item.id !== player.id);
        if (!room.players.length) tournamentRooms.delete(room.code);
        else {
          tournamentSystem(room, `${player.name} sale del torneo (${room.players.length}/4).`);
          broadcastTournament(io, room);
        }
        return;
      }
      // En partida: se le da por perdido el cruce activo.
      const active = room.matches.find(
        (match) => !match.winner && match.game?.state.status === 'playing' && (match.a === player.id || match.b === player.id)
      );
      if (active) {
        active.winner = active.a === player.id ? active.b : active.a;
        player.eliminated = true;
        if (active.game) active.game.deadline = Date.now();
        concludeMatch(room, active);
        broadcastTournament(io, room);
      }
    });

    socket.on('disconnect', () => {
      registrations.delete(socket.id);
      const outdoorSeat = outdoorSeats.get(socket.id);
      if (outdoorSeat) {
        outdoorSeats.delete(socket.id);
        const room = outdoorRooms.get(outdoorSeat.code);
        const player = room?.players.find((item) => item.id === outdoorSeat.playerId);
        if (room && player) {
          player.connected = false;
          if (room.players.every((item) => !item.connected)) outdoorRooms.delete(room.code);
          else broadcastOutdoor(io, room);
        }
      }
      const tournamentSeat = tournamentSeats.get(socket.id);
      if (tournamentSeat) {
        tournamentSeats.delete(socket.id);
        const room = tournamentRooms.get(tournamentSeat.code);
        const player = room?.players.find((item) => item.id === tournamentSeat.playerId);
        if (room && player) {
          player.socketId = null;
          broadcastTournament(io, room);
        }
      }
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const room of outdoorRooms.values()) {
      if (room.status !== 'playing') continue;
      let changed = false;
      if (room.endsAt > 0 && now >= room.endsAt) {
        const alive = room.players.filter((player) => !player.eliminated);
        endOutdoorRoom(
          room,
          alive.length === 1 ? alive[0].id : null,
          alive.length === 1 ? `¡${alive[0].name} gana! Se acabó el tiempo.` : 'Se acabó el tiempo. Partida terminada.'
        );
        broadcastOutdoor(io, room);
        continue;
      }
      if (room.nextReveal === 0) {
        room.nextReveal = now + room.updateEveryMs;
        changed = true;
      }
      if (now >= room.nextReveal) {
        for (const player of room.players) {
          if (player.pending) {
            player.position = player.pending;
            player.pending = null;
            changed = true;
          }
        }
        if (shrinkOutdoorZone(room)) changed = true;
        do {
          room.nextReveal += room.updateEveryMs;
        } while (room.nextReveal <= now);
        changed = true;
      }
      if (refreshOutdoorOutside(room, now)) changed = true;
      if (changed) broadcastOutdoor(io, room);
    }
  }, 2000).unref();

  setInterval(() => {
    const now = Date.now();
    for (const room of tournamentRooms.values()) {
      if (room.status !== 'playing') continue;
      for (const match of room.matches) {
        if (match.winner || !match.game || match.game.state.status !== 'playing') continue;
        if (match.game.deadline > now) continue;
        skipTournamentTurn(room, match);
      }
      broadcastTournament(io, room);
    }
  }, 1000).unref();

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of outdoorRooms) {
      if (now - room.createdAt > 8 * 60 * 60_000) outdoorRooms.delete(code);
    }
    for (const [code, room] of tournamentRooms) {
      if (now - room.createdAt > 3 * 60 * 60_000) tournamentRooms.delete(code);
    }
    while (reports.length > 500) reports.shift();
  }, 60_000).unref();
}

export function outdoorRoomCount(): number {
  return outdoorRooms.size;
}

export function tournamentRoomCount(): number {
  return tournamentRooms.size;
}
