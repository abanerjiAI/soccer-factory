/** Statistics & uncertainty helpers. Every interval states what it is; nothing is called "significant" without a stated criterion. */
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

/** Two-sided 95% Student-t critical value (standard table values; EXTERNAL FACT). */
export function tCrit95(df: number): number {
  if (df < 1) return NaN;
  if (df <= 30) return T975[df - 1];
  if (df <= 40) return 2.021;
  if (df <= 60) return 2.0;
  if (df <= 120) return 1.98;
  return 1.96;
}

export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export function sd(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

export interface Summary {
  n: number;
  mean: number;
  sd: number;
  lo: number;
  hi: number;
  min: number;
  max: number;
  median: number;
}
/** Mean with 95% t-interval (assumes approximately normal sampling distribution of the mean; ASSUMED). */
export function summarize(a: number[]): Summary {
  const n = a.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, lo: NaN, hi: NaN, min: NaN, max: NaN, median: NaN };
  const m = mean(a), s = sd(a);
  const h = n > 1 ? (tCrit95(n - 1) * s) / Math.sqrt(n) : NaN;
  return { n, mean: m, sd: s, lo: m - h, hi: m + h, min: Math.min(...a), max: Math.max(...a), median: quantile(a, 0.5) };
}

export function quantile(a: number[], q: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface PairedResult extends Summary {
  dz: number;
  fracPositive: number;
  excludesZero: boolean;
}
/** Paired difference a_i - b_i: mean, 95% CI, effect size d_z = mean/sd of differences, fraction of pairs with a>b. */
export function paired(a: number[], b: number[]): PairedResult {
  const d = a.map((v, i) => v - b[i]);
  const s = summarize(d);
  return { ...s, dz: s.sd > 0 ? s.mean / s.sd : s.mean === 0 ? 0 : Infinity, fracPositive: d.filter((x) => x > 0).length / Math.max(1, d.length), excludesZero: s.lo > 0 || s.hi < 0 };
}

/** Welch two-sample difference of means (a - b), approximate 95% CI using t critical value with conservative df. */
export function welch(a: number[], b: number[]) {
  const d = mean(a) - mean(b);
  const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);
  const df = Math.max(1, Math.min(a.length, b.length) - 1);
  const h = tCrit95(df) * se;
  return { diff: d, lo: d - h, hi: d + h, excludesZero: Number.isFinite(h) && (d - h > 0 || d + h < 0) };
}

export function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const r = new Array<number>(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
export const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));

export function histogram(a: number[], bins = 12): { lo: number; hi: number; count: number }[] {
  if (!a.length) return [];
  const mn = Math.min(...a), mx = Math.max(...a);
  const w = (mx - mn) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ lo: mn + i * w, hi: mn + (i + 1) * w, count: 0 }));
  a.forEach((v) => out[Math.min(bins - 1, Math.floor((v - mn) / w))].count++);
  return out;
}
