import { shuffle } from './random';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function makeDeck(decks = 1): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < decks; deck++) {
    for (const suit of SUITS) {
      for (let rank = 1 as Rank; rank <= 13; rank = (rank + 1) as Rank) {
        cards.push({ id: `${deck}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  return cards;
}

export function shuffleDeck(cards: Card[]): Card[] {
  return shuffle(cards);
}

export function rankLabel(rank: Rank): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦';
}

export function blackjackValue(rank: Rank): number {
  if (rank === 1) return 11;
  if (rank > 10) return 10;
  return rank;
}

export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += blackjackValue(card.rank);
    if (card.rank === 1) aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
    soft = aces > 0;
  }
  return { total, soft: soft && total <= 21 };
}
