import type { ReactNode } from 'react';
import type { StarRating } from '@walter/shared';
import { Stars } from './Stars';
import { Confetti } from './Confetti';
import { WalterAvatar } from './WalterAvatar';
import { formatTime } from '../lib/format';

interface Props {
  stars: StarRating;
  effectiveMs: number;
  rawMs: number;
  hintsUsed: number;
  wrongClicks: number;
  heading?: string;
  children?: ReactNode;
}

export function ResultCard({ stars, effectiveMs, rawMs, hintsUsed, wrongClicks, heading = 'Found him!', children }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <Confetti />
      <div className="card animate-pop-in w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-2 w-fit rounded-2xl bg-slate-800/60 p-2">
          <WalterAvatar size={64} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-100">{heading}</h2>
        <div className="my-4 flex justify-center">
          <Stars value={stars} size={48} />
        </div>

        <div className="mb-2 font-mono text-4xl font-bold tabular-nums text-emerald-400">{formatTime(effectiveMs)}</div>
        <p className="text-sm text-slate-400">
          Raw {formatTime(rawMs)} · {wrongClicks} wrong {wrongClicks === 1 ? 'click' : 'clicks'} · {hintsUsed} {hintsUsed === 1 ? 'hint' : 'hints'}
        </p>

        {children}
      </div>
    </div>
  );
}
