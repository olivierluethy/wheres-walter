// Seeds a demo challenge so /c/demo works immediately after setup.
import { deriveWalterPosition, type MapSettings } from '@walter/shared';
import { db } from './db.js';

const DEMO_ID = 'demo';
const settings: MapSettings = { seed: 'walter-demo-2024', theme: 'winter', mapSize: 'medium', difficulty: 'normal' };

// Place the demo Walter at the deterministic solo position for this seed so the
// scene is genuinely solvable.
const walter = deriveWalterPosition(settings);

db.prepare('DELETE FROM challenges WHERE id = ?').run(DEMO_ID);
db.prepare(
  `INSERT INTO challenges (id, seed, theme, mapSize, difficulty, walterX, walterY, creatorName, title, createdAt)
   VALUES (@id, @seed, @theme, @mapSize, @difficulty, @walterX, @walterY, @creatorName, @title, @createdAt)`
).run({
  id: DEMO_ID,
  seed: settings.seed,
  theme: settings.theme,
  mapSize: settings.mapSize,
  difficulty: settings.difficulty,
  walterX: walter.x,
  walterY: walter.y,
  creatorName: 'The Walter Team',
  title: 'Welcome Challenge — find Walter in the winter market!',
  createdAt: Date.now(),
});

console.log(`Seeded demo challenge at /c/${DEMO_ID}`);
