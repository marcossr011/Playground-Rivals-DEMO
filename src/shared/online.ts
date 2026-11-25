import type { C4State } from './connect4';
import type { ReversiState } from './reversi';
import type { TttState } from './ttt';

export type OnlineGameId = 'ttt-3x3-normal' | 'c4-7x6-normal' | 'reversi-8x8-normal' | 'trivia-geo-mundo-mixto-medio';

export interface OnlineProfilePayload {
  name: string;
  avatar: string;
}

export interface OnlinePlayerPublic {
  id: string;
  name: string;
  avatar: string;
  seat: 0 | 1;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface MatchResult {
  winner: 0 | 1 | null;
  reason: string;
}

export interface PublicRoom {
  code: string;
  gameId: string;
  gameTitle: string;
  gameEmoji: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  quick: boolean;
  players: OnlinePlayerPublic[];
  chat: ChatMessage[];
  result: MatchResult | null;
}

export type GameSnapshot =
  | { kind: 'ttt'; state: TttState; deadline: number }
  | { kind: 'c4'; state: C4State; deadline: number }
  | { kind: 'reversi'; state: ReversiState; deadline: number }
  | {
      kind: 'trivia';
      index: number;
      total: number;
      prompt: string;
      visual?: string;
      options: string[];
      scores: [number, number];
      turn: 0 | 1;
      phase: 'question' | 'reveal';
      correct: number | null;
      deadline: number;
    };

export interface RoomSnapshot {
  room: PublicRoom;
  game: GameSnapshot | null;
}

export interface ActionAck {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  snapshot?: RoomSnapshot;
}

export interface ClientToServerEvents {
  'room:create': (payload: { gameId: string } & OnlineProfilePayload, ack: (response: ActionAck) => void) => void;
  'room:quick': (payload: { gameId: string } & OnlineProfilePayload, ack: (response: ActionAck) => void) => void;
  'room:join': (payload: { code: string } & OnlineProfilePayload, ack: (response: ActionAck) => void) => void;
  'room:rejoin': (payload: { code: string; playerId: string }, ack: (response: ActionAck) => void) => void;
  'room:leave': (payload: { code: string }) => void;
  'game:move': (payload: { code: string; move: unknown }, ack?: (response: ActionAck) => void) => void;
  'chat:send': (payload: { code: string; text: string }, ack?: (response: ActionAck) => void) => void;
  'room:rematch': (payload: { code: string }, ack?: (response: ActionAck) => void) => void;
}

export interface ServerToClientEvents {
  'room:update': (snapshot: RoomSnapshot) => void;
  'room:closed': (payload: { reason: string }) => void;
  'toast': (payload: { message: string }) => void;
}
