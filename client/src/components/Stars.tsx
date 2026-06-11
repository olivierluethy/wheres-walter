import type { StarRating } from '@walter/shared';

function Star({ filled, delay }: { filled: boolean; delay: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-full w-full ${filled ? 'animate-pop-in' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.77 4.65 1.13 6.56L12 17.6l-5.9 3.1 1.13-6.56L2.46 9.44l6.6-.96L12 2.5z"
        className={filled ? 'fill-amber-400' : 'fill-slate-700'}
        stroke={filled ? '#f59e0b' : '#475569'}
        strokeWidth="0.5"
      />
    </svg>
  );
}

export function Stars({ value, size = 40, className }: { value: StarRating; size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`} aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: size, height: size }}>
          <Star filled={i < value} delay={i * 150} />
        </div>
      ))}
    </div>
  );
}
