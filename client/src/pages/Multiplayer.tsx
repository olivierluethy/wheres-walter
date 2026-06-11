import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MAX_PLAYERS,
  MAX_TIME_LIMIT_MS,
  MAX_WALTERS,
  MIN_PLAYERS,
  MIN_TIME_LIMIT_MS,
  MIN_WALTERS,
  generateScene,
  type GameEndPayload,
  type GameStartPayload,
  type MapSettings,
  type RoomPlayer,
  type RoomState,
  type Theme,
} from '@walter/shared';
import { SceneViewer } from '../components/SceneViewer';
import { Countdown } from '../components/Countdown';
import { getSocket } from '../lib/socket';
import { formatClock } from '../lib/format';
import { loadPlayerName, savePlayerName } from '../lib/storage';
import { useCountdownTo } from '../hooks/useStopwatch';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'beach', label: 'Beach' },
  { value: 'city', label: 'City' },
  { value: 'winter', label: 'Winter' },
];

export function Multiplayer() {
  const navigate = useNavigate();
  const socket = useMemo(() => getSocket(), []);
  const [view, setView] = useState<'menu' | 'room'>('menu');
  const [name, setName] = useState(loadPlayerName());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [you, setYou] = useState('');
  const [game, setGame] = useState<GameStartPayload | null>(null);
  const [claims, setClaims] = useState<Record<number, { color: string; playerId: string }>>({});
  const [lockedUntil, setLockedUntil] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [end, setEnd] = useState<GameEndPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    socket.on('room:state', (state) => {
      setRoom(state);
      if (state.phase === 'lobby') {
        setGame(null);
        setClaims({});
        setEnd(null);
      }
    });
    socket.on('game:start', (payload) => {
      setGame(payload);
      setClaims({});
      setEnd(null);
    });
    socket.on('game:claim', (p) => {
      setClaims((prev) => ({ ...prev, [p.walterId]: { color: p.color, playerId: p.playerId } }));
      setRoom((prev) => (prev ? { ...prev, players: p.players } : prev));
    });
    socket.on('game:lockout', ({ until }) => setLockedUntil(until));
    socket.on('game:miss', () => flash('Miss! Locked out for 2s'));
    socket.on('game:end', (payload) => setEnd(payload));
    socket.on('error:msg', ({ message }) => flash(message));

    return () => {
      socket.off('room:state');
      socket.off('game:start');
      socket.off('game:claim');
      socket.off('game:lockout');
      socket.off('game:miss');
      socket.off('game:end');
      socket.off('error:msg');
    };
  }, [socket]);

  const isHost = !!room?.players.find((p) => p.id === you)?.isHost;

  const createRoom = () => {
    if (!name.trim()) return setError('Enter a name first.');
    savePlayerName(name.trim());
    setError(null);
    socket.emit('room:create', { name: name.trim() }, (res) => {
      if (res.ok) {
        setRoom(res.state);
        setYou(res.you);
        setView('room');
      } else setError(res.error);
    });
  };

  const joinRoom = () => {
    if (!name.trim()) return setError('Enter a name first.');
    if (code.trim().length < 6) return setError('Enter the 6-character room code.');
    savePlayerName(name.trim());
    setError(null);
    socket.emit('room:join', { code: code.trim().toUpperCase(), name: name.trim() }, (res) => {
      if (res.ok) {
        setRoom(res.state);
        setYou(res.you);
        setView('room');
      } else setError(res.error);
    });
  };

  const leave = () => {
    socket.emit('room:leave');
    setRoom(null);
    setView('menu');
    navigate('/');
  };

  // ---- Menu ---------------------------------------------------------------
  if (view === 'menu') {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-slate-200">← Menu</button>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-100">Multiplayer</h1>
        <p className="mt-1 text-slate-400">Race {MIN_PLAYERS}–{MAX_PLAYERS} players to find the most Walters.</p>

        <div className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label">Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" maxLength={24} />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button onClick={createRoom} className="btn-primary w-full">Create a Room</button>
          <div className="flex items-center gap-3 text-xs text-slate-500"><div className="h-px flex-1 bg-slate-800" />OR<div className="h-px flex-1 bg-slate-800" /></div>
          <div className="flex gap-2">
            <input className="input uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} />
            <button onClick={joinRoom} className="btn-secondary whitespace-nowrap">Join</button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) return null;

  // ---- In-game ------------------------------------------------------------
  if (room.phase === 'playing' || room.phase === 'countdown') {
    return <GameBoard room={room} you={you} game={game} claims={claims} lockedUntil={lockedUntil} toast={toast} isHost={isHost} socket={socket} onLeave={leave} />;
  }

  if (room.phase === 'ended') {
    return <Podium room={room} you={you} end={end} isHost={isHost} onRematch={() => socket.emit('game:rematch')} onLeave={leave} />;
  }

  // ---- Lobby --------------------------------------------------------------
  return <Lobby room={room} you={you} isHost={isHost} socket={socket} toast={toast} onLeave={leave} />;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function Lobby({ room, you, isHost, socket, toast, onLeave }: { room: RoomState; you: string; isHost: boolean; socket: ReturnType<typeof getSocket>; toast: string | null; onLeave: () => void }) {
  const s = room.settings;
  const update = (patch: Partial<typeof s>) => socket.emit('room:settings', { settings: patch });
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="text-sm text-slate-400 hover:text-slate-200">← Leave</button>
        <button onClick={copyCode} className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-emerald-400 hover:bg-slate-700">
          {room.code}<span className="text-xs font-sans tracking-normal text-slate-400">{copied ? '✓' : 'copy'}</span>
        </button>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* Players */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-slate-100">Players ({room.players.length}/{MAX_PLAYERS})</h2>
          <ul className="space-y-2">
            {room.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-3 py-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-medium text-slate-100">{p.name}</span>
                {p.id === you && <span className="text-xs text-slate-500">(you)</span>}
                {p.isHost && <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">Host</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Settings */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-slate-100">Settings</h2>
          {!isHost && <p className="mb-3 text-xs text-slate-500">Only the host can change settings.</p>}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between label"><span>Walters</span><span className="text-slate-200">{s.walterCount}</span></div>
              <input type="range" min={MIN_WALTERS} max={MAX_WALTERS} value={s.walterCount} disabled={!isHost} onChange={(e) => update({ walterCount: Number(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
            <div>
              <div className="flex justify-between label"><span>Time limit</span><span className="text-slate-200">{Math.round(s.timeLimitMs / 60000)} min</span></div>
              <input type="range" min={MIN_TIME_LIMIT_MS} max={MAX_TIME_LIMIT_MS} step={60000} value={s.timeLimitMs} disabled={!isHost} onChange={(e) => update({ timeLimitMs: Number(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
            <div>
              <label className="label">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button key={t.value} disabled={!isHost} onClick={() => update({ theme: t.value })} className={`rounded-lg border px-2 py-2 text-xs font-medium ${s.theme === t.value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300'} disabled:opacity-60`}>{t.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Map size</label>
              <div className="grid grid-cols-2 gap-2">
                {(['large', 'xl'] as const).map((m) => (
                  <button key={m} disabled={!isHost} onClick={() => update({ mapSize: m })} className={`rounded-lg border px-2 py-2 text-xs font-medium uppercase ${s.mapSize === m ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300'} disabled:opacity-60`}>{m}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isHost ? (
          <button onClick={() => socket.emit('game:start')} className="btn-primary w-full py-4 text-lg">Start Game</button>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-4 text-center text-slate-400">Waiting for the host to start…</div>
        )}
      </div>
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game board
// ---------------------------------------------------------------------------
function GameBoard({ room, you, game, claims, lockedUntil, toast, isHost, socket, onLeave }: {
  room: RoomState; you: string; game: GameStartPayload | null; claims: Record<number, { color: string; playerId: string }>; lockedUntil: number; toast: string | null; isHost: boolean; socket: ReturnType<typeof getSocket>; onLeave: () => void;
}) {
  const settings: MapSettings | null = game ? { seed: game.seed, theme: game.settings.theme, mapSize: game.settings.mapSize, difficulty: 'normal', decoyTrickiness: 0.5 } : null;
  const scene = useMemo(() => (settings ? generateScene(settings) : null), [settings]);
  const remaining = useCountdownTo(game?.endsAt ?? null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const locked = now < lockedUntil;

  const handleClick = (x: number, y: number) => {
    if (locked) return;
    socket.emit('game:click', { x, y });
  };

  const claimOverlay = game && (
    <>
      {Object.entries(claims).map(([wid, c]) => {
        const w = game.walters.find((ww) => ww.id === Number(wid));
        if (!w) return null;
        return (
          <g key={wid} transform={`translate(${w.x} ${w.y})`}>
            <circle r={46} fill="none" stroke={c.color} strokeWidth={6} />
            <circle r={46} fill={c.color} opacity={0.18} />
          </g>
        );
      })}
    </>
  );

  const found = Object.keys(claims).length;
  const total = game?.walters.length ?? room.settings.walterCount;

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row">
      {/* Board */}
      <div className="relative flex flex-1 flex-col">
        <header className="z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur">
          <button onClick={onLeave} className="btn-ghost px-3 py-1.5 text-sm">← Leave</button>
          <div className="flex-1 text-center font-mono text-2xl font-bold tabular-nums text-emerald-400">{formatClock(remaining)}</div>
          <div className="text-sm text-slate-300">{found}/{total} found</div>
        </header>
        <div className="relative flex-1 p-3">
          {scene && (
            <SceneViewer scene={scene} walters={game?.walters} overlay={claimOverlay} onSceneClick={handleClick} disabled={room.phase !== 'playing' || locked} className="h-full w-full" />
          )}
          {room.phase === 'countdown' && <Countdown from={3} onDone={() => undefined} />}
          {locked && room.phase === 'playing' && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-rose-500/90 px-4 py-1.5 text-sm font-semibold text-white">
              Locked out — {Math.ceil((lockedUntil - now) / 1000)}s
            </div>
          )}
        </div>
        {toast && <Toast>{toast}</Toast>}
      </div>

      {/* Scoreboard */}
      <aside className="border-t border-slate-800 bg-slate-900 p-4 md:w-64 md:border-l md:border-t-0">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Scoreboard</h2>
        <ul className="space-y-2">
          {room.players.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${p.id === you ? 'bg-slate-800' : ''}`}>
              <span className="w-4 text-center text-xs font-bold text-slate-500">{i + 1}</span>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className={`flex-1 truncate text-sm ${p.online ? 'text-slate-100' : 'text-slate-500 line-through'}`}>{p.name}</span>
              <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">{p.found}</span>
            </li>
          ))}
        </ul>
        {isHost && <p className="mt-4 text-xs text-slate-600">You are the host.</p>}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podium
// ---------------------------------------------------------------------------
function Podium({ room, you, end, isHost, onRematch, onLeave }: { room: RoomState; you: string; end: GameEndPayload | null; isHost: boolean; onRematch: () => void; onLeave: () => void }) {
  const players: RoomPlayer[] = (end?.players ?? room.players).slice().sort((a, b) => b.found - a.found || (a.lastFindMs ?? Infinity) - (b.lastFindMs ?? Infinity));
  const winner = players[0];
  const podiumOrder = [players[1], players[0], players[2]].filter(Boolean);
  const heights = ['h-24', 'h-36', 'h-16'];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-center text-3xl font-extrabold text-slate-100">
        {end?.reason === 'all-found' ? 'All Walters found!' : "Time's up!"}
      </h1>
      {winner && winner.found > 0 && (
        <p className="mt-1 text-center text-amber-300">🏆 {winner.name} wins with {winner.found} Walters!</p>
      )}

      {/* Podium */}
      <div className="mt-8 flex items-end justify-center gap-3">
        {podiumOrder.map((p, idx) => {
          const place = p === players[0] ? 1 : p === players[1] ? 2 : 3;
          return (
            <div key={p.id} className="flex w-24 flex-col items-center">
              <div className="mb-2 flex flex-col items-center">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="mt-1 max-w-full truncate text-sm font-semibold text-slate-100">{p.name}</span>
                <span className="text-xs text-slate-400">{p.found}</span>
              </div>
              <div className={`w-full rounded-t-lg bg-slate-800 ${heights[idx]} flex items-start justify-center pt-2 text-2xl font-bold text-slate-500`}>
                {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="card mt-8 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2 text-right">Walters</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {players.map((p, i) => (
              <tr key={p.id} className={p.id === you ? 'bg-emerald-500/10' : ''}>
                <td className="px-3 py-2 font-bold text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 text-slate-100">{p.name} {p.id === you && <span className="text-xs text-slate-500">(you)</span>}</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-400">{p.found}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={onLeave} className="btn-secondary flex-1">Leave</button>
        {isHost ? (
          <button onClick={onRematch} className="btn-primary flex-1">Rematch</button>
        ) : (
          <div className="flex-1 rounded-2xl border border-dashed border-slate-700 px-4 py-3 text-center text-sm text-slate-400">Waiting for host…</div>
        )}
      </div>
    </div>
  );
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-full bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-slate-700">
      {children}
    </div>
  );
}
