import type { Difficulty, MapSize } from './types.js';

// ---------------------------------------------------------------------------
// Pure dimension / scale constants. Kept import-free (types only) so palette,
// background, renderer and the map engine can all share them without cycles.
// ---------------------------------------------------------------------------

export const MAP_DIMENSIONS: Record<MapSize, { width: number; height: number; decoys: number }> = {
  small: { width: 1500, height: 1050, decoys: 320 },
  medium: { width: 2100, height: 1450, decoys: 480 },
  large: { width: 2800, height: 1900, decoys: 640 },
  xl: { width: 3600, height: 2400, decoys: 800 },
};

/** Difficulty tunes crowd density (near-miss frequency is driven by trickiness). */
export const DIFFICULTY_TUNING: Record<Difficulty, { decoyMul: number }> = {
  easy: { decoyMul: 0.8 },
  normal: { decoyMul: 1.0 },
  hard: { decoyMul: 1.15 },
};

// Decoy scale is bounded to 0.9×–1.05× (§3.4). Walter renders at 1.15× the
// average decoy scale, making his silhouette distinctly larger than any decoy.
export const DECOY_SCALE_MIN = 0.9;
export const DECOY_SCALE_MAX = 1.05;
export const AVG_DECOY_SCALE = (DECOY_SCALE_MIN + DECOY_SCALE_MAX) / 2; // 0.975
export const WALTER_SIZE_MULTIPLIER = 1.15;
export const WALTER_SCALE = Math.round(AVG_DECOY_SCALE * WALTER_SIZE_MULTIPLIER * 1000) / 1000; // 1.121
