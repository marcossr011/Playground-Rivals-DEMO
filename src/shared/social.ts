import type { ClientToServerEvents, GameSnapshot, ServerToClientEvents } from './online';

export interface GeoPoint {
  lat: number;
  lng: number;
  at: number;
}

export interface OutdoorPlayerPublic {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  isHost: boolean;
  position: GeoPoint | null;
  pendingPosition: boolean;
  outside: boolean;
  outsideSince: number | null;
  eliminated: boolean;
}

export interface OutdoorZonePublic {
  lat: number;
  lng: number;
  radius: number;
}

export interface OutdoorResultPublic {
  winnerId: string | null;
  reason: string;
}

export interface OutdoorChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system: boolean;
}

export interface OutdoorRoomPublic {
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
  result: OutdoorResultPublic | null;
  players: OutdoorPlayerPublic[];
  chat: OutdoorChatMessage[];
}

export interface OutdoorSnapshot {
  room: OutdoorRoomPublic;
}

export interface OutdoorAck {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  snapshot?: OutdoorSnapshot;
}

export interface OutdoorProfilePayload {
  name: string;
  avatar: string;
}

export interface TournamentPlayerPublic {
  id: string;
  name: string;
  avatar: string;
  eliminated: boolean;
}

export interface TournamentMatchPublic {
  id: string;
  round: 0 | 1;
  a: string | null;
  b: string | null;
  winner: string | null;
  game: GameSnapshot | null;
}

export interface TournamentRoomPublic {
  code: string;
  gameId: string;
  gameTitle: string;
  gameEmoji: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  players: TournamentPlayerPublic[];
  matches: TournamentMatchPublic[];
  championId: string | null;
  chat: OutdoorChatMessage[];
  createdAt: number;
}

export interface TournamentSnapshot {
  room: TournamentRoomPublic;
}

export interface TournamentAck {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  snapshot?: TournamentSnapshot;
}

export interface DirectMessage {
  id: string;
  from: string;
  fromName: string;
  text: string;
  at: number;
}

export interface DmThreadAck {
  ok: boolean;
  error?: string;
  messages?: DirectMessage[];
}

export type ReportContext = 'room' | 'outdoor' | 'tournament' | 'dm';

export interface ReportPayload {
  context: ReportContext;
  code?: string;
  targetId?: string;
  targetName?: string;
  reason: string;
}

export interface FriendRequestPayload {
  code: string;
  name: string;
  avatar: string;
  at: number;
}

export interface ClientToServerSocialEvents {
  'friend:register': (payload: { code: string } & OutdoorProfilePayload, ack: (response: { ok: boolean; error?: string }) => void) => void;
  'friend:request': (payload: { targetCode: string } & OutdoorProfilePayload, ack: (response: { ok: boolean; error?: string }) => void) => void;
  'friend:accept': (payload: { code: string; name: string; avatar: string }, ack: (response: { ok: boolean; error?: string }) => void) => void;
  'friend:decline': (payload: { code: string }, ack: (response: { ok: boolean; error?: string }) => void) => void;
  'dm:history': (payload: { withCode: string }, ack: (response: DmThreadAck) => void) => void;
  'dm:send': (payload: { to: string; text: string }, ack: (response: { ok: boolean; error?: string }) => void) => void;
  'report:send': (payload: ReportPayload, ack: (response: { ok: boolean; error?: string }) => void) => void;

  'outdoor:create': (payload: { gameId: string } & OutdoorProfilePayload, ack: (response: OutdoorAck) => void) => void;
  'outdoor:join': (payload: { code: string } & OutdoorProfilePayload, ack: (response: OutdoorAck) => void) => void;
  'outdoor:rejoin': (payload: { code: string; playerId: string }, ack: (response: OutdoorAck) => void) => void;
  'outdoor:leave': (payload: { code: string }) => void;
  'outdoor:start': (payload: { code: string }, ack?: (response: OutdoorAck) => void) => void;
  'outdoor:config': (
    payload: { code: string; updateMinutes?: number; matchMinutes?: number; graceSeconds?: number },
    ack?: (response: OutdoorAck) => void
  ) => void;
  'outdoor:zone': (payload: { code: string; lat: number; lng: number; radius: number }, ack?: (response: OutdoorAck) => void) => void;
  'outdoor:position': (payload: { code: string; lat: number; lng: number }, ack?: (response: { ok: boolean; error?: string }) => void) => void;
  'outdoor:chat': (payload: { code: string; text: string }, ack?: (response: { ok: boolean; error?: string }) => void) => void;

  'tournament:join': (payload: { gameId: string } & OutdoorProfilePayload, ack: (response: TournamentAck) => void) => void;
  'tournament:leave': (payload: { code: string }) => void;
  'tournament:move': (payload: { code: string; matchId: string; move: unknown }, ack?: (response: TournamentAck) => void) => void;
  'tournament:chat': (payload: { code: string; text: string }, ack?: (response: { ok: boolean; error?: string }) => void) => void;
}

export interface ServerToClientSocialEvents {
  'friend:request': (payload: FriendRequestPayload) => void;
  'friend:accepted': (payload: FriendRequestPayload) => void;
  'friend:declined': (payload: { code: string }) => void;
  'outdoor:update': (snapshot: OutdoorSnapshot) => void;
  'outdoor:closed': (payload: { reason: string }) => void;
  'tournament:update': (snapshot: TournamentSnapshot) => void;
  'tournament:closed': (payload: { reason: string }) => void;
  'dm:message': (payload: { threadWith: string; message: DirectMessage }) => void;
  'social:toast': (payload: { message: string }) => void;
}

export function mergeEvents<A extends object, B extends object>(a: A, b: B): A & B {
  return { ...a, ...b };
}

export type FullClientEvents = ClientToServerEvents & ClientToServerSocialEvents;
export type FullServerEvents = ServerToClientEvents & ServerToClientSocialEvents;
