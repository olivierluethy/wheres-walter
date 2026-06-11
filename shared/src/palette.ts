import type { CharacterParts, Difficulty, HatType, MapSize, Theme } from './types.js';

// ---------------------------------------------------------------------------
// Walter — the ORIGINAL character.
// Green beanie (with pom), orange-and-white striped scarf, yellow jacket,
// brown round glasses. Deliberately NOT the trademarked red/white look.
// ---------------------------------------------------------------------------

export const WALTER_COLORS = {
  beanie: '#16a34a', // green-600
  scarfOrange: '#f97316', // orange-500
  scarfWhite: '#f8fafc', // slate-50
  jacket: '#facc15', // yellow-400
  glasses: '#78350f', // brown (amber-900)
};

export const WALTER_PARTS: Readonly<CharacterParts> = Object.freeze({
  skin: '#e8b98c',
  hair: '#3b2a1a',
  jacket: WALTER_COLORS.jacket,
  pants: '#1e3a5f',
  hat: 'beanie',
  hatColor: WALTER_COLORS.beanie,
  hatPom: true,
  scarf: true,
  scarfStriped: true,
  scarfColor: WALTER_COLORS.scarfOrange,
  scarfColor2: WALTER_COLORS.scarfWhite,
  glasses: true,
  glassesColor: WALTER_COLORS.glasses,
});

/**
 * A decoy is a "full Walter" if it matches every distinguishing attribute.
 * The generator guarantees no decoy is ever a full Walter.
 */
export function isFullWalter(p: CharacterParts): boolean {
  return (
    p.hat === 'beanie' &&
    p.hatColor === WALTER_COLORS.beanie &&
    p.hatPom &&
    p.scarf &&
    p.scarfStriped &&
    p.scarfColor === WALTER_COLORS.scarfOrange &&
    p.jacket === WALTER_COLORS.jacket &&
    p.glasses &&
    p.glassesColor === WALTER_COLORS.glasses
  );
}

// ---------------------------------------------------------------------------
// Decoy palettes
// ---------------------------------------------------------------------------

export const SKIN_TONES = ['#f3d2b3', '#f1c9a5', '#e8b98c', '#d9a066', '#c68642', '#8d5524', '#5c3a21'];

export const HAIR_COLORS = ['#1b1b1b', '#3b2a1a', '#6b4423', '#a9743b', '#c9a227', '#d9d9d9', '#7a1f1f'];

export const PANTS_COLORS = ['#1e293b', '#334155', '#1e3a5f', '#3f3f46', '#4b5563', '#5b3a29', '#0f766e'];

/** Jacket colors per theme. Walter-yellow is deliberately included so the
 *  "yellow jacket but wrong hat/scarf" near-miss exists. */
const JACKET_BY_THEME: Record<Theme, string[]> = {
  beach: ['#06b6d4', '#0ea5e9', '#f472b6', '#34d399', '#fb7185', '#facc15', '#a855f7', '#fbbf24'],
  city: ['#475569', '#64748b', '#0ea5e9', '#ef4444', '#22c55e', '#facc15', '#a855f7', '#f97316'],
  winter: ['#1d4ed8', '#b91c1c', '#0f766e', '#7c3aed', '#facc15', '#0ea5e9', '#be123c', '#15803d'],
};

const HAT_TYPES_BY_THEME: Record<Theme, HatType[]> = {
  beach: ['none', 'none', 'sunhat', 'cap', 'beanie'],
  city: ['none', 'cap', 'beanie', 'tophat', 'none'],
  winter: ['beanie', 'beanie', 'cap', 'none', 'tophat'],
};

const HAT_COLORS = ['#16a34a', '#dc2626', '#2563eb', '#7c3aed', '#0891b2', '#ca8a04', '#475569', '#db2777'];

