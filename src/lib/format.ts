export function idn(n: number, digits = 0): string {
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const v = abs;
  if (v >= 1_000_000) {
    const d = v >= 10_000_000 ? 0 : 1;
    return sign + idn(v / 1_000_000, d) + " jt";
  }
  if (v >= 1_000) {
    const d = v >= 10_000 ? 0 : 1;
    return sign + idn(v / 1_000, d) + " rb";
  }
  return sign + idn(v, v < 10 && v % 1 !== 0 ? 1 : 0);
}

export function rho(n: number): string {
  const sign = n < 0 ? "−" : "";
  return sign + Math.abs(n).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function pearson(pairs: { x: number; y: number }[]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const p of pairs) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const p of pairs) {
    const a = p.x - mx;
    const b = p.y - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Ordinary least squares: y = a + b x. */
export function ols(pairs: { x: number; y: number }[]): { a: number; b: number } | null {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of pairs) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  return { a, b };
}
