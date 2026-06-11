import { Router, type Request, type Response } from 'express';
import { nanoid } from 'nanoid';
import {
  MAP_SIZES,
  THEMES,
  MAX_HINTS,
  Rng,
  generateHint,
  hitBoxFor,
  isHit,
  starsFor,
  walterFragment,
  walterScale,
  type ChallengePublic,
  type ChallengeResult,
  type CreateChallengeResponse,
  type Difficulty,
  type MapSize,
  type Theme,
} from '@walter/shared';
import { db, type ChallengeRow, type ResultRow } from './db.js';

export const challengesRouter = Router();

// In-memory attempt tracking. Server owns timing so results can't be faked by
// the client: the clock starts when the attempt is created and stops on a
// server-validated hit.
interface Attempt {
  challengeId: string;
  playerName: string;
  startMs: number;
  hintsUsed: number;
  wrongClicks: number;
}
const attempts = new Map<string, Attempt>();

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && THEMES.includes(v as Theme);
}
function isMapSize(v: unknown): v is MapSize {
  return typeof v === 'string' && MAP_SIZES.includes(v as MapSize);
}
function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && DIFFICULTIES.includes(v as Difficulty);
}

function getChallenge(id: string): ChallengeRow | undefined {
  return db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as ChallengeRow | undefined;
}

function toPublic(row: ChallengeRow): ChallengePublic {
  return {
    id: row.id,
    seed: row.seed,
    theme: row.theme as Theme,
    mapSize: row.mapSize as MapSize,
    difficulty: row.difficulty as Difficulty,
    creatorName: row.creatorName,
    title: row.title,
    createdAt: row.createdAt,
  };
}

