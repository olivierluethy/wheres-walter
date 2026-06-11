import { describe, it, expect } from 'vitest';
// Import the built output so tests exercise exactly what consumers import.
import {
  generateScene,
  decoyCount,
  deriveWalterPosition,
  deriveWalterPositions,
  generateHint,
  hintIsValid,
  hitBoxFor,
  isHit,
  starsFor,
  effectiveTimeMs,
  sharedAttributeCount,
  matchesSweater,
  isLowContrastForWalter,
  walterContrastAt,
  CONTRAST_THRESHOLD,
  STRIPE_QUOTA,
  WALTER_PARTS,
  WALTER_SCALE,
  DECOY_SCALE_MIN,
  DECOY_SCALE_MAX,
  Rng,
  distance,
  THEMES,
  MAP_SIZES,
  type Difficulty,
  type MapSettings,
} from '../dist/index.js';

const base: MapSettings = { seed: 'test-seed-123', theme: 'winter', mapSize: 'medium', difficulty: 'normal', decoyTrickiness: 0.5 };

describe('seed determinism', () => {
  it('same settings → byte-identical character list', () => {
    const a = generateScene(base);
    const b = generateScene({ ...base });
    expect(a.characters.length).toBe(b.characters.length);
    expect(JSON.stringify(a.characters)).toBe(JSON.stringify(b.characters));
  });

  it('different seed → different layout', () => {
    const a = generateScene(base);
    const b = generateScene({ ...base, seed: 'other-seed' });
    expect(JSON.stringify(a.characters)).not.toBe(JSON.stringify(b.characters));
  });

  it('trickiness is part of the deterministic input', () => {
    const a = generateScene({ ...base, decoyTrickiness: 0.25 });
    const b = generateScene({ ...base, decoyTrickiness: 0.8 });
    expect(JSON.stringify(a.characters)).not.toBe(JSON.stringify(b.characters));
    // ...but each is itself reproducible.
    expect(JSON.stringify(a.characters)).toBe(JSON.stringify(generateScene({ ...base, decoyTrickiness: 0.25 }).characters));
  });

  it('crowd size stays within the 300–800 spec range', () => {
    for (const mapSize of MAP_SIZES) {
      for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
        const scene = generateScene({ ...base, mapSize, difficulty });
        expect(scene.characters.length).toBeGreaterThanOrEqual(300);
        expect(scene.characters.length).toBeLessThanOrEqual(800);
      }
    }
  });

  it('walter position is deterministic for a seed', () => {
    expect(deriveWalterPosition(base)).toEqual(deriveWalterPosition({ ...base }));
  });
});

describe('Walter design', () => {
  it('has all four signature attributes, waves, and is larger than any decoy', () => {
    expect(sharedAttributeCount(WALTER_PARTS)).toBe(4);
    expect(matchesSweater(WALTER_PARTS)).toBe(true);
    expect(WALTER_PARTS.pose).toBe('waving');
    expect(WALTER_SCALE).toBeGreaterThan(DECOY_SCALE_MAX);
  });
});

