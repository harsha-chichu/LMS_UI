/**
 * The user's accent colour. It's a single CSS variable (`--brand`) set on
 * <html>; globals.css derives every other accent token from it.
 */

export const DEFAULT_ACCENT = "#ff6a00";

export const ACCENT_PRESETS: { value: string; name: string }[] = [
  { value: DEFAULT_ACCENT, name: "orange" },
  { value: "#fbbf24", name: "amber" },
  { value: "#4ade80", name: "green" },
  { value: "#22d3ee", name: "cyan" },
  { value: "#60a5fa", name: "blue" },
  { value: "#a78bfa", name: "violet" },
  { value: "#f472b6", name: "pink" },
  { value: "#f87171", name: "red" },
];

const STORAGE_KEY = "lms-accent";
const HEX = /^#[0-9a-f]{6}$/i;

/** Contrast the accent must reach against black, both as text on the page and behind black button labels. */
const MIN_CONTRAST = 4.5;

function channels(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(rgb: number[]) {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function contrastWithBlack(rgb: number[]) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05;
}

function toHsl([r, g, b]: number[]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rn ? ((gn - bn) / d + 6) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => (v + m) * 255);
}

/**
 * Lowercased `#rrggbb`, lightened (keeping its hue) just enough to stay
 * readable on the black background. Returns null for anything that isn't a
 * hex colour.
 */
export function normalizeAccent(input: string): string | null {
  if (!HEX.test(input)) return null;
  const rgb = channels(input.toLowerCase());
  if (contrastWithBlack(rgb) >= MIN_CONTRAST) return input.toLowerCase();
  const [h, s, l] = toHsl(rgb);
  for (let next = l; next <= 1; next += 0.02) {
    const lighter = fromHsl(h, s, next);
    if (contrastWithBlack(lighter) >= MIN_CONTRAST) return toHex(lighter);
  }
  return "#ffffff";
}

/** Applies the accent to the page and remembers it on this device. */
export function applyAccent(hex: string) {
  document.documentElement.style.setProperty("--brand", hex);
  try {
    if (hex === DEFAULT_ACCENT) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    // Storage blocked (private mode etc.) — the colour still applies for this page.
  }
}

/** The accent currently on the page. */
export function currentAccent() {
  return document.documentElement.style.getPropertyValue("--brand").trim() || DEFAULT_ACCENT;
}

/** Runs in <head> before first paint so a saved accent never flashes orange. */
export const ACCENT_SCRIPT = `try{var a=localStorage.getItem("${STORAGE_KEY}");if(a&&${HEX}.test(a))document.documentElement.style.setProperty("--brand",a)}catch(e){}`;
