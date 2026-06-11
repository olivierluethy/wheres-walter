import { Rng } from './rng.js';
import { DIFFICULTY_TUNING, MAP_DIMENSIONS, makeDecoy } from './palette.js';
import { CHAR_HALF_H, distance } from './geometry.js';
import type { MapSettings, Scene, SceneCharacter, WalterInstance } from './types.js';

const MIN_DECOYS = 300;
const MAX_DECOYS = 800;

/** Resolve the final crowd size for a map. */
export function decoyCount(settings: MapSettings): number {
  const base = MAP_DIMENSIONS[settings.mapSize].decoys;
  const mul = DIFFICULTY_TUNING[settings.difficulty].decoyMul;
  return Math.max(MIN_DECOYS, Math.min(MAX_DECOYS, Math.round(base * mul)));
}

/**
 * Generate the full decoy crowd for a scene. Fully determined by
 * (seed, theme, mapSize, difficulty). Walters are placed separately so their
 * coordinates can stay server-authoritative.
 */
export function generateScene(settings: MapSettings): Scene {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const count = decoyCount(settings);
  const tuning = DIFFICULTY_TUNING[settings.difficulty];

  const rng = new Rng(`${settings.seed}|${settings.theme}|${settings.mapSize}|${settings.difficulty}|crowd`);

  // Jittered grid layout: pick a grid whose cell count covers the crowd.
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
      const jx = rng.float(-cellW * 0.42, cellW * 0.42);
      const jy = rng.float(-cellH * 0.42, cellH * 0.42);
      const x = Math.max(margin, Math.min(width - margin, baseX + jx));
      const y = Math.max(margin + CHAR_HALF_H, Math.min(height - margin, baseY + jy));

      // Depth scaling: characters lower in the scene render slightly larger.
      const depth = y / height; // 0 (top) .. 1 (bottom)
      const scale = 0.62 + depth * 0.42 + rng.float(-0.05, 0.05);

      characters.push({
        id: id++,
        x,
        y,
        scale: Math.round(scale * 1000) / 1000,
        parts: makeDecoy(rng, settings.theme, tuning.nearMiss),
      });
    }
  }

  // Painter's algorithm: draw back-to-front so closer characters overlap.
  characters.sort((a, b) => a.y - b.y);

  return { settings, width, height, characters };
}

/**
 * Walter's render scale for a given y, so client placement and server hit
 * detection always agree. Lower in the scene → slightly larger.
 */
export function walterScale(y: number, mapSize: MapSettings['mapSize']): number {
  const { height } = MAP_DIMENSIONS[mapSize];
  const depth = Math.max(0, Math.min(1, y / height));
  return Math.round((0.7 + depth * 0.4) * 1000) / 1000;
}

/**
 * Deterministic single-Walter position (solo mode). Lives in its own RNG
 * stream so it is independent of the crowd layout.
 */
export function deriveWalterPosition(settings: MapSettings): WalterInstance {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const rng = new Rng(`${settings.seed}|walter`);
  const margin = 70;
  const x = rng.float(margin, width - margin);
  const y = rng.float(margin + CHAR_HALF_H, height - margin);
  return { id: 0, x, y, scale: walterScale(y, settings.mapSize) };
}

/**
 * Deterministic multi-Walter placement (multiplayer). Enforces a minimum
 * spacing so two Walters never overlap. Falls back to relaxed spacing if the
 * map is too crowded to satisfy the ideal distance.
 */
export function deriveWalterPositions(settings: MapSettings, n: number): WalterInstance[] {
  const { width, height } = MAP_DIMENSIONS[settings.mapSize];
  const rng = new Rng(`${settings.seed}|walters|${n}`);
  const margin = 80;

  const idealSpacing = Math.min(width, height) / Math.sqrt(n) * 0.6;
  const walters: WalterInstance[] = [];
  let minSpacing = idealSpacing;
  let guard = 0;

  while (walters.length < n) {
    const x = rng.float(margin, width - margin);
    const y = rng.float(margin + CHAR_HALF_H, height - margin);
    const ok = walters.every((w) => distance(w.x, w.y, x, y) >= minSpacing);
    guard++;
    if (ok) {
      walters.push({ id: walters.length, x, y, scale: walterScale(y, settings.mapSize) });
      guard = 0;
    } else if (guard > 200) {
      // Relax spacing to guarantee termination on dense maps.
      minSpacing *= 0.85;
      guard = 0;
    }
  }
  return walters;
}
