import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HINT_DURATION_MS,
  MAX_HINTS,
  type ChallengeResult,
  type HintCircle,
  type Scene,
  type WalterInstance,
} from '@walter/shared';
import { SceneViewer } from './SceneViewer';
import { Countdown } from './Countdown';
import { formatTime } from '../lib/format';

export interface WinInfo {
  rawMs: number;
  wrongClicks: number;
  hintsUsed: number;
  serverResult?: ChallengeResult;
}

interface Props {
  scene: Scene;
  walters?: WalterInstance[];
  extraSvg?: string;
  title: string;
  subtitle?: string;
  validateClick: (x: number, y: number) => Promise<{ hit: boolean; result?: ChallengeResult }>;
  requestHint: (level: number) => Promise<HintCircle>;
  onWin: (info: WinInfo) => void;
  onExit: () => void;
  frozen?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function HuntGame({ scene, walters, extraSvg, title, subtitle, validateClick, requestHint, onWin, onExit, frozen }: Props) {
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'won'>('countdown');
  const [elapsed, setElapsed] = useState(0);
  const [wrongClicks, setWrongClicks] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hint, setHint] = useState<HintCircle | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [busy, setBusy] = useState(false);
  const [foundAt, setFoundAt] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRef = useRef<number | null>(null);
  const rippleId = useRef(0);
  const playing = phase === 'playing' && !frozen;

  // Stopwatch.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      if (startRef.current != null) setElapsed(Date.now() - startRef.current);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  const beginPlay = useCallback(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setPhase('playing');
  }, []);

  const handleClick = async (x: number, y: number) => {
    if (!playing || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await validateClick(x, y);
      if (res.hit) {
        const rawMs = startRef.current != null ? Date.now() - startRef.current : elapsed;
        setElapsed(rawMs);
        setFoundAt({ x, y });
        setPhase('won');
        onWin({ rawMs, wrongClicks, hintsUsed, serverResult: res.result });
      } else {
        setWrongClicks((w) => w + 1);
        const id = rippleId.current++;
        setRipples((r) => [...r, { id, x, y }]);
        setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const useHint = async () => {
    if (!playing || busy || hintsUsed >= MAX_HINTS) return;
    const level = hintsUsed + 1;
    setBusy(true);
    setError(null);
    try {
      const circle = await requestHint(level);
      setHintsUsed(level);
      setHint(circle);
      setTimeout(() => setHint((c) => (c === circle ? null : c)), HINT_DURATION_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hint failed');
    } finally {
      setBusy(false);
    }
  };

  const displayedMs = elapsed + wrongClicks * 5000;
  const hintPenaltyMs = hintsUsed * 15000;

  const overlay = (
    <>
      {hint && (
        <circle
          cx={hint.cx}
          cy={hint.cy}
          r={hint.radius}
          className="animate-hint-pulse"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
          fill="rgba(251, 191, 36, 0.18)"
          stroke="#f59e0b"
          strokeWidth={4}
        />
      )}
      {ripples.map((r) => (
        <circle
          key={r.id}
          cx={r.x}
          cy={r.y}
          r={26}
          className="animate-ripple"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
          fill="rgba(244, 63, 94, 0.35)"
          stroke="#f43f5e"
          strokeWidth={3}
        />
      ))}
      {foundAt && (
        <g transform={`translate(${foundAt.x} ${foundAt.y})`}>
          <circle r={48} fill="none" stroke="#10b981" strokeWidth={5} className="animate-hint-pulse" style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties} />
          <circle r={6} fill="#10b981" />
        </g>
      )}
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Top bar */}
      <header className="z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <button onClick={onExit} className="btn-ghost px-3 py-2 text-sm" aria-label="Back to menu">
          ← Menu
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-200">{title}</div>
          {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-emerald-400">
          {formatTime(displayedMs)}
        </div>

        <div className="flex flex-col items-end">
          <button
            onClick={useHint}
            disabled={!playing || busy || hintsUsed >= MAX_HINTS}
            className="btn-secondary px-3 py-2 text-sm"
          >
            💡 Hint <span className="text-slate-400">({MAX_HINTS - hintsUsed})</span>
          </button>
          <span className="mt-0.5 text-[11px] text-amber-400/80">
            {hintsUsed > 0 ? `+${hintPenaltyMs / 1000}s used` : '+15s each'}
          </span>
        </div>
      </header>

      {error && (
        <div className="bg-rose-500/15 px-4 py-1.5 text-center text-sm text-rose-300">{error}</div>
      )}

      {/* Board */}
      <div className="relative flex-1 p-3">
        <SceneViewer
          scene={scene}
          walters={walters}
          extraSvg={extraSvg}
          overlay={overlay}
          onSceneClick={handleClick}
          disabled={!playing}
          className="h-full w-full"
        />
        {phase === 'countdown' && <Countdown from={3} onDone={beginPlay} />}
      </div>
    </div>
  );
}
