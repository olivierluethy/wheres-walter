import { Rng } from './rng.js';
import { distance } from './geometry.js';
import type { HintCircle, MapSize, WalterInstance } from './types.js';
import { MAP_DIMENSIONS } from './palette.js';

/** Hint radius as a fraction of the map's shorter dimension, by level. */
export const HINT_RADIUS_FRACTION: Record<number, number> = {
  1: 0.35,
  2: 0.22,
  3: 0.12,
};

export const HINT_DURATION_MS = 6000;
export const HINT_TIME_PENALTY_MS = 15_000;

/**
 * Build a hint circle that is guaranteed to contain Walter but never has him at
 * its center. The center is pushed off Walter by a random distance between 30%
 * and 65% of the radius, then clamped to stay on the map.
 */
export function generateHint(
  walter: WalterInstance,
  mapSize: MapSize,
  level: number,
  rng: Rng
): HintCircle {
  const { width, height } = MAP_DIMENSIONS[mapSize];
  const shorter = Math.min(width, height);
  const fraction = HINT_RADIUS_FRACTION[level] ?? HINT_RADIUS_FRACTION[3];
  const radius = shorter * fraction;

  // Offset the circle's center off Walter so he is never at the center. We aim
  // the offset roughly toward the map interior (plus angular jitter) so the
  // center stays on-screen without a clamp that could collapse the offset back
  // onto Walter. The result keeps Walter strictly inside but off-center.
  const towardCenter = Math.atan2(height / 2 - walter.y, width / 2 - walter.x);
  const angle = towardCenter + rng.float(-1.0, 1.0); // ±~57° of jitter
  const offset = rng.float(0.35, 0.6) * radius;

  let cx = walter.x + Math.cos(angle) * offset;
  let cy = walter.y + Math.sin(angle) * offset;

  // Gentle clamp only to avoid drifting off the map. Because the offset points
  // inward, this rarely fires and never pulls the center back onto Walter.
  cx = Math.max(radius * 0.1, Math.min(width - radius * 0.1, cx));
  cy = Math.max(radius * 0.1, Math.min(height - radius * 0.1, cy));

  return { cx, cy, radius, level };
}

/** Verify the invariants (used in tests): Walter inside, and not centered. */
export function hintIsValid(circle: HintCircle, walter: WalterInstance): boolean {
  const d = distance(circle.cx, circle.cy, walter.x, walter.y);
  const inside = d <= circle.radius;
  const notCentered = d > circle.radius * 0.05;
  return inside && notCentered;
}
