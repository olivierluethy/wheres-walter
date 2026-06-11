import seedrandom from 'seedrandom';

/**
 * Deterministic random-number helper. Every value produced is fully determined
 * by the seed string, so the same seed always yields the same scene on both
 * the client and the server.
 */
export class Rng {
  private readonly fn: seedrandom.PRNG;

  constructor(seed: string) {
    this.fn = seedrandom(seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.fn();
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.fn() * (max - min);
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.fn() < p;
  }

  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted pick. `weights` must align with `items` and sum > 0. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.fn() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/** Generate a fresh random seed string (used for new solo games). */
export function randomSeed(): string {
  // Caller-side only (not deterministic by design).
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}
