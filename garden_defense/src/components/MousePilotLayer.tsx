import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MousePointer2, Zap } from 'lucide-react';
import { STAGE_H, STAGE_W } from '../game/constants';
import type { Point } from '../game/rover';

interface MousePilotLayerProps {
  onThrust: (point: Point | null) => void;
  onFire: (point: Point) => void;
  disabled?: boolean;
}

/**
 * Mouse pilot overlay:
 * LMB (hold) — thrust toward the cursor
 * RMB — fire the laser toward the cursor
 */
export function MousePilotLayer({ onThrust, onFire, disabled = false }: MousePilotLayerProps) {
  const [thrusting, setThrusting] = useState(false);
  const releaseRef = useRef(onThrust);
  releaseRef.current = onThrust;
  useEffect(() => () => releaseRef.current(null), []);

  const pointFromEvent = (e: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * STAGE_W / Math.max(1, rect.width),
      y: (e.clientY - rect.top) * STAGE_H / Math.max(1, rect.height),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const point = pointFromEvent(e);
    if (e.pointerType === 'touch' && e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      onFire(point);
      return;
    }
    if (e.button === 0) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setThrusting(true);
      onThrust(point);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const point = pointFromEvent(e);
    if (thrusting && (e.buttons & 1) === 1) onThrust(point);
  };

  const stopThrust = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 0 || e.type === 'pointercancel') {
      setThrusting(false);
      onThrust(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released
    }
  };

  return (
    <div
      className="mouse-pilot-layer"
      data-testid="mouse-pilot-layer"
      onPointerDown={handlePointerDown}
      onMouseDown={(e) => {
        if (disabled || e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onFire({ x: (e.clientX - rect.left) * STAGE_W / rect.width, y: (e.clientY - rect.top) * STAGE_H / rect.height });
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={stopThrust}
      onPointerCancel={stopThrust}
      onLostPointerCapture={() => { setThrusting(false); onThrust(null); }}
      onPointerLeave={() => { if (thrusting) { setThrusting(false); onThrust(null); } }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Управление мышью: W или левая кнопка - тяга, правая - выстрел"
    >
      <div className="mouse-pilot-hint">
        <span><MousePointer2 size={16} /> W / ЛКМ: тяга к курсору</span>
        <span><Zap size={16} /> ПКМ: выстрел лазером</span>
      </div>

    </div>
  );
}
