/** Geometry and wording for the skill radar on the session report. Pure, so it can be unit tested. */

export interface RadarAxis {
  label: string;
  /** 0–100. */
  value: number;
}

/** A zero still shows as a point just off the centre rather than vanishing into it. */
export const MIN_FRACTION = 0.04;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Point for axis `i` of `n` at `frac` of the radius. Axis 0 points straight up; the rest go clockwise. */
export function radarPoint(i: number, n: number, frac: number, radius: number, cx: number, cy: number): [number, number] {
  const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
  return [cx + Math.cos(a) * radius * frac, cy + Math.sin(a) * radius * frac];
}

/** One point per value, scaled to the radius. */
export function radarPoints(values: number[], radius: number, cx: number, cy: number): [number, number][] {
  return values.map((v, i) => radarPoint(i, values.length, Math.max(MIN_FRACTION, clamp(v) / 100), radius, cx, cy));
}

/** SVG `points` attribute for a polygon through the given points. */
export function toPointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Spread above this many points counts as uneven, and the weakest corner is highlighted. */
export const UNEVEN_SPREAD = 20;

export function balanceLabel(values: number[]): string {
  const spread = Math.max(...values) - Math.min(...values);
  return spread <= UNEVEN_SPREAD ? "even" : spread <= 40 ? "a bit uneven" : "uneven";
}

/** Index of the corner to highlight as the weak spot, or null when the shape is fairly even. */
export function weakestIndex(values: number[]): number | null {
  const min = Math.min(...values);
  if (Math.max(...values) - min <= UNEVEN_SPREAD) return null;
  return values.indexOf(min);
}

/** The one-line takeaway under the chart, as parts so the caller can bold the skill names. */
export function radarInsight(axes: RadarAxis[]): { strongest: string; weakest: string } | { even: number } {
  const values = axes.map((a) => clamp(a.value));
  const weak = weakestIndex(values);
  if (weak === null) return { even: Math.round(values.reduce((s, v) => s + v, 0) / values.length) };
  return { strongest: axes[values.indexOf(Math.max(...values))].label, weakest: axes[weak].label };
}
