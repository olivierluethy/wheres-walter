import type { MapSettings, Theme } from './types.js';
import { MAP_DIMENSIONS } from './dimensions.js';

// ---------------------------------------------------------------------------
// Theme backgrounds + a tiny WCAG-style contrast model. Shared by the renderer
// (to draw the background) and the map engine (to keep Walter on a spot where
// his high-contrast sweater stripes actually pop).
// ---------------------------------------------------------------------------

export const THEME_BG: Record<Theme, { top: string; bottom: string; ground: string }> = {
  beach: { top: '#38bdf8', bottom: '#7dd3fc', ground: '#fcd9a0' },
  city: { top: '#475569', bottom: '#64748b', ground: '#94a3b8' },
  winter: { top: '#1e3a5f', bottom: '#475e7a', ground: '#e2e8f0' },
};

/** Fraction of the map height that is "sky"; below this is ground. */
export const GROUND_FRACTION = 0.82;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

export function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** WCAG relative luminance of a hex color. */
export function relativeLuminance(hex: string): number {
  const lin = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two hex colors (1 = identical, 21 = max). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Approximate the background color directly under a point. Props are ignored
 * (Walter always renders on top of them), so this samples the sky gradient or
 * the ground band — enough to judge sweater contrast.
 */
export function backgroundColorAt(settings: MapSettings, _x: number, y: number): string {
  const { height } = MAP_DIMENSIONS[settings.mapSize];
  const bg = THEME_BG[settings.theme];
  const groundY = height * GROUND_FRACTION;
  if (y >= groundY) return bg.ground;
  const t = Math.max(0, Math.min(1, y / groundY));
  return lerpHex(bg.top, bg.bottom, t);
}
