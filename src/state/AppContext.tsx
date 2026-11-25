import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AppState,
  ControlScheme,
  FamilyId,
  Friend,
  FriendRequest,
  LeagueState,
  PlayerProfile,
  ProfanityLevel,
  StoredMessage
} from '../types';
import { uid } from '../lib/random';
import { setHapticsEnabled, setSoundEnabled } from '../lib/audio';
import { leagueReward } from '../lib/leagues';
import { isImageAvatar } from '../lib/avatar';
import { DEFAULT_THEME, isThemeId } from '../lib/theme';

export const AVATARS = ['🦊', '🐼', '🦄', '🐙', '🐸', '🦁', '👾', '🐧', '🐨', '🐯', '🦋', '🐺', '🐳', '🌵', '⚡', '🍕'];

const STORAGE_KEY = 'recreo.state.v1';
const MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_LEAGUE: LeagueState = { points: 0, streak: 0, bestStreak: 0, wins: 0, losses: 0 };

function buildDefaultState(): AppState {
  const adjectives = ['Veloz', 'Astuto', 'Valiente', 'Curioso', 'Salvaje', 'Ágil'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  return {
    profile: {
      id: uid('p'),
      name: `Jugador ${adjective}`,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      createdAt: Date.now()
    },
    favorites: [],
    stats: {},
    recent: [],
    sound: true,
    haptics: true,
    onboarded: false,
    filter: 'strict',
    controls: 'swipe',
    theme: DEFAULT_THEME,
    league: DEFAULT_LEAGUE,
    friends: [],
    friendRequests: [],
    chats: {}
  };
}

function loadLeague(raw: unknown): LeagueState {
  if (!raw || typeof raw !== 'object') return DEFAULT_LEAGUE;
  const value = raw as Partial<LeagueState>;
  const num = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0);
  return {
    points: num(value.points),
    streak: num(value.streak),
    bestStreak: Math.max(num(value.bestStreak), num(value.streak)),
    wins: num(value.wins),
    losses: num(value.losses)
  };
}

function loadFriends(raw: unknown): Friend[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: Friend[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Partial<Friend>;
    if (typeof value.code !== 'string' || !value.code.trim()) continue;
    const code = value.code.trim().toUpperCase().slice(0, 8);
    if (seen.has(code)) continue;
    seen.add(code);
    result.push({
      code,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 20) : `Amigo ${code}`,
      avatar:
        typeof value.avatar === 'string' && value.avatar
          ? isImageAvatar(value.avatar)
            ? value.avatar
            : Array.from(value.avatar).slice(0, 2).join('')
          : '🙂',
      addedAt: typeof value.addedAt === 'number' ? value.addedAt : Date.now()
    });
  }
  return result.slice(0, 100);
}

function loadFriendRequests(raw: unknown): FriendRequest[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const result: FriendRequest[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Partial<FriendRequest>;
    if (typeof value.code !== 'string' || !value.code.trim()) continue;
    const code = value.code.trim().toUpperCase().slice(0, 8);
    if (seen.has(code) || (typeof value.at === 'number' && value.at < cutoff)) continue;
    seen.add(code);
    result.push({
      code,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 20) : `Amigo ${code}`,
      avatar: typeof value.avatar === 'string' && value.avatar ? value.avatar : '🙂',
      at: typeof value.at === 'number' ? value.at : Date.now(),
      direction: value.direction === 'outgoing' ? 'outgoing' : 'incoming'
    });
  }
  return result.slice(0, 100);
}

function loadChats(raw: unknown): Record<string, StoredMessage[]> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, StoredMessage[]> = {};
  const cutoff = Date.now() - MESSAGE_RETENTION_MS;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const messages = value
      .filter((item): item is StoredMessage => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : uid('m'),
        from: typeof item.from === 'string' ? item.from : 'them',
        text: typeof item.text === 'string' ? item.text.slice(0, 300) : '',
        at: typeof item.at === 'number' ? item.at : Date.now()
      }))
      .filter((item) => item.text)
      .filter((item) => item.at >= cutoff)
      .slice(-200);
    if (messages.length) result[key.toUpperCase()] = messages;
  }
  return result;
}

