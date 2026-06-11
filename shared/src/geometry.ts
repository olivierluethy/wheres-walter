import type { HitBox } from './types.js';

// A character is drawn centered on its (x, y) origin. These half-extents define
// the local drawing box (origin at the character's visual center).
export const CHAR_HALF_W = 19;
export const CHAR_HALF_H = 39;

/** Extra forgiveness added to Walter's bounding radius for hit detection. */
export const HIT_PADDING = 8;

/** Compute the hit box (in scene coords) for a character/Walter at scale. */
export function hitBoxFor(x: number, y: number, scale: number): HitBox {
  return {
    cx: x,
    cy: y,
    radius: CHAR_HALF_H * scale + HIT_PADDING,
  };
}

/** True if (px, py) lands within the Walter hit box. */
export function isHit(px: number, py: number, box: HitBox): boolean {
  const dx = px - box.cx;
  const dy = py - box.cy;
  return dx * dx + dy * dy <= box.radius * box.radius;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
