import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderSceneSVG, type Scene, type WalterInstance } from '@walter/shared';

interface View {
  k: number;
  tx: number;
  ty: number;
}

interface Props {
  scene: Scene;
  /** Walters to bake into the static layer (solo / multiplayer rendering). */
  walters?: WalterInstance[];
  /** Opaque SVG markup injected into scene space (challenge Walter fragment). */
  extraSvg?: string;
  /** React SVG overlay drawn in scene coordinates (hints, markers, ripples). */
  overlay?: React.ReactNode;
  onSceneClick?: (x: number, y: number) => void;
  disabled?: boolean;
  className?: string;
}

const MIN_ZOOM = 0.5; // relative to the fitted scale
const MAX_ZOOM = 4;
const CLICK_MOVE_THRESHOLD = 6;

export function SceneViewer({ scene, walters = [], extraSvg = '', overlay, onSceneClick, disabled, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const fitKRef = useRef(1);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Pointer bookkeeping for drag / pinch / click discrimination.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ downX: number; downY: number; moved: number; lastMid?: { x: number; y: number }; lastDist?: number }>({
    downX: 0,
    downY: 0,
    moved: 0,
  });

  const staticSvg = useMemo(
    () => renderSceneSVG(scene, walters) + extraSvg,
    // walters is small; key on its serialized form so identical arrays don't rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, JSON.stringify(walters), extraSvg]
  );

  const computeFit = useCallback((): View => {
    const el = containerRef.current;
    if (!el) return { k: 1, tx: 0, ty: 0 };
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const fitK = Math.min(cw / scene.width, ch / scene.height) * 0.98;
    fitKRef.current = fitK;
    return { k: fitK, tx: (cw - scene.width * fitK) / 2, ty: (ch - scene.height * fitK) / 2 };
  }, [scene.width, scene.height]);

  // Fit on mount, on scene change, and on container resize.
  useEffect(() => {
    setView(computeFit());
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setView((v) => (v.k === 0 ? computeFit() : v)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFit]);

  const clampK = (k: number) => {
    const fit = fitKRef.current;
    return Math.max(fit * MIN_ZOOM, Math.min(fit * MAX_ZOOM, k));
  };

  const zoomAround = useCallback((sx: number, sy: number, factor: number) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      const realFactor = k / v.k;
      return { k, tx: sx - (sx - v.tx) * realFactor, ty: sy - (sy - v.ty) * realFactor };
    });
  }, []);

  // Wheel zoom (centered on cursor). Attached manually for { passive: false }.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  const localPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = localPoint(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    gesture.current = { downX: p.x, downY: p.y, moved: 0 };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = localPoint(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size >= 2) {
      // Pinch zoom + two-finger pan.
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const g = gesture.current;
      if (g.lastDist && g.lastMid) {
        const factor = dist / g.lastDist;
        zoomAround(mid.x, mid.y, factor);
        const dx = mid.x - g.lastMid.x;
        const dy = mid.y - g.lastMid.y;
        setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      }
      g.lastDist = dist;
      g.lastMid = mid;
      g.moved += Math.abs(dist - (g.lastDist ?? dist)) + 10;
      return;
    }

    // Single-pointer drag → pan.
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    gesture.current.moved += Math.hypot(dx, dy);
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      gesture.current.lastDist = undefined;
      gesture.current.lastMid = undefined;
    }

    // A click is a near-stationary single-pointer release.
    if (wasSingle && !disabled && gesture.current.moved < CLICK_MOVE_THRESHOLD && onSceneClick) {
      const p = localPoint(e.clientX, e.clientY);
      const v = viewRef.current;
      onSceneClick((p.x - v.tx) / v.k, (p.y - v.ty) / v.k);
    }
  };

  const resetView = () => setView(computeFit());
  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAround(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 ${className ?? ''}`}
    >
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: disabled ? 'default' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <g dangerouslySetInnerHTML={{ __html: staticSvg }} />
          {overlay && <g>{overlay}</g>}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button onClick={() => zoomBy(1.4)} className="h-9 w-9 rounded-lg bg-slate-800/90 text-lg font-bold text-slate-100 backdrop-blur hover:bg-slate-700" aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.4)} className="h-9 w-9 rounded-lg bg-slate-800/90 text-lg font-bold text-slate-100 backdrop-blur hover:bg-slate-700" aria-label="Zoom out">−</button>
        <button onClick={resetView} className="h-9 w-9 rounded-lg bg-slate-800/90 text-xs font-semibold text-slate-100 backdrop-blur hover:bg-slate-700" aria-label="Reset view">Fit</button>
      </div>
    </div>
  );
}
