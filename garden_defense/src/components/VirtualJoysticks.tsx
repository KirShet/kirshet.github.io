import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Crosshair, Move, Zap } from 'lucide-react';
import type { Point } from '../game/rover';

interface VirtualJoysticksProps {
  onMove: (vector: Point) => void;
  onAim: (vector: Point | null) => void;
  onFire: (dir?: Point) => void;
  disabled?: boolean;
}

const MAX_RADIUS = 44;

export const VirtualJoysticks = memo(function VirtualJoysticks({
  onMove,
  onAim,
  onFire,
  disabled = false,
}: VirtualJoysticksProps) {
  const [moveKnob, setMoveKnob] = useState<Point>({ x: 0, y: 0 });
  const [aimKnob, setAimKnob] = useState<Point>({ x: 0, y: 0 });
  const [isAiming, setIsAiming] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const fireTimerRef = useRef<number | null>(null);
  const aimVectorRef = useRef<Point | null>(null);
  const downTimeRef = useRef<number>(0);

  // Stop firing timer on unmount or disable
  useEffect(() => {
    return () => {
      if (fireTimerRef.current !== null) {
        window.clearInterval(fireTimerRef.current);
        fireTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setMoveKnob({ x: 0, y: 0 });
      setAimKnob({ x: 0, y: 0 });
      setIsAiming(false);
      onMove({ x: 0, y: 0 });
      onAim(null);
      if (fireTimerRef.current !== null) {
        window.clearInterval(fireTimerRef.current);
        fireTimerRef.current = null;
      }
    }
  }, [disabled, onMove, onAim]);

  // ---------- Left Stick (Movement) ----------
  const handleLeftDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    handleLeftMove(e);
  };

  const handleLeftMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !leftRef.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = leftRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = e.clientX - cx;
    const rawDy = e.clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(MAX_RADIUS, dist);
    const angle = Math.atan2(rawDy, rawDx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setMoveKnob({ x: kx, y: ky });

    const norm = clampedDist / MAX_RADIUS;
    onMove({ x: Math.cos(angle) * norm, y: Math.sin(angle) * norm });
  };

  const handleLeftUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setMoveKnob({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  // ---------- Right Stick (Aim & Shoot) ----------
  const startFiringLoop = (vec: Point) => {
    aimVectorRef.current = vec;
    if (fireTimerRef.current === null) {
      // Immediate shot then repeating
      onFire(vec);
      fireTimerRef.current = window.setInterval(() => {
        if (aimVectorRef.current) {
          onFire(aimVectorRef.current);
        }
      }, 280);
    }
  };

  const stopFiringLoop = () => {
    if (fireTimerRef.current !== null) {
      window.clearInterval(fireTimerRef.current);
      fireTimerRef.current = null;
    }
  };

  const handleRightDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    downTimeRef.current = performance.now();
    setIsAiming(true);
    handleRightMove(e);
  };

  const handleRightMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !rightRef.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = rightRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = e.clientX - cx;
    const rawDy = e.clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(MAX_RADIUS, dist);
    const angle = Math.atan2(rawDy, rawDx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setAimKnob({ x: kx, y: ky });

    if (dist > 14) {
      const vec = { x: Math.cos(angle), y: Math.sin(angle) };
      onAim(vec);
      startFiringLoop(vec);
    } else {
      onAim(null);
      stopFiringLoop();
    }
  };

  const handleRightUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const duration = performance.now() - downTimeRef.current;
    stopFiringLoop();

    // Quick tap = immediate shot in current aim direction or straight up
    if (e.type === 'pointerup' && !disabled && duration < 280 && !aimVectorRef.current) {
      onFire();
    }

    setAimKnob({ x: 0, y: 0 });
    setIsAiming(false);
    aimVectorRef.current = null;
    onAim(null);
  };

  return (
    <div className="virtual-joysticks-container absolute inset-0 pointer-events-none z-50">
      {/* Keyboard guide hint */}
      <div className="keyboard-pilot-hint pointer-events-none">
        <span className="key-badge">W</span> тяга вперёд &middot; <span className="key-badge">&uarr;&darr;&larr;&rarr; / пробел</span> огонь
      </div>

      {/* Left Joystick: Movement */}
      <div
        ref={leftRef}
        data-testid="joystick-move"
        className="joystick-base joystick-left pointer-events-auto"
        onPointerDown={handleLeftDown}
        onPointerMove={handleLeftMove}
        onPointerUp={handleLeftUp}
        onPointerCancel={handleLeftUp}
      >
        <div className="joystick-ring">
          <div className="joystick-crosshairs">
            <span className="arrow-indicator arrow-up">&uarr;</span>
            <span className="arrow-indicator arrow-right">&rarr;</span>
            <span className="arrow-indicator arrow-down">&darr;</span>
            <span className="arrow-indicator arrow-left">&larr;</span>
          </div>
          <div
            className="joystick-knob knob-move"
            style={{ transform: `translate(${moveKnob.x}px, ${moveKnob.y}px)` }}
          >
            <Move size={22} className="text-[#203c20]" strokeWidth={2.4} />
          </div>
        </div>
        <div className="joystick-label">ДВИЖЕНИЕ</div>
      </div>

      {/* Right Joystick: Aim & Shoot */}
      <div
        ref={rightRef}
        data-testid="joystick-aim"
        className="joystick-base joystick-right pointer-events-auto"
        onPointerDown={handleRightDown}
        onPointerMove={handleRightMove}
        onPointerUp={handleRightUp}
        onPointerCancel={handleRightUp}
      >
        {/* Quick Tap Fire Button directly above right stick */}
        <button
          type="button"
          data-testid="quick-fire-btn"
          className="quick-fire-button pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerCancel={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onFire();
          }}
          title="Выстрел из пушки"
        >
          <Zap size={18} fill="#ffdd6b" className="text-[#ffdd6b]" />
          <span>ОГОНЬ</span>
        </button>

        <div className={`joystick-ring ring-aim ${isAiming ? 'aiming-active' : ''}`}>
          <div className="joystick-crosshairs crosshair-ticks">
            <span className="tick-mark tick-n" />
            <span className="tick-mark tick-e" />
            <span className="tick-mark tick-s" />
            <span className="tick-mark tick-w" />
          </div>
          <div
            className="joystick-knob knob-aim"
            style={{ transform: `translate(${aimKnob.x}px, ${aimKnob.y}px)` }}
          >
            <Crosshair size={24} className="text-[#452810]" strokeWidth={2.4} />
          </div>
        </div>
        <div className="joystick-label label-aim">ПРИЦЕЛ И ОГОНЬ</div>
      </div>
    </div>
  );
});
