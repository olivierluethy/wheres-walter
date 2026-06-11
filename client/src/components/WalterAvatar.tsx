import { characterSvg, WALTER_PARTS } from '@walter/shared';

/** Renders the canonical Walter figure (original character — never Waldo). */
export function WalterAvatar({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-26 -46 52 90" width={size} height={(size * 90) / 52} className={className} aria-label="Walter">
      <g dangerouslySetInnerHTML={{ __html: characterSvg(WALTER_PARTS) }} />
    </svg>
  );
}
