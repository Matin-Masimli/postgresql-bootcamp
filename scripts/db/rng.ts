// Deterministic PRNG utilities. Never use Math.random() or wall-clock time in the generator.

/** xmur3 string hash → 32-bit seed stream. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** sfc32: small, fast, well-distributed 32-bit generator. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(seed: string) {
    const s = xmur3(seed);
    this.next = sfc32(s(), s(), s(), s());
    for (let i = 0; i < 16; i++) this.next(); // warm up
  }

  /** Independent child stream, so adding draws in one table never shifts another table's data. */
  fork(label: string): Rng {
    return new Rng(`${Math.floor(this.next() * 2 ** 32)}:${label}`);
  }

  float(): number {
    return this.next();
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of entries) {
      if ((r -= w) < 0) return v;
    }
    return entries[entries.length - 1][0];
  }

  /** Standard normal via Box–Muller. */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Geometric-ish count ≥ min with the given mean. */
  geometric(mean: number, min = 0): number {
    const p = 1 / (mean - min + 1);
    let n = min;
    while (!this.chance(p)) n++;
    return n;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.min(n, items.length));
  }
}

/** Precomputed cumulative weights for fast repeated weighted picks (e.g. product popularity). */
export class WeightedIndex<T> {
  private cum: number[] = [];
  private total = 0;

  constructor(private readonly items: readonly T[], weights: readonly number[]) {
    for (const w of weights) this.cum.push((this.total += w));
  }

  pick(rng: Rng): T {
    const r = rng.float() * this.total;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return this.items[lo];
  }
}
