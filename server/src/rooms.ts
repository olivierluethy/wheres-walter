import type { Server, Socket } from 'socket.io';
import {
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS,
  MAX_TIME_LIMIT_MS,
  MAX_WALTERS,
  MIN_TIME_LIMIT_MS,
  MIN_WALTERS,
  PLAYER_COLORS,
  COUNTDOWN_FROM,
  WRONG_CLICK_LOCKOUT_MS,
  THEMES,
  deriveWalterPositions,
  hitBoxFor,
  isHit,
  randomSeed,
  type ClaimedWalter,
  type ClientToServerEvents,
  type RoomPlayer,
  type RoomSettings,
  type RoomState,
  type ServerToClientEvents,
  type WalterInstance,
} from '@walter/shared';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Player extends RoomPlayer {}

interface Room {
  code: string;
  hostId: string;
  phase: RoomState['phase'];
  settings: RoomSettings;
  players: Map<string, Player>;
  seed: string;
  walters: WalterInstance[];
  claims: Map<number, ClaimedWalter>;
  lockouts: Map<string, number>;
  startedAt: number | null;
  endsAt: number | null;
  countdownTimer?: NodeJS.Timeout;
  endTimer?: NodeJS.Timeout;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();
  /** socketId → roomCode */
  private socketRoom = new Map<string, string>();

  constructor(private io: IOServer) {}

