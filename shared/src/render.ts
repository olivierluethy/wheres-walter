import { Rng } from './rng.js';
import { WALTER_PARTS } from './palette.js';
import type { CharacterParts, Scene, Theme, WalterInstance } from './types.js';

// ---------------------------------------------------------------------------
// Original procedural SVG artwork. Everything here is drawn from primitive
// shapes — no copied or licensed imagery. A character is drawn centered on the
// origin; the scene renderer wraps each in a translate/scale group.
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

function scarf(parts: CharacterParts): string {
  if (!parts.scarf) return '';
  const base = `<rect x="-11" y="-13" width="22" height="7" rx="3" fill="${parts.scarfColor}"/>`;
  const tail = `<rect x="4" y="-8" width="5" height="12" rx="2" fill="${parts.scarfColor}"/>`;
  if (!parts.scarfStriped) return base + tail;
  // Diagonal stripes in the secondary color.
  const stripes = [-9, -5, -1, 3, 7]
    .map((sx) => `<rect x="${sx}" y="-13" width="2" height="7" fill="${parts.scarfColor2}"/>`)
    .join('');
  const tailStripe = `<rect x="4" y="-3" width="5" height="2" fill="${parts.scarfColor2}"/><rect x="4" y="1" width="5" height="2" fill="${parts.scarfColor2}"/>`;
  return base + stripes + tail + tailStripe;
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

/** Build the inner SVG for one character (centered at origin). */
export function characterSvg(parts: CharacterParts): string {
  const shadow = `<ellipse cx="0" cy="38" rx="13" ry="3.4" fill="rgba(2,6,23,0.28)"/>`;
  const legL = `<rect x="-8" y="8" width="6.5" height="28" rx="2.5" fill="${parts.pants}"/>`;
  const legR = `<rect x="1.5" y="8" width="6.5" height="28" rx="2.5" fill="${parts.pants}"/>`;
  const shoeL = `<rect x="-9" y="34" width="8" height="4" rx="2" fill="#0f172a"/>`;
  const shoeR = `<rect x="1" y="34" width="8" height="4" rx="2" fill="#0f172a"/>`;
  const body = `<rect x="-11" y="-12" width="22" height="24" rx="6" fill="${parts.jacket}"/>`;
  const armL = `<rect x="-13.5" y="-10" width="5" height="20" rx="2.5" fill="${parts.jacket}"/>`;
  const armR = `<rect x="8.5" y="-10" width="5" height="20" rx="2.5" fill="${parts.jacket}"/>`;
  const handL = `<circle cx="-11" cy="11" r="2.4" fill="${parts.skin}"/>`;
  const handR = `<circle cx="11" cy="11" r="2.4" fill="${parts.skin}"/>`;
  const hairBack = parts.hat === 'none'
    ? `<circle cx="0" cy="-23" r="10" fill="${parts.hair}"/>`
    : `<circle cx="0" cy="-22" r="9.6" fill="${parts.hair}"/>`;
  const head = `<circle cx="0" cy="-22" r="8.4" fill="${parts.skin}"/>`;

  return (
    shadow +
    legL + legR + shoeL + shoeR +
    armL + armR +
    body +
    handL + handR +
    hairBack +
    head +
    scarf(parts) +
    glasses(parts) +
    hat(parts)
  );
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

const THEME_BG: Record<Theme, { top: string; bottom: string; ground: string }> = {
  beach: { top: '#38bdf8', bottom: '#7dd3fc', ground: '#fcd9a0' },
  city: { top: '#475569', bottom: '#64748b', ground: '#94a3b8' },
  winter: { top: '#1e3a5f', bottom: '#475e7a', ground: '#e2e8f0' },
};

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
 * README for why a visual find-game must draw its targets client-side).
 */
export function renderSceneSVG(scene: Scene, walters: WalterInstance[] = []): string {
  const { width, height } = scene;
  const theme = scene.settings.theme;
  const bg = THEME_BG[theme];
  const rng = new Rng(`${scene.settings.seed}|bg|${theme}`);

  const groundY = height * 0.82;

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
