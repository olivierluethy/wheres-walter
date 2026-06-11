import { useEffect, useRef, useState } from 'react';

/**
 * A running stopwatch that ticks ~every 50ms while active. Returns the raw
 * elapsed milliseconds since `start()`; callers layer penalties on top.
 */
export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startRef.current != null) setElapsed(Date.now() - startRef.current);
    }, 50);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    if (startRef.current != null) setElapsed(Date.now() - startRef.current);
  };
  const reset = () => {
    startRef.current = null;
    setElapsed(0);
    setRunning(false);
  };

  return { elapsed, running, start, stop, reset };
}

/** A countdown that ticks toward `endsAt` (epoch ms). Returns remaining ms. */
export function useCountdownTo(endsAt: number | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}
