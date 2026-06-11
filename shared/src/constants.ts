import type { RoomSettings } from './types.js';

export const WRONG_CLICK_LOCKOUT_MS = 2_000;
export const MAX_HINTS = 3;
export const COUNTDOWN_FROM = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const MIN_WALTERS = 5;
export const MAX_WALTERS = 20;
export const DEFAULT_WALTERS = 10;

export const MIN_TIME_LIMIT_MS = 60_000;
export const MAX_TIME_LIMIT_MS = 300_000;
export const DEFAULT_TIME_LIMIT_MS = 180_000;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  walterCount: DEFAULT_WALTERS,
  timeLimitMs: DEFAULT_TIME_LIMIT_MS,
  theme: 'winter',
  mapSize: 'large',
};

/** Distinct, high-contrast colors assigned to multiplayer players in order. */
export const PLAYER_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];