const SCARF_COLORS = ['#f97316', '#dc2626', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#db2777', '#64748b'];

const GLASSES_COLORS = ['#78350f', '#1f2937', '#334155', '#7c2d12'];

// ---------------------------------------------------------------------------
// Map dimensions & crowd sizing
// ---------------------------------------------------------------------------

export const MAP_DIMENSIONS: Record<MapSize, { width: number; height: number; decoys: number }> = {
  small: { width: 1500, height: 1050, decoys: 320 },
  medium: { width: 2100, height: 1450, decoys: 480 },
  large: { width: 2800, height: 1900, decoys: 640 },
  xl: { width: 3600, height: 2400, decoys: 800 },
};

/** Difficulty tunes crowd density and how often near-miss decoys appear. */
export const DIFFICULTY_TUNING: Record<Difficulty, { decoyMul: number; nearMiss: number }> = {
  easy: { decoyMul: 0.8, nearMiss: 0.1 },
  normal: { decoyMul: 1.0, nearMiss: 0.28 },
  hard: { decoyMul: 1.15, nearMiss: 0.45 },
};

// ---------------------------------------------------------------------------
// Decoy factory
// ---------------------------------------------------------------------------

import { Rng } from './rng.js';

/**
 * Build a random decoy. With probability `nearMissP` the decoy is intentionally
 * Walter-adjacent (shares some, but never all, of Walter's traits). The result
 * is guaranteed to never be a full Walter.
 */
export function makeDecoy(rng: Rng, theme: Theme, nearMissP: number): CharacterParts {
  const nearMiss = rng.chance(nearMissP);

  let parts: CharacterParts;

  if (nearMiss) {
    // Start as a Walter and then break exactly one (or more) distinguishing trait.
    parts = { ...WALTER_PARTS };
    const breakers: Array<() => void> = [
      () => {
        parts.hatColor = rng.pick(HAT_COLORS.filter((c) => c !== WALTER_COLORS.beanie));
      },
      () => {
        parts.hat = rng.pick(['cap', 'none', 'tophat', 'sunhat'] as HatType[]);
      },
      () => {
        parts.scarf = false;
      },
      () => {
        parts.scarfStriped = false;
        parts.scarfColor = rng.pick(SCARF_COLORS);
      },
      () => {
        parts.scarfColor = rng.pick(SCARF_COLORS.filter((c) => c !== WALTER_COLORS.scarfOrange));
      },
      () => {
        parts.jacket = rng.pick(JACKET_BY_THEME[theme].filter((c) => c !== WALTER_COLORS.jacket));
      },
      () => {
        parts.glasses = false;
      },
      () => {
        parts.hatPom = false;
      },
    ];
    // Break 1–3 traits.
    const n = rng.int(1, 3);
    const chosen = new Set<number>();
    while (chosen.size < n) chosen.add(rng.int(0, breakers.length - 1));
    chosen.forEach((i) => breakers[i]());
  } else {
    const hat = rng.pick(HAT_TYPES_BY_THEME[theme]);
    const scarf = rng.chance(theme === 'winter' ? 0.7 : 0.3);
    parts = {
      skin: rng.pick(SKIN_TONES),
      hair: rng.pick(HAIR_COLORS),
      jacket: rng.pick(JACKET_BY_THEME[theme]),
      pants: rng.pick(PANTS_COLORS),
      hat,
      hatColor: hat === 'none' ? '#000000' : rng.pick(HAT_COLORS),
      hatPom: hat === 'beanie' && rng.chance(0.4),
      scarf,
      scarfStriped: scarf && rng.chance(0.4),
      scarfColor: rng.pick(SCARF_COLORS),
      scarfColor2: '#f8fafc',
      glasses: rng.chance(0.35),
      glassesColor: rng.pick(GLASSES_COLORS),
    };
  }

  // Hard guarantee: never emit a full Walter.
  if (isFullWalter(parts)) {
    parts.jacket = rng.pick(JACKET_BY_THEME[theme].filter((c) => c !== WALTER_COLORS.jacket));
  }
  return parts;
}