function loadState(): AppState {
  const defaults = buildDefaultState();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const rawProfile = { ...defaults.profile, ...(parsed.profile ?? {}) };
    const profile: PlayerProfile = {
      ...rawProfile,
      photo: isImageAvatar(rawProfile.photo) ? rawProfile.photo : undefined,
      photoSmall: isImageAvatar(rawProfile.photoSmall) ? rawProfile.photoSmall : undefined
    };
    if (profile.photo && !profile.photoSmall) profile.photoSmall = profile.photo;
    return {
      ...defaults,
      ...parsed,
      profile,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((id) => typeof id === 'string') : [],
      stats: parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {},
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((id) => typeof id === 'string').slice(0, 12) : [],
      sound: parsed.sound !== false,
      haptics: parsed.haptics !== false,
      onboarded: Boolean(parsed.onboarded),
      filter: parsed.filter === 'off' || parsed.filter === 'soft' || parsed.filter === 'strict' ? parsed.filter : 'strict',
      controls: parsed.controls === 'joystick' ? 'joystick' : 'swipe',
      theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
      league: loadLeague(parsed.league),
      friends: loadFriends(parsed.friends),
      friendRequests: loadFriendRequests(parsed.friendRequests),
      chats: loadChats(parsed.chats)
    };
  } catch {
    return defaults;
  }
}

export interface GameResult {
  score?: number;
  won?: boolean;
}

export interface OnboardingChoices {
  name?: string;
  avatar?: string;
  filter?: ProfanityLevel;
  controls?: ControlScheme;
}

