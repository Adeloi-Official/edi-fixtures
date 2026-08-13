/**
 * Deterministic random number generation.
 *
 * Every document in this library is generated from a seed, never from
 * `Math.random()` or the system clock. The same seed must produce the exact
 * same byte string today, next year, and on every CI runner in between —
 * that's the entire point of a fixtures library. See docs/design.md.
 */

export type RngFn = () => number;

/**
 * Mulberry32 — a small, fast, well-distributed 32-bit PRNG. Not
 * cryptographically secure, and doesn't need to be: we want reproducible
 * test data, not unpredictability.
 */
export function mulberry32(seed: number): RngFn {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Random {
  private readonly next: RngFn;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  /** Picks one element at random from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Random.pick() called with an empty array");
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  /** True with the given probability (default: a coin flip). */
  bool(probability = 0.5): boolean {
    return this.float() < probability;
  }

  /** A string of `length` random decimal digits, zero-padding included. */
  digits(length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) out += this.int(0, 9).toString();
    return out;
  }

  /**
   * A "crooked" number in [min, max] — the opposite of the round quantities
   * (100, 10.00) that spec examples use. Real purchase orders are for 37
   * cases, not 100.
   */
  crooked(min: number, max: number, decimals = 0): number {
    const raw = this.float() * (max - min) + min;
    const factor = 10 ** decimals;
    return Math.round(raw * factor) / factor;
  }

  /** A deterministic Fisher-Yates shuffle — a fresh, reordered array, original left untouched. */
  shuffled<T>(items: readonly T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
    }
    return arr;
  }
}
