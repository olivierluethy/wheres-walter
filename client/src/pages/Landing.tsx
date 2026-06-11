import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalterAvatar } from '../components/WalterAvatar';
import { Stars } from '../components/Stars';
import { loadBestTimes, type BestTime } from '../lib/storage';
import { formatTime } from '../lib/format';

export function Landing() {
  const navigate = useNavigate();
  const [bests, setBests] = useState<BestTime[]>([]);

  useEffect(() => {
    setBests(loadBestTimes());
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-12 sm:py-20">
        <div className="animate-fade-in flex flex-col items-center text-center">
          <div className="mb-4 rounded-3xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <WalterAvatar size={88} />
          </div>
          <h1 className="bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Where's Walter?
          </h1>
          <p className="mt-3 max-w-md text-balance text-slate-400">
            Green beanie, orange-striped scarf, yellow jacket, brown round glasses. He's hiding in the crowd — can you spot him?
          </p>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            <button onClick={() => navigate('/play')} className="btn-primary py-4 text-lg">
              Find Walter!
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/create')} className="btn-secondary">
                Create Challenge
              </button>
              <button onClick={() => navigate('/multiplayer')} className="btn-secondary">
                Multiplayer
              </button>
            </div>
          </div>
        </div>

        {/* Best times */}
        <div className="mt-12 w-full max-w-xl">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Your Best Times</h2>
              <span className="text-xs text-slate-500">Top 10 · this device</span>
            </div>
            {bests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center">
                <span className="text-3xl">🔍</span>
                <p className="text-sm text-slate-400">No runs yet. Play a game to set your first record!</p>
              </div>
            ) : (
              <ol className="divide-y divide-slate-800">
                {bests.map((b, i) => (
                  <li key={b.at} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 text-center text-sm font-bold text-slate-500">{i + 1}</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-emerald-400">{formatTime(b.effectiveMs)}</span>
                    <Stars value={b.stars} size={16} />
                    <span className="ml-auto text-xs capitalize text-slate-500">
                      {b.theme} · {b.hintsUsed} hints · {b.wrongClicks} misses
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <p className="mt-10 max-w-lg text-center text-xs text-slate-600">
          Walter is an original character with all-original procedurally generated artwork.
        </p>
      </div>
    </div>
  );
}
