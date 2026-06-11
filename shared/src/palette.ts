import type { CharacterParts, HatType, TopStyle, Theme } from './types.js';
import { Rng } from './rng.js';

// ---------------------------------------------------------------------------
// Walter — the ORIGINAL character (redesigned for findability).
//
//   • Sweater: bold horizontal stripes, yellow (#FACC15) + royal blue (#2563EB)
//   • Hat:     green (#16A34A) beanie with a white pompom
//   • Glasses: round, brown (#78350F) frames
//   • Trousers: dark charcoal (#1F2937)   • Shoes: white sneakers
//   • Pose:    one arm raised, waving — the ONLY waving character in the scene
//
// Deliberately NOT the trademarked "Waldo/Wally" look (no red/white shirt, no
// red bobble hat, no black round glasses, no jeans/boots/cane/satchel).
// ---------------------------------------------------------------------------

export const WALTER_STRIPE_A = '#facc15'; // yellow-400
export const WALTER_STRIPE_B = '#2563eb'; // blue-600
export const WALTER_BEANIE = '#16a34a'; // green-600
export const WALTER_GLASSES = '#78350f'; // brown
export const WALTER_SHOES = '#ffffff';
export const WALTER_PANTS = '#1f2937'; // charcoal

export const WALTER_PARTS: Readonly<CharacterParts> = Object.freeze({
  skin: '#e8b98c',
  hair: '#3b2a1a',
  pants: WALTER_PANTS,
  shoes: WALTER_SHOES,
  top: { striped: true, colorA: WALTER_STRIPE_A, colorB: WALTER_STRIPE_B },
  hat: 'beanie',
  hatColor: WALTER_BEANIE,
  hatPom: true,
  glasses: true,
  glassesColor: WALTER_GLASSES,
  pose: 'waving',
});

// ---------------------------------------------------------------------------
// Signature-attribute matchers. Walter has FOUR signature attributes; a decoy
// may share AT MOST ONE of them (§3.3), and may NEVER wear the yellow+blue
// stripe combination (§3.2). These are the single source of truth used by both
// the generator (to construct legal decoys) and the tests (to verify them).
// ---------------------------------------------------------------------------

function eqColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** The yellow+blue striped sweater (either stripe order). */
export function matchesSweater(p: CharacterParts): boolean {
  if (!p.top.striped) return false;
  const a = p.top.colorA.toLowerCase();
  const b = p.top.colorB.toLowerCase();
  return (a === WALTER_STRIPE_A && b === WALTER_STRIPE_B) || (a === WALTER_STRIPE_B && b === WALTER_STRIPE_A);
}

/** Green pompom beanie (needs all three: beanie + green + pompom). */
export function matchesBeanie(p: CharacterParts): boolean {
  return p.hat === 'beanie' && eqColor(p.hatColor, WALTER_BEANIE) && p.hatPom;
}

/** Brown round glasses. */
export function matchesGlasses(p: CharacterParts): boolean {
  return p.glasses && eqColor(p.glassesColor, WALTER_GLASSES);
}

/** White sneakers. */
export function matchesShoes(p: CharacterParts): boolean {
  return eqColor(p.shoes, WALTER_SHOES);
}

