import { useEffect, useState } from 'react';

/** Full-screen 3-2-1 countdown overlay; calls onDone when it reaches 0. */
export function Countdown({ from = 3, onDone }: { from?: number; onDone: () => void }) {
  const [n, setN] = useState(from);

  useEffect(() => {
    if (n <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [n, onDone]);

  if (n <= 0) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div key={n} className="animate-pop-in text-[8rem] font-extrabold leading-none text-emerald-400 drop-shadow-lg">
        {n}
      </div>
    </div>
  );
}
