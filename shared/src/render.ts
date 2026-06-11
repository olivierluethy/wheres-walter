import { Rng } from './rng.js';
import { WALTER_PARTS } from './palette.js';
import { THEME_BG, GROUND_FRACTION } from './background.js';
import type { CharacterParts, Pose, Scene, Theme, TopStyle, WalterInstance } from './types.js';

// ---------------------------------------------------------------------------
// Original procedural SVG artwork. Everything is drawn from primitive shapes —
// no copied or licensed imagery. A character is drawn centered on the origin;
// the scene renderer wraps each in a translate/scale group.
// ---------------------------------------------------------------------------

function esc(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function hat(parts: CharacterParts): string {
  const { hat: type, hatColor, hatPom } = parts;
  switch (type) {
    case 'beanie': {
      const dome = `<path d="M -11 -27 Q 0 -42 11 -27 Z" fill="${hatColor}"/>`;
      const band = `<rect x="-11.5" y="-29" width="23" height="6" rx="3" fill="${hatColor}" stroke="rgba(0,0,0,0.15)" stroke-width="0.6"/>`;
      const pom = hatPom ? `<circle cx="0" cy="-40" r="3" fill="#f8fafc"/>` : '';
      return dome + band + pom;
    }
    case 'cap': {
      const dome = `<path d="M -10 -27 Q 0 -40 10 -27 Z" fill="${hatColor}"/>`;
      const brim = `<path d="M -10 -27 L -19 -25 Q -20 -29 -10 -30 Z" fill="${hatColor}"/>`;
      return dome + brim;
    }
    case 'sunhat': {
      const brim = `<ellipse cx="0" cy="-26" rx="18" ry="4.5" fill="${hatColor}"/>`;
      const dome = `<path d="M -8 -27 Q 0 -39 8 -27 Z" fill="${hatColor}"/>`;
      return brim + dome;
    }
    case 'tophat': {
      const body = `<rect x="-7" y="-44" width="14" height="18" rx="1" fill="${hatColor}"/>`;
      const brim = `<ellipse cx="0" cy="-26" rx="13" ry="3.2" fill="${hatColor}"/>`;
      return body + brim;
    }
    default:
      return '';
  }
}

/** Torso: a solid or horizontally striped sweater (5–6 visible bands). */
function torso(top: TopStyle): string {
  const base = `<rect x="-11" y="-12" width="22" height="24" rx="6" fill="${top.colorA}"/>`;
  if (!top.striped) return base;
  // Alternating bands of colorB over the colorA base → 6 visible bands.
  const bands = [-8, 0, 8]
    .map((y) => `<rect x="-10.5" y="${y}" width="21" height="4" fill="${top.colorB}"/>`)
    .join('');
  return base + bands;
}

function glasses(parts: CharacterParts): string {
  if (!parts.glasses) return '';
  const c = parts.glassesColor;
  return (
    `<circle cx="-3.4" cy="-22" r="2.7" fill="none" stroke="${c}" stroke-width="1"/>` +
    `<circle cx="3.4" cy="-22" r="2.7" fill="none" stroke="${c}" stroke-width="1"/>` +
    `<line x1="-0.7" y1="-22" x2="0.7" y2="-22" stroke="${c}" stroke-width="1"/>`
  );
}

/** Legs + shoes, varying by pose. Sitting/crouching draw a lower, bent stance. */
function legs(parts: CharacterParts, pose: Pose): string {
  const shoeColor = parts.shoes;
  const shoe = (x: number, y: number) => `<rect x="${esc(x)}" y="${esc(y)}" width="8" height="4" rx="2" fill="${shoeColor}"/>`;
  const leg = (x: number, y: number, h: number) => `<rect x="${esc(x)}" y="${esc(y)}" width="6.5" height="${esc(h)}" rx="2.5" fill="${parts.pants}"/>`;
  switch (pose) {
    case 'walking':
      return leg(-9, 8, 28) + leg(3, 8, 26) + shoe(-11, 34) + shoe(3, 32);
    case 'sitting':
      // Thighs forward, shins down — a compact seated silhouette.
      return (
        `<rect x="-9" y="8" width="18" height="6" rx="3" fill="${parts.pants}"/>` +
        leg(-9, 12, 18) + leg(3, 12, 18) + shoe(-10, 28) + shoe(2, 28)
      );
    case 'crouching':
      return leg(-9, 14, 16) + leg(2.5, 14, 16) + shoe(-11, 28) + shoe(2, 28);
    case 'standing':
    case 'waving':
    default:
      return leg(-8, 8, 28) + leg(1.5, 8, 28) + shoe(-9, 34) + shoe(1, 34);
  }
}

/** Arms, varying by pose. Only `waving` raises an arm above the shoulder. */
function arms(parts: CharacterParts, pose: Pose): string {
  const sleeve = parts.top.colorA;
  const hand = (x: number, y: number) => `<circle cx="${esc(x)}" cy="${esc(y)}" r="2.4" fill="${parts.skin}"/>`;
  const armDown = (x: number) => `<rect x="${esc(x)}" y="-10" width="5" height="20" rx="2.5" fill="${sleeve}"/>`;
  switch (pose) {
    case 'waving': {
      // Left arm down; right arm raised high → unique tall silhouette.
      const left = armDown(-13.5) + hand(-11, 11);
      const raised = `<path d="M 9 -8 L 15 -34 L 19 -33 L 13 -7 Z" fill="${sleeve}"/>`;
      return left + raised + hand(17, -35);
    }
    case 'walking':
      return armDown(-13) + armDown(8.5) + hand(-10.5, 11) + hand(11, 11);
    case 'crouching':
      return (
        `<rect x="-13" y="-8" width="5" height="16" rx="2.5" fill="${sleeve}"/>` +
        `<rect x="8" y="-8" width="5" height="16" rx="2.5" fill="${sleeve}"/>` +
        hand(-10.5, 9) + hand(10.5, 9)
      );
    case 'sitting':
    case 'standing':
    default:
      return armDown(-13.5) + armDown(8.5) + hand(-11, 11) + hand(11, 11);
  }
}

/** Build the inner SVG for one character (centered at origin). */
export function characterSvg(parts: CharacterParts): string {
  const shadow = `<ellipse cx="0" cy="38" rx="13" ry="3.4" fill="rgba(2,6,23,0.28)"/>`;
  const hairBack = parts.hat === 'none'
    ? `<circle cx="0" cy="-23" r="10" fill="${parts.hair}"/>`
    : `<circle cx="0" cy="-22" r="9.6" fill="${parts.hair}"/>`;
  const head = `<circle cx="0" cy="-22" r="8.4" fill="${parts.skin}"/>`;

  return (
    shadow +
    legs(parts, parts.pose) +
    arms(parts, parts.pose) +
    torso(parts.top) +
    hairBack +
    head +
    glasses(parts) +
    hat(parts)
  );
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

function themeProp(theme: Theme, x: number, groundY: number, rng: Rng): string {
  switch (theme) {
    case 'beach': {
      const c = rng.pick(['#ef4444', '#f59e0b', '#10b981', '#3b82f6']);
      return `<g transform="translate(${esc(x)},${esc(groundY)})"><rect x="-1.5" y="-60" width="3" height="60" fill="#92400e"/><path d="M 0 -60 L -34 -34 L 34 -34 Z" fill="${c}"/></g>`;
    }
    case 'city': {
      const h = rng.int(120, 280);
      const w = rng.int(70, 130);
      const c = rng.pick(['#334155', '#1e293b', '#3f4d63']);
      const windows = Array.from({ length: Math.floor(h / 30) })
        .map((_, i) => `<rect x="${esc(-w / 2 + 10)}" y="${esc(-h + 14 + i * 28)}" width="${esc(w - 20)}" height="10" fill="rgba(250,204,21,0.5)"/>`)
        .join('');
      return `<g transform="translate(${esc(x)},${esc(groundY)})"><rect x="${esc(-w / 2)}" y="${esc(-h)}" width="${esc(w)}" height="${esc(h)}" fill="${c}"/>${windows}</g>`;
    }
    case 'winter': {
      const c = rng.pick(['#b91c1c', '#15803d', '#7c3aed']);
      return `<g transform="translate(${esc(x)},${esc(groundY)})"><rect x="-44" y="-70" width="88" height="70" rx="4" fill="#7c5c43"/><rect x="-50" y="-78" width="100" height="12" rx="3" fill="${c}"/><rect x="-50" y="-80" width="100" height="6" fill="#f8fafc"/></g>`;
    }
  }
}

/**
 * Render the full inner SVG for a scene: defs, themed background and the crowd.
 * Optionally renders Walter instances on top (solo mode + multiplayer; see
 * README for why a visual find-game must draw its targets client-side). Walter
 * is always drawn last so he can never be more than minimally occluded (§3.5).
 */
export function renderSceneSVG(scene: Scene, walters: WalterInstance[] = []): string {
  const { width, height } = scene;
  const theme = scene.settings.theme;
  const bg = THEME_BG[theme];
  const rng = new Rng(`${scene.settings.seed}|bg|${theme}`);

  const groundY = height * GROUND_FRACTION;

  const defs = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg.top}"/>
      <stop offset="100%" stop-color="${bg.bottom}"/>
    </linearGradient>
  </defs>`;

  const sky = `<rect x="0" y="0" width="${width}" height="${groundY}" fill="url(#sky)"/>`;
  const ground = `<rect x="0" y="${esc(groundY)}" width="${width}" height="${esc(height - groundY)}" fill="${bg.ground}"/>`;

  // Background props sit along the horizon.
  const propCount = Math.round(width / 240);
  let props = '';
  for (let i = 0; i < propCount; i++) {
    const x = rng.float(40, width - 40);
    props += themeProp(theme, x, groundY + rng.float(-4, 8), rng);
  }

  const crowd = scene.characters
    .map((ch) => `<g transform="translate(${esc(ch.x)},${esc(ch.y)}) scale(${esc(ch.scale)})">${characterSvg(ch.parts)}</g>`)
    .join('');

  const walterSvg = walters.map((w) => walterFragment(w)).join('');

  return defs + sky + ground + props + crowd + walterSvg;
}

/**
 * Render a single Walter as a standalone SVG `<g>` fragment. Used by the server
 * to ship a challenge's Walter to the client as opaque markup the client injects
 * but never parses into a usable coordinate (see README on concealment).
 */
export function walterFragment(w: WalterInstance): string {
  return `<g class="walter" data-walter="${w.id}" transform="translate(${esc(w.x)},${esc(w.y)}) scale(${esc(w.scale)})">${characterSvg(WALTER_PARTS)}</g>`;
}

/** Convenience: a standalone <svg> string (used for thumbnails / previews). */
export function renderSceneDocument(scene: Scene, walters: WalterInstance[] = []): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}">${renderSceneSVG(scene, walters)}</svg>`;
}