  private makeCode(): string {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  private clampSettings(s: Partial<RoomSettings>, base: RoomSettings): RoomSettings {
    const next: RoomSettings = { ...base, ...s };
    next.walterCount = Math.max(MIN_WALTERS, Math.min(MAX_WALTERS, Math.round(next.walterCount)));
    next.timeLimitMs = Math.max(MIN_TIME_LIMIT_MS, Math.min(MAX_TIME_LIMIT_MS, Math.round(next.timeLimitMs)));
    if (!THEMES.includes(next.theme)) next.theme = base.theme;
    // Multiplayer uses big maps only.
    if (next.mapSize !== 'large' && next.mapSize !== 'xl') next.mapSize = 'large';
    return next;
  }

  private state(room: Room): RoomState {
    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].sort((a, b) => b.found - a.found || (a.lastFindMs ?? Infinity) - (b.lastFindMs ?? Infinity)),
      seed: room.seed,
      startedAt: room.startedAt,
      endsAt: room.endsAt,
    };
  }

  private broadcast(room: Room): void {
    this.io.to(room.code).emit('room:state', this.state(room));
  }

  private nextColor(room: Room): string {
    const used = new Set([...room.players.values()].map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
  }

  create(socket: IOSocket, name: string, settings?: Partial<RoomSettings>): RoomState {
    const code = this.makeCode();
    const room: Room = {
      code,
      hostId: socket.id,
      phase: 'lobby',
      settings: this.clampSettings(settings ?? {}, DEFAULT_ROOM_SETTINGS),
      players: new Map(),
      seed: randomSeed(),
      walters: [],
      claims: new Map(),
      lockouts: new Map(),
      startedAt: null,
      endsAt: null,
    };
    room.players.set(socket.id, this.newPlayer(socket.id, name, room, true));
    this.rooms.set(code, room);
    this.socketRoom.set(socket.id, code);
    socket.join(code);
    this.broadcast(room);
    return this.state(room);
  }

  private newPlayer(id: string, name: string, room: Room, isHost: boolean): Player {
    return {
      id,
      name: name.trim().slice(0, 24) || 'Player',
      color: this.nextColor(room),
      isHost,
      online: true,
      found: 0,
      lastFindMs: null,
    };
  }

  join(socket: IOSocket, code: string, name: string): { ok: true; state: RoomState } | { ok: false; error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.phase !== 'lobby') return { ok: false, error: 'Game already in progress' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };

    room.players.set(socket.id, this.newPlayer(socket.id, name, room, false));
    this.socketRoom.set(socket.id, room.code);
    socket.join(room.code);
    this.broadcast(room);
    return { ok: true, state: this.state(room) };
  }

  updateSettings(socket: IOSocket, settings: Partial<RoomSettings>): void {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.settings = this.clampSettings(settings, room.settings);
    this.broadcast(room);
  }

  start(socket: IOSocket): void {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    if (room.players.size < 1) return;
    this.beginCountdown(room);
  }

  private beginCountdown(room: Room): void {
    room.phase = 'countdown';
    room.seed = randomSeed();
    room.claims.clear();
    room.lockouts.clear();
    for (const p of room.players.values()) {
      p.found = 0;
      p.lastFindMs = null;
    }
    room.walters = deriveWalterPositions(
      { seed: room.seed, theme: room.settings.theme, mapSize: room.settings.mapSize, difficulty: 'normal' },
      room.settings.walterCount
    );
    this.broadcast(room);
    this.io.to(room.code).emit('game:countdown', { from: COUNTDOWN_FROM });

    room.countdownTimer = setTimeout(() => {
      const startedAt = Date.now();
      const endsAt = startedAt + room.settings.timeLimitMs;
      room.phase = 'playing';
      room.startedAt = startedAt;
      room.endsAt = endsAt;
      this.io.to(room.code).emit('game:start', {
        seed: room.seed,
        settings: room.settings,
        walters: room.walters,
        startedAt,
        endsAt,
      });
      this.broadcast(room);
      room.endTimer = setTimeout(() => this.endGame(room, 'time'), room.settings.timeLimitMs);
    }, COUNTDOWN_FROM * 1000);
  }

  click(socket: IOSocket, x: number, y: number): void {
    const room = this.roomOf(socket);
    if (!room || room.phase !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const now = Date.now();
    const lockedUntil = room.lockouts.get(socket.id) ?? 0;
    if (now < lockedUntil) return; // still locked out

    // Find an unclaimed Walter under the click (nearest wins on overlap).
    let bestId = -1;
    let bestDist = Infinity;
    for (const w of room.walters) {
      if (room.claims.has(w.id)) continue;
      const box = hitBoxFor(w.x, w.y, w.scale);
      if (isHit(x, y, box)) {
        const d = (x - w.x) ** 2 + (y - w.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestId = w.id;
        }
      }
    }

    if (bestId === -1) {
      // Miss → personal lockout.
      const until = now + WRONG_CLICK_LOCKOUT_MS;
      room.lockouts.set(socket.id, until);
      socket.emit('game:miss', { lockoutMs: WRONG_CLICK_LOCKOUT_MS });
      socket.emit('game:lockout', { until });
      return;
    }

    // Claim (single-threaded event loop → first processed click wins the race).
    const claim: ClaimedWalter = { walterId: bestId, playerId: socket.id, color: player.color, at: now };
    room.claims.set(bestId, claim);
    player.found += 1;
    player.lastFindMs = now;

    this.io.to(room.code).emit('game:claim', { ...claim, players: this.state(room).players });
    this.broadcast(room);

    if (room.claims.size >= room.walters.length) {
      this.endGame(room, 'all-found');
    }
  }

  private endGame(room: Room, reason: 'time' | 'all-found'): void {
    if (room.phase === 'ended') return;
    if (room.endTimer) clearTimeout(room.endTimer);
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    room.phase = 'ended';

    const players = this.state(room).players;
    // Winner: most found; tie-break = earlier last-find timestamp.
    let winnerId: string | null = null;
    let best: Player | null = null;
    for (const p of players) {
      if (p.found === 0) continue;
      if (!best || p.found > best.found || (p.found === best.found && (p.lastFindMs ?? Infinity) < (best.lastFindMs ?? Infinity))) {
        best = p;
      }
    }
    if (best) winnerId = best.id;

    this.io.to(room.code).emit('game:end', {
      reason,
      players,
      claims: [...room.claims.values()],
      winnerId,
    });
    this.broadcast(room);
  }

  rematch(socket: IOSocket): void {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'ended') return;
    this.beginCountdown(room);
  }

  leave(socket: IOSocket): void {
    const room = this.roomOf(socket);
    if (!room) return;
    this.socketRoom.delete(socket.id);
    socket.leave(room.code);

    const player = room.players.get(socket.id);
    if (!player) return;

    if (room.phase === 'lobby') {
      // In the lobby, fully remove the player.
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        this.disposeRoom(room);
        return;
      }
      if (room.hostId === socket.id) this.migrateHost(room);
    } else {
      // Mid-game: mark offline but keep their finds counting.
      player.online = false;
      if (room.hostId === socket.id) this.migrateHost(room);
      const anyOnline = [...room.players.values()].some((p) => p.online);
      if (!anyOnline) {
        this.disposeRoom(room);
        return;
      }
    }
    this.broadcast(room);
  }

  private migrateHost(room: Room): void {
    const next = [...room.players.values()].find((p) => p.online);
    if (next) {
      room.hostId = next.id;
      for (const p of room.players.values()) p.isHost = p.id === next.id;
    }
  }

  private disposeRoom(room: Room): void {
    if (room.endTimer) clearTimeout(room.endTimer);
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    this.rooms.delete(room.code);
  }

  private roomOf(socket: IOSocket): Room | undefined {
    const code = this.socketRoom.get(socket.id);
    return code ? this.rooms.get(code) : undefined;
  }
}

/** Wire a connected socket to the room manager. */
export function registerSocketHandlers(io: IOServer, manager: RoomManager): void {
  io.on('connection', (socket: IOSocket) => {
    socket.on('room:create', ({ name, settings }, cb) => {
      try {
        const state = manager.create(socket, name || 'Host', settings);
        cb({ ok: true, state, you: socket.id });
      } catch {
        cb({ ok: false, error: 'Could not create room' });
      }
    });

    socket.on('room:join', ({ code, name }, cb) => {
      const res = manager.join(socket, code || '', name || 'Player');
      if (res.ok) cb({ ok: true, state: res.state, you: socket.id });
      else cb({ ok: false, error: res.error });
    });

    socket.on('room:settings', ({ settings }) => manager.updateSettings(socket, settings));
    socket.on('game:start', () => manager.start(socket));
    socket.on('game:click', ({ x, y }) => manager.click(socket, x, y));
    socket.on('game:rematch', () => manager.rematch(socket));
    socket.on('room:leave', () => manager.leave(socket));
    socket.on('disconnect', () => manager.leave(socket));
  });
}
