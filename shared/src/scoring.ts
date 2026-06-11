import type { StarRating } from './types.js';

export const WRONG_CLICK_PENALTY_MS = 5_000;
export const HINT_PENALTY_MS = 15_000;

export const THREE_STAR_MS = 45_000;
export const TWO_STAR_MS = 120_000;

/** Effective time = raw time + wrong-click penalties + hint penalties. */
export function effectiveTimeMs(rawTimeMs: number, wrongClicks: number, hintsUsed: number): number {
  return rawTimeMs + wrongClicks * WRONG_CLICK_PENALTY_MS + hintsUsed * HINT_PENALTY_MS;
}

/** Star rating from the effective time. A finished game is always ≥ 1 star. */
export function starsFor(rawTimeMs: number, wrongClicks: number, hintsUsed: number): StarRating {
  const eff = effectiveTimeMs(rawTimeMs, wrongClicks, hintsUsed);
  if (eff < THREE_STAR_MS) return 3;
  if (eff < TWO_STAR_MS) return 2;
  return 1;
}
