import type { StarRating, Theme } from '@walter/shared';

export interface BestTime {
  effectiveMs: number;
  rawMs: number;
  stars: StarRating;
  hintsUsed: number;
  wrongClicks: number;
  theme: Theme;
  at: number;
}

const KEY = 'walter:best-times';
const MAX = 10;

export function loadBestTimes(): BestTime[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BestTime[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordBestTime(entry: BestTime): BestTime[] {
  const list = [...loadBestTimes(), entry]
    .sort((a, b) => a.effectiveMs - b.effectiveMs)
    .slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable (private mode) */
  }
  return list;
}

const NAME_KEY = 'walter:player-name';
export function loadPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