function publicHost(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}`;
}

// POST /api/challenges — create a challenge.
challengesRouter.post('/', (req: Request, res: Response) => {
  const { seed, theme, mapSize, difficulty, walterX, walterY, creatorName, title } = req.body ?? {};

  if (
    typeof seed !== 'string' || !seed ||
    !isTheme(theme) || !isMapSize(mapSize) || !isDifficulty(difficulty) ||
    typeof walterX !== 'number' || typeof walterY !== 'number' ||
    typeof creatorName !== 'string' || !creatorName.trim() ||
    typeof title !== 'string' || !title.trim()
  ) {
    return res.status(400).json({ error: 'Invalid challenge payload' });
  }

  const id = nanoid(10);
  const createdAt = Date.now();
  db.prepare(
    `INSERT INTO challenges (id, seed, theme, mapSize, difficulty, walterX, walterY, creatorName, title, createdAt)
     VALUES (@id, @seed, @theme, @mapSize, @difficulty, @walterX, @walterY, @creatorName, @title, @createdAt)`
  ).run({
    id, seed, theme, mapSize, difficulty,
    walterX, walterY,
    creatorName: creatorName.trim().slice(0, 40),
    title: title.trim().slice(0, 80),
    createdAt,
  });

  const host = publicHost(req);
  const response: CreateChallengeResponse = {
    id,
    shareUrl: `${host}/c/${id}`,
    resultsUrl: `${host}/c/${id}/results`,
  };
  res.status(201).json(response);
});

// GET /api/challenges/:id — public info, WITHOUT Walter's coordinates.
challengesRouter.get('/:id', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });
  res.json(toPublic(row));
});

// GET /api/challenges/:id/walter.svg — Walter as opaque SVG markup for the
// client to inject. Coordinates live only inside the rendered fragment; the
// client never parses them, and clicks are still validated server-side.
challengesRouter.get('/:id/walter.svg', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });
  const walter = {
    id: 0,
    x: row.walterX,
    y: row.walterY,
    scale: walterScale(row.walterY, row.mapSize as MapSize),
  };
  res.type('text/plain').send(walterFragment(walter));
});

// POST /api/challenges/:id/start — begin a timed attempt.
challengesRouter.post('/:id/start', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });

  const playerName = String(req.body?.playerName ?? '').trim().slice(0, 40);
  if (!playerName) return res.status(400).json({ error: 'Name required' });

  const existing = db
    .prepare('SELECT 1 FROM results WHERE challengeId = ? AND playerName = ?')
    .get(row.id, playerName);
  if (existing) return res.status(409).json({ error: 'You already have a result for this challenge' });

  const playToken = nanoid(16);
  const serverStartMs = Date.now();
  attempts.set(playToken, { challengeId: row.id, playerName, startMs: serverStartMs, hintsUsed: 0, wrongClicks: 0 });
  res.json({ playToken, serverStartMs });
});

// POST /api/challenges/:id/hints — returns hint geometry; never the exact spot.
challengesRouter.post('/:id/hints', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });

  const { playToken, level } = req.body ?? {};
  const attempt = attempts.get(String(playToken));
  if (!attempt || attempt.challengeId !== row.id) {
    return res.status(403).json({ error: 'Invalid play token' });
  }
  if (typeof level !== 'number' || level < 1 || level > MAX_HINTS) {
    return res.status(400).json({ error: 'Invalid hint level' });
  }
  if (attempt.hintsUsed >= MAX_HINTS) {
    return res.status(429).json({ error: 'No hints remaining' });
  }
  attempt.hintsUsed = Math.max(attempt.hintsUsed, level);

  const walter = { id: 0, x: row.walterX, y: row.walterY, scale: walterScale(row.walterY, row.mapSize as MapSize) };
  const rng = new Rng(`${playToken}|hint|${level}`);
  const circle = generateHint(walter, row.mapSize as MapSize, level, rng);
  res.json({ circle });
});

// POST /api/challenges/:id/clicks — validate a click; finalize the attempt on a hit.
challengesRouter.post('/:id/clicks', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });

  const { playToken, x, y } = req.body ?? {};
  const attempt = attempts.get(String(playToken));
  if (!attempt || attempt.challengeId !== row.id) {
    return res.status(403).json({ error: 'Invalid play token' });
  }
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const scale = walterScale(row.walterY, row.mapSize as MapSize);
  const box = hitBoxFor(row.walterX, row.walterY, scale);

  if (!isHit(x, y, box)) {
    attempt.wrongClicks += 1;
    return res.json({ hit: false });
  }

  // Hit — finalize using the server clock.
  const rawTimeMs = Date.now() - attempt.startMs;
  const stars = starsFor(rawTimeMs, attempt.wrongClicks, attempt.hintsUsed);
  const result: ChallengeResult = {
    challengeId: row.id,
    playerName: attempt.playerName,
    rawTimeMs,
    wrongClicks: attempt.wrongClicks,
    hintsUsed: attempt.hintsUsed,
    stars,
    finishedAt: Date.now(),
  };

  try {
    db.prepare(
      `INSERT INTO results (challengeId, playerName, rawTimeMs, wrongClicks, hintsUsed, stars, finishedAt)
       VALUES (@challengeId, @playerName, @rawTimeMs, @wrongClicks, @hintsUsed, @stars, @finishedAt)`
    ).run(result);
  } catch {
    // Unique constraint — a result already exists; treat as already finished.
    return res.status(409).json({ error: 'Result already submitted' });
  }
  attempts.delete(String(playToken));
  res.json({ hit: true, result });
});

// GET /api/challenges/:id/results — leaderboard (best result first).
challengesRouter.get('/:id/results', (req: Request, res: Response) => {
  const row = getChallenge(req.params.id);
  if (!row) return res.status(404).json({ error: 'Challenge not found' });

  const rows = db
    .prepare(
      `SELECT challengeId, playerName, rawTimeMs, wrongClicks, hintsUsed, stars, finishedAt
       FROM results WHERE challengeId = ?
       ORDER BY stars DESC, (rawTimeMs + wrongClicks*5000 + hintsUsed*15000) ASC`
    )
    .all(row.id) as ResultRow[];

  res.json({ challenge: toPublic(row), results: rows });
});
