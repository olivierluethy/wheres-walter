import { describe, it, expect } from 'vitest';
// Import the built output so tests exercise exactly what consumers import.
import {
  generateScene,
  deriveWalterPosition,
  deriveWalterPositions,
  generateHint,
  hintIsValid,
  hitBoxFor,
  isHit,
  starsFor,
  effectiveTimeMs,
  isFullWalter,
  Rng,
  distance,
  type MapSettings,
} from '../dist/index.js';

const base: MapSettings = { seed: 'test-seed-123', theme: 'winter', mapSize: 'medium', difficulty: 'normal' };

describe('seed determinism', () => {
  it('same seed → identical character list', () => {
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

  it('crowd size is within the 300–800 spec range', () => {
    for (const mapSize of ['small', 'medium', 'large', 'xl'] as const) {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        const scene = generateScene({ ...base, mapSize, difficulty });
        expect(scene.characters.length).toBeGreaterThanOrEqual(300);
        expect(scene.characters.length).toBeLessThanOrEqual(800);
      }
    }
  });

  it('no decoy is ever a full Walter', () => {
    const scene = generateScene({ ...base, difficulty: 'hard' });
    expect(scene.characters.some((c) => isFullWalter(c.parts))).toBe(false);
  });

  it('walter position is deterministic for a seed', () => {
    expect(deriveWalterPosition(base)).toEqual(deriveWalterPosition({ ...base }));
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

  it('padding makes the box at least 8px forgiving', () => {
    const box = hitBoxFor(100, 100, 1);
    expect(box.radius).toBeGreaterThanOrEqual(8);
  });
});

describe('multi-walter placement', () => {
  it('respects minimum spacing and produces the requested count', () => {
    const walters = deriveWalterPositions({ ...base, mapSize: 'large' }, 12);
    expect(walters.length).toBe(12);
    for (let i = 0; i < walters.length; i++) {
      for (let j = i + 1; j < walters.length; j++) {
        expect(distance(walters[i].x, walters[i].y, walters[j].x, walters[j].y)).toBeGreaterThan(20);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = deriveWalterPositions(base, 8);
    const b = deriveWalterPositions({ ...base }, 8);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
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
        expect(d).toBeGreaterThan(0); // never exactly centered
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
    // 30s raw is 3 stars, but 3 hints (+45s) and 4 wrong clicks (+20s) = 95s → 2 stars.
    expect(effectiveTimeMs(30_000, 4, 3)).toBe(95_000);
    expect(starsFor(30_000, 4, 3)).toBe(2);
  });
});
