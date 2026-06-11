import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  effectiveTimeMs,
  generateScene,
  type ChallengePublic,
  type ChallengeResult,
  type MapSettings,
} from '@walter/shared';
import { HuntGame, type WinInfo } from '../components/HuntGame';
import { ResultCard } from '../components/ResultCard';
import { Stars } from '../components/Stars';
import { api } from '../lib/api';
import { formatTime } from '../lib/format';
import { loadPlayerName, savePlayerName } from '../lib/storage';

type Stage = 'loading' | 'notfound' | 'name' | 'playing' | 'won';

export function PlayChallenge() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('loading');
  const [challenge, setChallenge] = useState<ChallengePublic | null>(null);
  const [name, setName] = useState(loadPlayerName());
  const [error, setError] = useState<string | null>(null);
  const [playToken, setPlayToken] = useState('');
  const [walterSvg, setWalterSvg] = useState('');
  const [win, setWin] = useState<{ result: ChallengeResult } | null>(null);
  const [board, setBoard] = useState<ChallengeResult[]>([]);

  useEffect(() => {
    api
      .getChallenge(id)
      .then((c) => {
        setChallenge(c);
        setStage('name');
      })
      .catch(() => setStage('notfound'));
  }, [id]);

  const settings: MapSettings | null = useMemo(
    () => (challenge ? { seed: challenge.seed, theme: challenge.theme, mapSize: challenge.mapSize, difficulty: challenge.difficulty } : null),
    [challenge]
  );
  const scene = useMemo(() => (settings ? generateScene(settings) : null), [settings]);

  const begin = async () => {
    if (!name.trim()) {
      setError('Enter a name to play.');
      return;
    }
    setError(null);
    savePlayerName(name.trim());
    try {
      const [{ playToken }, svg] = await Promise.all([api.startAttempt(id, name.trim()), api.getWalterSvg(id)]);
      setPlayToken(playToken);
      setWalterSvg(svg);
      setStage('playing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start');
    }
  };

  const validateClick = (x: number, y: number) => api.click(id, playToken, x, y);
  const requestHint = async (level: number) => (await api.hint(id, playToken, level)).circle;

  const onWin = (info: WinInfo) => {
    if (!info.serverResult) return;
    setWin({ result: info.serverResult });
    setStage('won');
    api.results(id).then((r) => setBoard(r.results)).catch(() => undefined);
  };

  // ---- render -------------------------------------------------------------
  if (stage === 'loading') {
    return <Centered>Loading challenge…</Centered>;
  }
  if (stage === 'notfound') {
    return (
      <Centered>
        <div className="text-center">
          <div className="text-4xl">🤷</div>
          <h1 className="mt-3 text-xl font-bold text-slate-100">Challenge not found</h1>
          <p className="mt-1 text-slate-400">This link may be wrong or expired.</p>
          <Link to="/" className="btn-primary mt-5 inline-flex">Back to menu</Link>
        </div>
      </Centered>
    );
  }

  if (stage === 'name' && challenge) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <div className="card p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-400">Challenge by {challenge.creatorName}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-100">{challenge.title}</h1>
          <p className="mt-2 text-sm capitalize text-slate-400">{challenge.theme} · {challenge.mapSize} map</p>

          <div className="mt-6">
            <label className="label">Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && begin()} />
          </div>
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
          <button onClick={begin} className="btn-primary mt-4 w-full">Start Hunt</button>
          <Link to={`/c/${id}/results`} className="btn-ghost mt-2 w-full">View leaderboard</Link>
        </div>
      </div>
    );
  }

  if ((stage === 'playing' || stage === 'won') && scene && challenge) {
    const result = win?.result;
    const effective = result ? effectiveTimeMs(result.rawTimeMs, result.wrongClicks, result.hintsUsed) : 0;
    return (
      <div className="relative">
        <HuntGame
          scene={scene}
          extraSvg={walterSvg}
          title={challenge.title}
          subtitle={`by ${challenge.creatorName}`}
          validateClick={validateClick}
          requestHint={requestHint}
          onWin={onWin}
          onExit={() => navigate('/')}
          frozen={stage === 'won'}
        />
        {result && (
          <ResultCard
            stars={result.stars}
            effectiveMs={effective}
            rawMs={result.rawTimeMs}
            hintsUsed={result.hintsUsed}
            wrongClicks={result.wrongClicks}
          >
            {board.length > 0 && (
              <div className="mt-5 text-left">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Leaderboard</h3>
                <ol className="max-h-40 divide-y divide-slate-800 overflow-y-auto rounded-xl border border-slate-800">
                  {board.slice(0, 8).map((r, i) => (
                    <li key={r.playerName} className={`flex items-center gap-2 px-3 py-2 text-sm ${r.playerName === result.playerName ? 'bg-emerald-500/10' : ''}`}>
                      <span className="w-5 text-center text-slate-500">{i + 1}</span>
                      <span className="flex-1 truncate text-slate-200">{r.playerName}</span>
                      <Stars value={r.stars} size={13} />
                      <span className="font-mono tabular-nums text-emerald-400">{formatTime(effectiveTimeMs(r.rawTimeMs, r.wrongClicks, r.hintsUsed))}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => navigate('/')} className="btn-secondary flex-1">Menu</button>
              <button onClick={() => navigate(`/c/${id}/results`)} className="btn-primary flex-1">Full Leaderboard</button>
            </div>
          </ResultCard>
        )}
      </div>
    );
  }

  return <Centered>Loading…</Centered>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center px-5 text-slate-300">{children}</div>;
}
