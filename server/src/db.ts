import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db: Database.Database = new Database(join(dataDir, 'walter.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    id          TEXT PRIMARY KEY,
    seed        TEXT NOT NULL,
    theme       TEXT NOT NULL,
    mapSize     TEXT NOT NULL,
    difficulty  TEXT NOT NULL,
    walterX     REAL NOT NULL,
    walterY     REAL NOT NULL,
    creatorName TEXT NOT NULL,
    title       TEXT NOT NULL,
    createdAt   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    challengeId  TEXT NOT NULL,
    playerName   TEXT NOT NULL,
    rawTimeMs    INTEGER NOT NULL,
    wrongClicks  INTEGER NOT NULL,
    hintsUsed    INTEGER NOT NULL,
    stars        INTEGER NOT NULL,
    finishedAt   INTEGER NOT NULL,
    UNIQUE(challengeId, playerName)
  );

  CREATE INDEX IF NOT EXISTS idx_results_challenge ON results(challengeId);
`);

export interface ChallengeRow {
  id: string;
  seed: string;
  theme: string;
  mapSize: string;
  difficulty: string;
  walterX: number;
  walterY: number;
  creatorName: string;
  title: string;
  createdAt: number;
}

export interface ResultRow {
  challengeId: string;
  playerName: string;
  rawTimeMs: number;
  wrongClicks: number;
  hintsUsed: number;
  stars: number;
  finishedAt: number;
}
