import { characterSvg, WALTER_PARTS } from '@walter/shared';

/** Renders the canonical Walter figure (original character — never Waldo). */
export function WalterAvatar({ size = 96, className }: { size?: number; className?: string }) {
  // viewBox is widened to fit Walter's raised, waving arm.
  return (
    <svg viewBox="-28 -48 56 94" width={size} height={(size * 94) / 56} className={className} aria-label="Walter">
      <g dangerouslySetInnerHTML={{ __html: characterSvg(WALTER_PARTS) }} />
    </svg>
  );
}
