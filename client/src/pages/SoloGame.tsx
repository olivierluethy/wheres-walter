import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rng,
  THEMES,
  deriveWalterPosition,
  effectiveTimeMs,
  generateHint,
  generateScene,
  hitBoxFor,
  isHit,
  randomSeed,
  starsFor,
  type MapSettings,
  type StarRating,
  type Theme,
} from '@walter/shared';
import { HuntGame, type WinInfo } from '../components/HuntGame';
import { ResultCard } from '../components/ResultCard';
import { recordBestTime } from '../lib/storage';

function freshSettings(): MapSettings {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)] as Theme;
  return { seed: randomSeed(), theme, mapSize: 'medium', difficulty: 'normal', decoyTrickiness: 0.5 };
}

export function SoloGame() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<MapSettings>(freshSettings);
  const [win, setWin] = useState<{ stars: StarRating; effectiveMs: number } & WinInfo | null>(null);

  // Scene + Walter are fully determined by the current settings.
  const scene = useMemo(() => generateScene(settings), [settings]);
  const walter = useMemo(() => deriveWalterPosition(settings), [settings]);

  const validateClick = (x: number, y: number) => {
    const box = hitBoxFor(walter.x, walter.y, walter.scale);
    return Promise.resolve({ hit: isHit(x, y, box) });
  };

  const requestHint = (level: number) => {
    // Fresh RNG per hint so the circle's offset varies between uses.
    const rng = new Rng(`${settings.seed}|hint|${level}|${Math.random()}`);
    return Promise.resolve(generateHint(walter, settings.mapSize, level, rng));
  };

  const onWin = (info: WinInfo) => {
    const stars = starsFor(info.rawMs, info.wrongClicks, info.hintsUsed);
    const effectiveMs = effectiveTimeMs(info.rawMs, info.wrongClicks, info.hintsUsed);
    setWin({ ...info, stars, effectiveMs });
    recordBestTime({
      effectiveMs,
      rawMs: info.rawMs,
      stars,
      hintsUsed: info.hintsUsed,
      wrongClicks: info.wrongClicks,
      theme: settings.theme,
      at: Date.now(),
    });
  };

  const playAgain = () => {
    setWin(null);
    setSettings(freshSettings());
  };

  return (
    <div className="relative">
      <HuntGame
        key={settings.seed}
        scene={scene}
        walters={[walter]}
        title="Solo Hunt"
        subtitle={`${settings.theme} · fresh map`}
        validateClick={validateClick}
        requestHint={requestHint}
        onWin={onWin}
        onExit={() => navigate('/')}
        frozen={!!win}
      />

      {win && (
        <ResultCard
          stars={win.stars}
          effectiveMs={win.effectiveMs}
          rawMs={win.rawMs}
          hintsUsed={win.hintsUsed}
          wrongClicks={win.wrongClicks}
        >
          <div className="mt-6 flex gap-3">
            <button onClick={() => navigate('/')} className="btn-secondary flex-1">
              Back to Menu
            </button>
            <button onClick={playAgain} className="btn-primary flex-1">
              Play Again
            </button>
          </div>
        </ResultCard>
      )}
    </div>
  );
}
