import { Rng } from './rng.js';
import {
  MAP_DIMENSIONS,
  DIFFICULTY_TUNING,
  DECOY_SCALE_MIN,
  DECOY_SCALE_MAX,
  WALTER_SCALE,
} from './dimensions.js';
import { makeDecoy, WALTER_STRIPE_A, WALTER_STRIPE_B, type NearMissAttr } from './palette.js';
import { backgroundColorAt, contrastRatio } from './background.js';
import { CHAR_HALF_H, distance } from './geometry.js';
import { DEFAULT_TRICKINESS, type MapSettings, type MapSize, type Scene, type SceneCharacter, type WalterInstance } from './types.js';

const MIN_DECOYS = 300;
const MAX_DECOYS = 800;

/** Max fraction of decoys allowed to wear stripes (§3.2). */
export const STRIPE_QUOTA = 0.08;

/** Near-misses cluster within this fraction of the map's shorter side of Walter. */
const NEIGHBORHOOD_FRACTION = 0.2;

/** Min Walter↔background contrast (WCAG ratio) before we nudge him (§2.7). */
export const CONTRAST_THRESHOLD = 2.5;

const NEAR_MISS_ATTRS: NearMissAttr[] = ['beanie', 'glasses', 'shoes'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function trickinessOf(settings: MapSettings): number {
  return clamp(settings.decoyTrickiness ?? DEFAULT_TRICKINESS, 0, 1);
}

/** Resolve the final crowd size for a map. */
export function decoyCount(settings: MapSettings): number {
  const base = MAP_DIMENSIONS[settings.mapSize].decoys;
  const mul = DIFFICULTY_TUNING[settings.difficulty].decoyMul;
  return Math.max(MIN_DECOYS, Math.min(MAX_DECOYS, Math.round(base * mul)));
}

// ---------------------------------------------------------------------------
// Contrast (§2.7): keep Walter on a spot where his yellow/blue stripes pop.
// ---------------------------------------------------------------------------

/** Best contrast of Walter's two stripe colors against the background under (x,y). */
export function walterContrastAt(settings: MapSettings, x: number, y: number): number {
  const bg = backgroundColorAt(settings, x, y);
  return Math.max(contrastRatio(bg, WALTER_STRIPE_A), contrastRatio(bg, WALTER_STRIPE_B));
}

export function isLowContrastForWalter(settings: MapSettings, x: number, y: number): boolean {
  return walterContrastAt(settings, x, y) < CONTRAST_THRESHOLD;
}

/**
 * If (x,y) is low-contrast, deterministically search a fixed ring pattern for the
 * nearest on-map spot that passes. Purely a function of settings + the input
 * point, so client and server agree.
 */
function nudgeForContrast(settings: MapSettings, x: number, y: number): { x: number; y: number } {
  if (!isLowContrastForWalter(settings, x, y)) return { x, y };
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const margin = 70;
  const radii = [50, 100, 150, 210, 280, 360, 450];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => (d * Math.PI) / 180);
  for (const r of radii) {
    for (const a of angles) {
      const nx = clamp(x + Math.cos(a) * r, margin, width - margin);
      const ny = clamp(y + Math.sin(a) * r, margin + CHAR_HALF_H, height - margin);
      if (!isLowContrastForWalter(settings, nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x, y }; // best effort — give up rather than loop forever
}

// ---------------------------------------------------------------------------
// Scene generation
// ---------------------------------------------------------------------------

/**
 * Generate the full decoy crowd for a scene. Fully determined by
 * (seed, theme, mapSize, difficulty, decoyTrickiness). Every decoy provably
 * satisfies the §3 invariants; trickiness only changes how many one-attribute
 * near-misses cluster around Walter, never the invariants themselves.
 *
 * Walters are placed separately so their coordinates can stay
 * server-authoritative, and are always drawn last (§3.5 occlusion guarantee).
 */
export function generateScene(settings: MapSettings): Scene {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const count = decoyCount(settings);
  const trickiness = trickinessOf(settings);

  const rng = new Rng(
    `${settings.seed}|${settings.theme}|${settings.mapSize}|${settings.difficulty}|t${trickiness}|crowd`
  );

  // Near-misses cluster around the seed-derived Walter anchor. (For custom
  // challenge placements the crowd stays seed-deterministic by design — see README.)
  const anchor = deriveWalterPosition(settings);
  const neighborhood = Math.min(width, height) * NEIGHBORHOOD_FRACTION;

  const stripeBudget = Math.floor(count * STRIPE_QUOTA);
  let stripedUsed = 0;

  // Jittered grid layout.
  const aspect = width / height;
  const rows = Math.ceil(Math.sqrt(count / aspect));
  const cols = Math.ceil(count / rows);
  const cellW = width / cols;
  const cellH = height / rows;
  const margin = 40;

  const characters: SceneCharacter[] = [];
  let id = 0;

  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (id >= count) break outer;
      const baseX = c * cellW + cellW / 2;
      const baseY = r * cellH + cellH / 2;
      const x = clamp(baseX + rng.float(-cellW * 0.42, cellW * 0.42), margin, width - margin);
      const y = clamp(baseY + rng.float(-cellH * 0.42, cellH * 0.42), margin + CHAR_HALF_H, height - margin);

      // Decoy scale is bounded to 0.9–1.05 (§3.4); a little depth for perspective.
      const depth = y / height;
      const scale = clamp(DECOY_SCALE_MIN + depth * 0.12 + rng.float(0, 0.05), DECOY_SCALE_MIN, DECOY_SCALE_MAX);

      // Stripe quota: at most STRIPE_QUOTA of decoys are striped.
      const striped = stripedUsed < stripeBudget && rng.chance(0.1);
      if (striped) stripedUsed++;

      // Near-miss density scales with trickiness, denser near Walter.
      const near = distance(x, y, anchor.x, anchor.y) <= neighborhood;
      const pNearMiss = near ? 0.25 + 0.6 * trickiness : 0.12 + 0.08 * trickiness;
      const matchAttr: NearMissAttr = rng.chance(pNearMiss) ? rng.pick(NEAR_MISS_ATTRS) : 'none';

      characters.push({
        id: id++,
        x,
        y,
        scale: Math.round(scale * 1000) / 1000,
        parts: makeDecoy(rng, settings.theme, { matchAttr, striped }),
      });
    }
  }

  // Painter's algorithm: draw back-to-front so closer characters overlap.
  characters.sort((a, b) => a.y - b.y);

  return { settings, width, height, characters };
}

/**
 * Walter's render scale. Constant (1.15× the average decoy) so his silhouette
 * is distinctly larger than any decoy and client rendering / server hit
 * detection always agree. Parameters are kept for call-site compatibility.
 */
export function walterScale(_y: number, _mapSize: MapSize): number {
  return WALTER_SCALE;
}

/**
 * Deterministic single-Walter position (solo mode). Lives in its own RNG stream
 * so it is independent of the crowd layout, and is nudged off any low-contrast
 * spot (§2.7).
 */
export function deriveWalterPosition(settings: MapSettings): WalterInstance {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const rng = new Rng(`${settings.seed}|walter`);
  const margin = 70;
  const x = rng.float(margin, width - margin);
  const y = rng.float(margin + CHAR_HALF_H, height - margin);
  const placed = nudgeForContrast(settings, x, y);
  return { id: 0, x: placed.x, y: placed.y, scale: WALTER_SCALE };
}

/**
 * Deterministic multi-Walter placement (multiplayer). Enforces a minimum
 * spacing so two Walters never overlap, and nudges each off low-contrast spots.
 */
export function deriveWalterPositions(settings: MapSettings, n: number): WalterInstance[] {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const rng = new Rng(`${settings.seed}|walters|${n}`);
  const margin = 80;

  const idealSpacing = (Math.min(width, height) / Math.sqrt(n)) * 0.6;
  const walters: WalterInstance[] = [];
  let minSpacing = idealSpacing;
  let guard = 0;

  while (walters.length < n) {
    const rx = rng.float(margin, width - margin);
    const ry = rng.float(margin + CHAR_HALF_H, height - margin);
    const placed = nudgeForContrast(settings, rx, ry);
    const ok = walters.every((w) => distance(w.x, w.y, placed.x, placed.y) >= minSpacing);
    guard++;
    if (ok) {
      walters.push({ id: walters.length, x: placed.x, y: placed.y, scale: WALTER_SCALE });
      guard = 0;
    } else if (guard > 200) {
      minSpacing *= 0.85;
      guard = 0;
    }
  }
  return walters;
}