describe('decoy invariants (§3) — 50 scenes across all themes & sizes', () => {
  // Build 50 randomized scenes spanning every theme, size and a range of trickiness.
  const scenes = Array.from({ length: 50 }, (_, i) =>
    generateScene({
      seed: `invariant-${i}-${(i * 7919) % 100}`,
      theme: THEMES[i % THEMES.length],
      mapSize: MAP_SIZES[i % MAP_SIZES.length],
      difficulty: (['easy', 'normal', 'hard'] as Difficulty[])[i % 3],
      decoyTrickiness: (i % 5) / 4, // 0, 0.25, 0.5, 0.75, 1
    })
  );

  it('no decoy ever has a raised/waving arm (§3.1)', () => {
    for (const s of scenes) {
      expect(s.characters.every((c) => c.parts.pose !== 'waving')).toBe(true);
    }
  });

  it('no decoy wears the yellow+blue stripe combo, and ≤8% wear stripes at all (§3.2)', () => {
    for (const s of scenes) {
      expect(s.characters.some((c) => matchesSweater(c.parts))).toBe(false);
      const striped = s.characters.filter((c) => c.parts.top.striped).length;
      expect(striped).toBeLessThanOrEqual(Math.floor(s.characters.length * STRIPE_QUOTA));
    }
  });

  it('no decoy shares more than ONE signature attribute (§3.3)', () => {
    for (const s of scenes) {
      for (const c of s.characters) {
        expect(sharedAttributeCount(c.parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('decoy scale stays within 0.9×–1.05×, and never equals Walter (§3.4)', () => {
    for (const s of scenes) {
      for (const c of s.characters) {
        expect(c.scale).toBeGreaterThanOrEqual(DECOY_SCALE_MIN);
        expect(c.scale).toBeLessThanOrEqual(DECOY_SCALE_MAX);
        expect(c.scale).not.toBe(WALTER_SCALE);
      }
    }
  });
});

describe('trickiness tuning (does not loosen invariants)', () => {
  it('higher trickiness places more near-misses near Walter but never breaks §3', () => {
    const settings = { ...base, mapSize: 'large' as const, seed: 'trick-1' };
    const anchor = deriveWalterPosition(settings);
    const near = (scene: ReturnType<typeof generateScene>) =>
      scene.characters.filter(
        (c) => distance(c.x, c.y, anchor.x, anchor.y) <= 0.2 * 1900 && sharedAttributeCount(c.parts) === 1
      ).length;

    const easy = generateScene({ ...settings, decoyTrickiness: 0.25 });
    const tricky = generateScene({ ...settings, decoyTrickiness: 0.8 });
    expect(near(tricky)).toBeGreaterThan(near(easy));
    // invariants still hold at max trickiness
    for (const c of tricky.characters) expect(sharedAttributeCount(c.parts)).toBeLessThanOrEqual(1);
  });
});

describe('Walter contrast placement (§2.7)', () => {
  it('derived Walter positions are never left on a low-contrast spot', () => {
    for (const theme of THEMES) {
      for (let i = 0; i < 20; i++) {
        const s = { ...base, theme, seed: `contrast-${theme}-${i}` };
        const w = deriveWalterPosition(s);
        expect(isLowContrastForWalter(s, w.x, w.y)).toBe(false);
        expect(walterContrastAt(s, w.x, w.y)).toBeGreaterThanOrEqual(CONTRAST_THRESHOLD);
      }
    }
  });
});

describe('hit detection', () => {
  it('counts a click on Walter as a hit and a far click as a miss', () => {
    const w = deriveWalterPosition(base);
    const box = hitBoxFor(w.x, w.y, w.scale);
    expect(isHit(w.x, w.y, box)).toBe(true);
    expect(isHit(w.x + box.radius - 1, w.y, box)).toBe(true);
    expect(isHit(w.x + box.radius + 50, w.y, box)).toBe(false);
  });
});

describe('multi-walter placement', () => {
  it('respects minimum spacing, count, and uses Walter scale', () => {
    const walters = deriveWalterPositions({ ...base, mapSize: 'large' }, 12);
    expect(walters.length).toBe(12);
    expect(walters.every((w) => w.scale === WALTER_SCALE)).toBe(true);
    for (let i = 0; i < walters.length; i++) {
      for (let j = i + 1; j < walters.length; j++) {
        expect(distance(walters[i].x, walters[i].y, walters[j].x, walters[j].y)).toBeGreaterThan(20);
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(deriveWalterPositions(base, 8))).toBe(JSON.stringify(deriveWalterPositions({ ...base }, 8)));
  });
});

describe('hint circle', () => {
  it('always contains Walter but never centers him, at every level', () => {
    for (let trial = 0; trial < 200; trial++) {
      const settings: MapSettings = { ...base, seed: `hint-${trial}` };
      const w = deriveWalterPosition(settings);
      const rng = new Rng(`hint-rng-${trial}`);
      for (const level of [1, 2, 3]) {
        const circle = generateHint(w, settings.mapSize, level, rng);
        expect(hintIsValid(circle, w)).toBe(true);
        const d = distance(circle.cx, circle.cy, w.x, w.y);
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThanOrEqual(circle.radius);
      }
    }
  });

  it('shrinks with each level', () => {
    const w = deriveWalterPosition(base);
    const rng = new Rng('shrink');
    const r1 = generateHint(w, base.mapSize, 1, rng).radius;
    const r2 = generateHint(w, base.mapSize, 2, rng).radius;
    const r3 = generateHint(w, base.mapSize, 3, rng).radius;
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
  });
});

describe('star scoring', () => {
  it('uses effective time thresholds', () => {
    expect(starsFor(30_000, 0, 0)).toBe(3);
    expect(starsFor(44_999, 0, 0)).toBe(3);
    expect(starsFor(45_000, 0, 0)).toBe(2);
    expect(starsFor(119_999, 0, 0)).toBe(2);
    expect(starsFor(120_000, 0, 0)).toBe(1);
  });

  it('penalties push the rating down', () => {
    expect(effectiveTimeMs(30_000, 4, 3)).toBe(95_000);
    expect(starsFor(30_000, 4, 3)).toBe(2);
  });

  it('decoyCount is stable', () => {
    expect(decoyCount(base)).toBe(decoyCount({ ...base }));
  });
});
