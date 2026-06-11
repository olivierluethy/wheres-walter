import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { effectiveTimeMs, type ChallengePublic, type ChallengeResult } from '@walter/shared';
import { Stars } from '../components/Stars';
import { api } from '../lib/api';
import { formatTime } from '../lib/format';

type SortKey = 'time' | 'wrong' | 'hints' | 'stars';

export function ChallengeResults() {
  const { id = '' } = useParams();
  const [challenge, setChallenge] = useState<ChallengePublic | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'time', dir: 1 });

  useEffect(() => {
    api
      .results(id)
      .then((r) => {
        setChallenge(r.challenge);
        setResults(r.results);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  const sorted = useMemo(() => {
    const eff = (r: ChallengeResult) => effectiveTimeMs(r.rawTimeMs, r.wrongClicks, r.hintsUsed);
    const val = (r: ChallengeResult): number =>
      sort.key === 'time' ? eff(r) : sort.key === 'wrong' ? r.wrongClicks : sort.key === 'hints' ? r.hintsUsed : -r.stars;
    return [...results].sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [results, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const Header = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={`cursor-pointer select-none px-3 py-2 font-semibold hover:text-slate-100 ${className ?? ''}`} onClick={() => toggle(k)}>
      {label} {sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  if (status === 'loading') return <Center>Loading leaderboard…</Center>;
  if (status === 'error') return <Center>Couldn't load this leaderboard.</Center>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Menu</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-400">Leaderboard</p>
          <h1 className="text-3xl font-extrabold text-slate-100">{challenge?.title}</h1>
          <p className="mt-1 text-sm capitalize text-slate-400">by {challenge?.creatorName} · {challenge?.theme} · {challenge?.mapSize}</p>
        </div>
        <Link to={`/c/${id}`} className="btn-primary">Play this challenge</Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <span className="text-3xl">🏁</span>
            <p className="text-slate-400">No one has finished yet. Be the first!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <Header k="time" label="Time" />
                  <Header k="wrong" label="Misses" />
                  <Header k="hints" label="Hints" />
                  <Header k="stars" label="Stars" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sorted.map((r, i) => (
                  <tr key={r.playerName} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-bold text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-100">{r.playerName}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-emerald-400">{formatTime(effectiveTimeMs(r.rawTimeMs, r.wrongClicks, r.hintsUsed))}</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.wrongClicks}</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.hintsUsed}</td>
                    <td className="px-3 py-2.5"><Stars value={r.stars} size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center text-slate-300">{children}</div>;
}
