// ---------------------------------------------------------------------------
// Core shared types. Imported by both client and server so that maps render
// identically on both sides and event payloads are type-checked end-to-end.
// ---------------------------------------------------------------------------

export type MapSize = 'small' | 'medium' | 'large' | 'xl';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'beach' | 'city' | 'winter';

export const THEMES: Theme[] = ['beach', 'city', 'winter'];

export const MAP_SIZES: MapSize[] = ['small', 'medium', 'large', 'xl'];

/** Full set of inputs that deterministically define a scene. */
export interface MapSettings {
  seed: string;
  theme: Theme;
  mapSize: MapSize;
  difficulty: Difficulty;
}

export type HatType = 'none' | 'beanie' | 'cap' | 'sunhat' | 'tophat';

/** The visible attributes that make up a single character. */
export interface CharacterParts {
  skin: string;
  hair: string;
  jacket: string;
  pants: string;
  hat: HatType;
  hatColor: string;
  /** Pom-pom on the beanie (Walter has one). */
  hatPom: boolean;
  scarf: boolean;
  scarfStriped: boolean;
  scarfColor: string;
  scarfColor2: string;
  glasses: boolean;
  glassesColor: string;
}

/** A placed character in scene coordinates. */
export interface SceneCharacter {
  id: number;
  x: number;
  y: number;
  /** Per-character render scale (depth). */
  scale: number;
  parts: CharacterParts;
}

/** A Walter placed in the scene (own type so server can track claims). */
export interface WalterInstance {
  id: number;
  x: number;
  y: number;
  scale: number;
}

/** Bounding geometry used for hit detection, in scene coordinates. */
export interface HitBox {
  cx: number;
  cy: number;
  /** Tolerance radius = rendered half-height * scale + padding. */
  radius: number;
}

/** A fully generated scene (background + decoy crowd). Walters are separate. */
export interface Scene {
  settings: MapSettings;
  width: number;
  height: number;
  characters: SceneCharacter[];
}

/** Geometry for a hint circle. Walter is guaranteed inside, never centered. */
export interface HintCircle {
  cx: number;
  cy: number;
  radius: number;
  /** 1, 2 or 3 — which hint level this is. */
  level: number;
}

export type StarRating = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Challenge REST payloads
// ---------------------------------------------------------------------------

export interface ChallengePublic {
  id: string;
  seed: string;
  theme: Theme;
  mapSize: MapSize;
  difficulty: Difficulty;
  creatorName: string;
  title: string;
  createdAt: number;
  // NOTE: walterX / walterY are intentionally omitted from public responses.
}

export interface CreateChallengeRequest {
  seed: string;
  theme: Theme;
  mapSize: MapSize;
  difficulty: Difficulty;
  walterX: number;
  walterY: number;
  creatorName: string;
  title: string;
}

export interface CreateChallengeResponse {
  id: string;
  shareUrl: string;
  resultsUrl: string;
}

export interface ClickRequest {
  /** Server-issued play token tying a click to a started attempt. */
  playToken: string;
  x: number;
  y: number;
}

export interface ClickResponse {
  hit: boolean;
  /** Present only when hit === true (the attempt is finalized server-side). */
  result?: ChallengeResult;
}

export interface HintRequest {
  playToken: string;
  level: number;
}

export interface HintResponse {
  circle: HintCircle;
}

export interface StartAttemptRequest {
  playerName: string;
}

export interface StartAttemptResponse {
  playToken: string;
  serverStartMs: number;
}

export interface ChallengeResult {
  challengeId: string;
  playerName: string;
  rawTimeMs: number;
  wrongClicks: number;
  hintsUsed: number;
  stars: StarRating;
  finishedAt: number;
}

// ---------------------------------------------------------------------------
// Multiplayer (Socket.IO) types
// ---------------------------------------------------------------------------

export interface RoomSettings {
  walterCount: number; // 5–20
  timeLimitMs: number; // 1–5 min
  theme: Theme;
  mapSize: MapSize; // large or xl
}

export interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  online: boolean;
  found: number;
  lastFindMs: number | null;
}

export type RoomPhase = 'lobby' | 'countdown' | 'playing' | 'ended';

export interface RoomState {
  code: string;
  phase: RoomPhase;
  settings: RoomSettings;
  players: RoomPlayer[];
  seed: string;
  /** Epoch ms when play started (after countdown); null until then. */
  startedAt: number | null;
  /** Epoch ms when play ends. */
  endsAt: number | null;
}

/** A Walter that has been claimed in multiplayer. */
export interface ClaimedWalter {
  walterId: number;
  playerId: string;
  color: string;
  at: number;
}

export interface GameStartPayload {
  seed: string;
  settings: RoomSettings;
  /**
   * Walter positions for rendering. (See README: a visual find-game must draw
   * the targets client-side; the server remains authoritative for claims,
   * timing and scoring.)
   */
  walters: WalterInstance[];
  startedAt: number;
  endsAt: number;
}

export interface GameEndPayload {
  reason: 'time' | 'all-found';
  players: RoomPlayer[];
  claims: ClaimedWalter[];
  winnerId: string | null;
}

// Socket.IO event maps -------------------------------------------------------

export interface ClientToServerEvents {
  'room:create': (
    p: { name: string; settings?: Partial<RoomSettings> },
    cb: (res: { ok: true; state: RoomState; you: string } | { ok: false; error: string }) => void
  ) => void;
  'room:join': (
    p: { code: string; name: string },
    cb: (res: { ok: true; state: RoomState; you: string } | { ok: false; error: string }) => void
  ) => void;
  'room:settings': (p: { settings: Partial<RoomSettings> }) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:click': (p: { x: number; y: number }) => void;
  'game:rematch': () => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:countdown': (p: { from: number }) => void;
  'game:start': (p: GameStartPayload) => void;
  'game:claim': (p: ClaimedWalter & { players: RoomPlayer[] }) => void;
  'game:miss': (p: { lockoutMs: number }) => void;
  'game:lockout': (p: { until: number }) => void;
  'game:end': (p: GameEndPayload) => void;
  'error:msg': (p: { message: string }) => void;
}
