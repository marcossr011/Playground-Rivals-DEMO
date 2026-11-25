export type Category =
  | 'Puzzle'
  | 'Cartas'
  | 'Palabras'
  | 'Trivia'
  | 'Arcade'
  | 'Estrategia'
  | 'Fiesta'
  | 'Aire libre';

export type PlayMode = 'solo' | 'local' | 'online';

export type Difficulty = 'Fácil' | 'Medio' | 'Difícil';

export type FamilyId =
  | 'memory'
  | 'wordsearch'
  | 'hangman'
  | 'anagram'
  | 'wordguess'
  | 'trivia'
  | 'math'
  | 'klondike'
  | 'pyramid'
  | 'blackjack'
  | 'war'
  | 'higherlower'
  | 'ttt'
  | 'connect4'
  | 'reversi'
  | '2048'
  | 'minesweeper'
  | 'sudoku'
  | 'sliding'
  | 'maze'
  | 'lightsout'
  | 'snake'
  | 'simon'
  | 'reaction'
  | 'whack'
  | 'aim'
  | 'charades'
  | 'impostor'
  | 'outdoor';

export interface GameMeta {
  id: string;
  title: string;
  blurb: string;
  family: FamilyId;
  category: Category;
  emoji: string;
  config: Record<string, unknown>;
  modes: PlayMode[];
  players: string;
  difficulty?: Difficulty;
  duration?: string;
  tags: string[];
  featured?: boolean;
  variantOf?: string;
}

export interface WordTheme {
  id: string;
  name: string;
  emoji: string;
  words: string[];
}

export interface MemoryTheme {
  id: string;
  name: string;
  emoji: string;
  items: string[];
}

export type Continent = 'Europa' | 'América' | 'Asia' | 'África' | 'Oceanía';

export interface Country {
  name: string;
  capital: string;
  flag: string;
  continent: Continent;
  tier: 1 | 2 | 3;
}

export interface CharadesCategory {
  id: string;
  name: string;
  emoji: string;
  easy: string[];
  normal: string[];
  hard: string[];
}

export interface ImpostorPack {
  id: string;
  name: string;
  emoji: string;
  words: string[];
}

export type OutdoorCategory =
  | 'Persecución'
  | 'Escondite'
  | 'Equipos'
  | 'Habilidad'
  | 'Fiesta'
  | 'Nocturno';

export interface OutdoorGame {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  category: OutdoorCategory;
  players: string;
  minPlayers: number;
  duration: string;
  space: string;
  materials: string[];
  objective: string;
  rules: string[];
  variants: string[];
  safety: string[];
  referee: {
    durationMinutes: number;
    teams: string[];
    scoreHint: string;
  };
  tags: string[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  photo?: string;
  photoSmall?: string;
  createdAt: number;
}

export interface GameStat {
  plays: number;
  wins: number;
  bestScore: number;
  lastPlayed: number;
}

export type ProfanityLevel = 'off' | 'soft' | 'strict';

export type ControlScheme = 'swipe' | 'joystick';

export type ThemeId = 'coral' | 'menta' | 'oceano' | 'violeta' | 'ambar' | 'rosa';

export interface LeagueState {
  points: number;
  streak: number;
  bestStreak: number;
  wins: number;
  losses: number;
}

export interface Friend {
  code: string;
  name: string;
  avatar: string;
  addedAt: number;
}

export interface FriendRequest {
  code: string;
  name: string;
  avatar: string;
  at: number;
  direction: 'incoming' | 'outgoing';
}

export interface StoredMessage {
  id: string;
  from: string;
  text: string;
  at: number;
}

export interface AppState {
  profile: PlayerProfile;
  favorites: string[];
  stats: Record<string, GameStat>;
  recent: string[];
  sound: boolean;
  haptics: boolean;
  onboarded: boolean;
  filter: ProfanityLevel;
  controls: ControlScheme;
  theme: ThemeId;
  league: LeagueState;
  friends: Friend[];
  friendRequests: FriendRequest[];
  chats: Record<string, StoredMessage[]>;
}
