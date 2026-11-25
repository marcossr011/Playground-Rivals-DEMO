import type { LeagueState } from '../types';

export interface LeagueTier {
  id: string;
  name: string;
  emoji: string;
  minPoints: number;
  minStreak: number;
}

export const LEAGUE_TIERS: LeagueTier[] = [
  { id: 'bronce', name: 'Bronce', emoji: '🥉', minPoints: 0, minStreak: 0 },
  { id: 'plata', name: 'Plata', emoji: '🥈', minPoints: 120, minStreak: 3 },
  { id: 'oro', name: 'Oro', emoji: '🥇', minPoints: 300, minStreak: 5 },
  { id: 'platino', name: 'Platino', emoji: '💠', minPoints: 600, minStreak: 8 },
  { id: 'diamante', name: 'Diamante', emoji: '💎', minPoints: 1000, minStreak: 12 },
  { id: 'leyenda', name: 'Leyenda', emoji: '👑', minPoints: 1500, minStreak: 20 }
];

export function tierFor(league: LeagueState): LeagueTier {
  return [...LEAGUE_TIERS]
    .reverse()
    .find((tier) => league.points >= tier.minPoints || league.bestStreak >= tier.minStreak) ?? LEAGUE_TIERS[0];
}

export function nextTier(league: LeagueState): LeagueTier | null {
  const current = tierFor(league);
  const index = LEAGUE_TIERS.findIndex((tier) => tier.id === current.id);
  return LEAGUE_TIERS[index + 1] ?? null;
}

export function leagueProgress(league: LeagueState): { tier: LeagueTier; next: LeagueTier | null; percent: number; pointsToNext: number; streakToNext: number } {
  const tier = tierFor(league);
  const next = nextTier(league);
  if (!next) return { tier, next: null, percent: 100, pointsToNext: 0, streakToNext: 0 };
  const span = Math.max(1, next.minPoints - tier.minPoints);
  const percent = Math.max(0, Math.min(100, Math.round(((league.points - tier.minPoints) / span) * 100)));
  return {
    tier,
    next,
    percent,
    pointsToNext: Math.max(0, next.minPoints - league.points),
    streakToNext: Math.max(0, next.minStreak - league.streak)
  };
}

export function leagueReward(won: boolean, streak: number): { points: number; streak: number } {
  if (!won) return { points: -10, streak: 0 };
  return { points: 25 + Math.min(50, streak * 5), streak: streak + 1 };
}