interface AppContextValue {
  state: AppState;
  isFavorite: (gameId: string) => boolean;
  toggleFavorite: (gameId: string) => void;
  recordResult: (family: FamilyId, result: GameResult) => void;
  recordLeagueResult: (won: boolean) => void;
  markRecent: (gameId: string) => void;
  updateProfile: (patch: Partial<Pick<PlayerProfile, 'name' | 'avatar' | 'photo' | 'photoSmall'>>) => void;
  updateSettings: (
    patch: Partial<Pick<AppState, 'sound' | 'haptics' | 'filter' | 'controls' | 'theme'>>
  ) => void;
  completeOnboarding: (choices?: OnboardingChoices) => void;
  addFriend: (friend: Omit<Friend, 'addedAt'>) => void;
  addFriendRequest: (request: Omit<FriendRequest, 'at'> & { at?: number }) => void;
  resolveFriendRequest: (code: string) => void;
  removeFriend: (code: string) => void;
  appendMessage: (code: string, message: StoredMessage) => void;
  clearChat: (code: string) => void;
  resetProgress: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage can be full or blocked */
    }
  }, [state]);

  useEffect(() => {
    setSoundEnabled(state.sound);
    setHapticsEnabled(state.haptics);
  }, [state.sound, state.haptics]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const toggleFavorite = useCallback((gameId: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(gameId)
        ? prev.favorites.filter((id) => id !== gameId)
        : [gameId, ...prev.favorites].slice(0, 200)
    }));
  }, []);

  const isFavorite = useCallback((gameId: string) => state.favorites.includes(gameId), [state.favorites]);

  const recordResult = useCallback((family: FamilyId, result: GameResult) => {
    setState((prev) => {
      const current = prev.stats[family] ?? { plays: 0, wins: 0, bestScore: 0, lastPlayed: 0 };
      return {
        ...prev,
        stats: {
          ...prev.stats,
          [family]: {
            plays: current.plays + 1,
            wins: current.wins + (result.won ? 1 : 0),
            bestScore: Math.max(current.bestScore, Math.max(0, Math.round(result.score ?? 0))),
            lastPlayed: Date.now()
          }
        }
      };
    });
  }, []);

  const recordLeagueResult = useCallback((won: boolean) => {
    setState((prev) => {
      const reward = leagueReward(won, prev.league.streak);
      return {
        ...prev,
        league: {
          points: Math.max(0, prev.league.points + reward.points),
          streak: reward.streak,
          bestStreak: Math.max(prev.league.bestStreak, reward.streak),
          wins: prev.league.wins + (won ? 1 : 0),
          losses: prev.league.losses + (won ? 0 : 1)
        }
      };
    });
  }, []);

  const markRecent = useCallback((gameId: string) => {
    setState((prev) => ({
      ...prev,
      recent: [gameId, ...prev.recent.filter((id) => id !== gameId)].slice(0, 12)
    }));
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Pick<PlayerProfile, 'name' | 'avatar' | 'photo' | 'photoSmall'>>) => {
      setState((prev) => {
        const name = patch.name !== undefined ? patch.name.trim().slice(0, 20) : prev.profile.name;
        return {
          ...prev,
          profile: { ...prev.profile, ...patch, name: name || prev.profile.name }
        };
      });
    },
    []
  );

  const updateSettings = useCallback(
    (patch: Partial<Pick<AppState, 'sound' | 'haptics' | 'filter' | 'controls' | 'theme'>>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const completeOnboarding = useCallback((choices: OnboardingChoices = {}) => {
    setState((prev) => ({
      ...prev,
      onboarded: true,
      filter: choices.filter ?? prev.filter,
      controls: choices.controls ?? prev.controls,
      profile: {
        ...prev.profile,
        name: choices.name?.trim() ? choices.name.trim().slice(0, 20) : prev.profile.name,
        avatar: choices.avatar || prev.profile.avatar
      }
    }));
  }, []);

  const addFriend = useCallback((friend: Omit<Friend, 'addedAt'>) => {
    setState((prev) => {
      const code = friend.code.trim().toUpperCase().slice(0, 8);
      if (!code || code === friendCodeOf(prev.profile.id)) return prev;
      const entry: Friend = { ...friend, code, addedAt: Date.now() };
      return { ...prev, friends: [entry, ...prev.friends.filter((item) => item.code !== code)].slice(0, 100) };
    });
  }, []);

  const addFriendRequest = useCallback((request: Omit<FriendRequest, 'at'> & { at?: number }) => {
    setState((prev) => {
      const code = request.code.trim().toUpperCase().slice(0, 8);
      if (!code || code === friendCodeOf(prev.profile.id)) return prev;
      const entry: FriendRequest = { ...request, code, at: request.at ?? Date.now() };
      const others = prev.friendRequests.filter((item) => item.code !== code);
      return { ...prev, friendRequests: [entry, ...others].slice(0, 100) };
    });
  }, []);

  const resolveFriendRequest = useCallback((code: string) => {
    setState((prev) => ({
      ...prev,
      friendRequests: prev.friendRequests.filter((item) => item.code !== code.toUpperCase())
    }));
  }, []);

  const removeFriend = useCallback((code: string) => {
    setState((prev) => {
      const nextChats = { ...prev.chats };
      delete nextChats[code.toUpperCase()];
      return { ...prev, friends: prev.friends.filter((item) => item.code !== code.toUpperCase()), chats: nextChats };
    });
  }, []);

  const appendMessage = useCallback((code: string, message: StoredMessage) => {
    setState((prev) => {
      const key = code.toUpperCase();
      const cutoff = Date.now() - MESSAGE_RETENTION_MS;
      const thread = (prev.chats[key] ?? []).filter((item) => item.at >= cutoff);
      if (thread.some((item) => item.id === message.id)) return prev;
      return {
        ...prev,
        chats: { ...prev.chats, [key]: [...thread, message].slice(-200) }
      };
    });
  }, []);

  const clearChat = useCallback((code: string) => {
    setState((prev) => {
      const next = { ...prev.chats };
      delete next[code.toUpperCase()];
      return { ...prev, chats: next };
    });
  }, []);

  const resetProgress = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stats: {},
      recent: [],
      favorites: [],
      league: DEFAULT_LEAGUE
    }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      isFavorite,
      toggleFavorite,
      recordResult,
      recordLeagueResult,
      markRecent,
      updateProfile,
      updateSettings,
      completeOnboarding,
      addFriend,
      addFriendRequest,
      resolveFriendRequest,
      removeFriend,
      appendMessage,
      clearChat,
      resetProgress
    }),
    [
      state,
      isFavorite,
      toggleFavorite,
      recordResult,
      recordLeagueResult,
      markRecent,
      updateProfile,
      updateSettings,
      completeOnboarding,
      addFriend,
      addFriendRequest,
      resolveFriendRequest,
      removeFriend,
      appendMessage,
      clearChat,
      resetProgress
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function friendCodeOf(profileId: string): string {
  const clean = profileId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return (clean.slice(-6) || 'RECREO').padEnd(6, 'X');
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