/** How many of Walter's four signature attributes a character shares. */
export function sharedAttributeCount(p: CharacterParts): number {
  return (
    (matchesSweater(p) ? 1 : 0) +
    (matchesBeanie(p) ? 1 : 0) +
    (matchesGlasses(p) ? 1 : 0) +
    (matchesShoes(p) ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Decoy palettes (deliberately exclude Walter's signature values)
// ---------------------------------------------------------------------------

export const SKIN_TONES = ['#f3d2b3', '#f1c9a5', '#e8b98c', '#d9a066', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#1b1b1b', '#3b2a1a', '#6b4423', '#a9743b', '#c9a227', '#d9d9d9', '#7a1f1f'];
export const PANTS_COLORS = ['#1e293b', '#334155', '#1e3a5f', '#3f3f46', '#4b5563', '#5b3a29', '#0f766e'];

/** Solid sweater colors by theme. A single yellow or blue here is fine — only
 *  the yellow+blue *stripe* combination is reserved for Walter. */
const TOP_SOLID_BY_THEME: Record<Theme, string[]> = {
  beach: ['#06b6d4', '#0ea5e9', '#f472b6', '#34d399', '#fb7185', '#a855f7', '#fbbf24', '#ef4444'],
  city: ['#475569', '#64748b', '#0ea5e9', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#e2e8f0'],
  winter: ['#1d4ed8', '#b91c1c', '#0f766e', '#7c3aed', '#0ea5e9', '#be123c', '#15803d', '#9333ea'],
};

/** Allowed decoy stripe pairs — never yellow+blue (§3.2). */
const DECOY_STRIPE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#dc2626', '#f8fafc'], // red / white
  ['#16a34a', '#f8fafc'], // green / white
  ['#111827', '#f8fafc'], // black / white
  ['#7c3aed', '#f8fafc'], // purple / white
  ['#0891b2', '#f8fafc'], // teal / white
  ['#b91c1c', '#fde68a'], // maroon / cream
];

const HAT_TYPES_BY_THEME: Record<Theme, HatType[]> = {
  beach: ['none', 'none', 'sunhat', 'cap', 'beanie'],
  city: ['none', 'cap', 'beanie', 'tophat', 'none'],
  winter: ['beanie', 'beanie', 'cap', 'none', 'tophat'],
};

/** Hat colors for decoys — green is excluded so no decoy gets a green beanie
 *  unless we deliberately grant the (single) beanie near-miss attribute. */
const HAT_COLORS_NONGREEN = ['#dc2626', '#2563eb', '#7c3aed', '#0891b2', '#ca8a04', '#475569', '#db2777', '#0f172a'];

/** Glasses frame colors for decoys — excludes Walter's brown. */
const GLASSES_NONBROWN = ['#1f2937', '#334155', '#0f172a', '#52525b'];

/** Shoe colors for decoys — excludes white. */
const SHOE_NONWHITE = ['#1f2937', '#0f172a', '#7c2d12', '#334155', '#b91c1c', '#1e3a5f'];

const DECOY_POSES = ['standing', 'walking', 'sitting', 'crouching'] as const;
const DECOY_POSE_WEIGHTS = [4, 3, 1.6, 1.6];

// ---------------------------------------------------------------------------
// Decoy factory
// ---------------------------------------------------------------------------

/** Which single signature attribute (if any) a decoy is allowed to share. */
export type NearMissAttr = 'none' | 'beanie' | 'glasses' | 'shoes';

export interface DecoyOptions {
  /** The single signature attribute this decoy shares (a near-miss), or none. */
  matchAttr: NearMissAttr;
  /** Whether this decoy wears stripes (in a non-Walter pair). */
  striped: boolean;
}

/**
 * Build a decoy that provably satisfies every §3 invariant:
 *   • never waving, • never yellow+blue stripes, • shares ≤1 signature attribute.
 * The single shared attribute (if any) is granted explicitly; every other
 * signature-bearing field is forced to a non-matching value.
 */
export function makeDecoy(rng: Rng, theme: Theme, opts: DecoyOptions): CharacterParts {
  const pose = rng.weighted(DECOY_POSES, DECOY_POSE_WEIGHTS);

  // Top: striped (non-Walter pair) or solid.
  let top: TopStyle;
  if (opts.striped) {
    const pair = rng.pick(DECOY_STRIPE_PAIRS);
    top = { striped: true, colorA: pair[0], colorB: pair[1] };
  } else {
    const c = rng.pick(TOP_SOLID_BY_THEME[theme]);
    top = { striped: false, colorA: c, colorB: c };
  }

  // Baseline signature-bearing fields, all forced NON-matching.
  let hat = rng.pick(HAT_TYPES_BY_THEME[theme]);
  let hatColor = hat === 'none' ? '#000000' : rng.pick(HAT_COLORS_NONGREEN);
  let hatPom = hat === 'beanie' && rng.chance(0.4);
  let glasses = rng.chance(0.4);
  let glassesColor = rng.pick(GLASSES_NONBROWN);
  let shoes = rng.pick(SHOE_NONWHITE);

  // Grant exactly the chosen single near-miss attribute.
  switch (opts.matchAttr) {
    case 'beanie':
      hat = 'beanie';
      hatColor = WALTER_BEANIE;
      hatPom = true;
      break;
    case 'glasses':
      glasses = true;
      glassesColor = WALTER_GLASSES;
      break;
    case 'shoes':
      shoes = WALTER_SHOES;
      break;
    case 'none':
      break;
  }

  return {
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(HAIR_COLORS),
    pants: rng.pick(PANTS_COLORS),
    shoes,
    top,
    hat,
    hatColor,
    hatPom,
    glasses,
    glassesColor,
    pose,
  };
}
