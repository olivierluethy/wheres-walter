import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  generateScene,
  randomSeed,
  walterScale,
  type MapSettings,
  type MapSize,
  type Theme,
} from '@walter/shared';
import { SceneViewer } from '../components/SceneViewer';
import { api } from '../lib/api';
import { loadPlayerName, savePlayerName } from '../lib/storage';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'beach', label: '🏖️ Beach' },
  { value: 'city', label: '🏙️ City Plaza' },
  { value: 'winter', label: '❄️ Winter Market' },
];

const SIZE_OPTIONS: { value: MapSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export function CreateChallenge() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<'form' | 'place' | 'done'>('form');
  const [creatorName, setCreatorName] = useState(loadPlayerName());
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState<Theme>('winter');
  const [mapSize, setMapSize] = useState<MapSize>('medium');
  const [seed, setSeed] = useState(randomSeed());
  const [walter, setWalter] = useState<{ x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<{ id: string; shareUrl: string; resultsUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const settings: MapSettings = useMemo(() => ({ seed, theme, mapSize, difficulty: 'normal' }), [seed, theme, mapSize]);
  const scene = useMemo(() => generateScene(settings), [settings]);

  const walterInstance = walter ? { id: 0, x: walter.x, y: walter.y, scale: walterScale(walter.y, mapSize) } : null;

  const startPlacing = () => {
    if (!creatorName.trim() || !title.trim()) {
      setError('Please enter your name and a challenge title.');
      return;
    }
    setError(null);
    savePlayerName(creatorName.trim());
    setStage('place');
  };

  const confirm = async () => {
    if (!walter) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createChallenge({
        seed,
        theme,
        mapSize,
        difficulty: 'normal',
        walterX: walter.x,
        walterY: walter.y,
        creatorName: creatorName.trim(),
        title: title.trim(),
      });
      setShare(res);
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create challenge');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy failed — select and copy the link manually.');
    }
  };

  // ---- Stage: form --------------------------------------------------------
  if (stage === 'form') {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Back</Link>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-100">Create a Challenge</h1>
        <p className="mt-1 text-slate-400">Design a map, hide Walter, and share the link with friends.</p>

        <div className="card mt-6 space-y-5 p-6">
          <div>
            <label className="label">Your name</label>
            <input className="input" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="e.g. Alex" maxLength={40} />
          </div>
          <div>
            <label className="label">Challenge title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walter's day at the beach" maxLength={80} />
          </div>
          <div>
            <label className="label">Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setTheme(o.value)}
                  className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${theme === o.value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Map size</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setMapSize(o.value)}
                  className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${mapSize === o.value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button onClick={startPlacing} className="btn-primary w-full">Design map & place Walter →</button>
        </div>
      </div>
    );
  }

  // ---- Stage: place -------------------------------------------------------
  if (stage === 'place') {
    return (
      <div className="flex h-[100dvh] flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
          <button onClick={() => setStage('form')} className="btn-ghost px-3 py-2 text-sm">← Settings</button>
          <div className="flex-1 text-sm text-slate-300">
            <span className="font-semibold text-slate-100">Tap the map to place Walter.</span>{' '}
            <span className="text-slate-500">Tap again to reposition. Pan & zoom to find the perfect hiding spot.</span>
          </div>
          <button onClick={() => { setSeed(randomSeed()); setWalter(null); }} className="btn-secondary px-3 py-2 text-sm">🎲 Reroll Map</button>
          <button onClick={confirm} disabled={!walter || submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? 'Creating…' : 'Confirm & Get Link'}
          </button>
        </header>
        {error && <div className="bg-rose-500/15 px-4 py-1.5 text-center text-sm text-rose-300">{error}</div>}
        <div className="flex-1 p-3">
          <SceneViewer
            scene={scene}
            walters={walterInstance ? [walterInstance] : []}
            onSceneClick={(x, y) => setWalter({ x, y })}
            overlay={
              walterInstance && (
                <g transform={`translate(${walterInstance.x} ${walterInstance.y})`}>
                  <circle r={46} fill="none" stroke="#10b981" strokeWidth={4} className="animate-hint-pulse" style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties} />
                </g>
              )
            }
            className="h-full w-full"
          />
        </div>
        {!walter && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-slate-400">
            <span className="rounded-full bg-slate-900/80 px-4 py-2 text-sm">👆 Tap anywhere to hide Walter</span>
          </div>
        )}
      </div>
    );
  }

  // ---- Stage: done --------------------------------------------------------
  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <div className="card p-6 text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-emerald-500/15 p-3 text-3xl">🎉</div>
        <h1 className="text-2xl font-extrabold text-slate-100">Challenge created!</h1>
        <p className="mt-1 text-slate-400">Share this link — anyone can try to beat your hiding spot.</p>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-2">
          <input readOnly value={share?.shareUrl ?? ''} className="flex-1 truncate bg-transparent px-2 text-sm text-slate-200 outline-none" />
          <button onClick={copy} className="btn-primary px-3 py-2 text-sm">{copied ? '✓ Copied' : 'Copy Link'}</button>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button onClick={() => navigate(`/c/${share?.id}`)} className="btn-secondary">Play it yourself</button>
          <button onClick={() => navigate(`/c/${share?.id}/results`)} className="btn-ghost">View leaderboard</button>
          <button onClick={() => navigate('/')} className="btn-ghost">Back to menu</button>
        </div>
      </div>
    </div>
  );
}
