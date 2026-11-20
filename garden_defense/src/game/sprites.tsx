// ============================================================
// SVG-спрайты: растения, зомби, косилки, солнце, эффекты.
// Вся графика нарисована кодом специально для этого проекта.
// В вертикальной арене зомби и растения показаны «спереди»,
// косилки — сверху.
// ============================================================

import type { PlantType, ZombieType } from './constants';
import { cn } from '../utils/cn';

// ---------- ПОДСОЛНУХ ----------

function SunflowerSprite() {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 100 116" className="h-full w-full overflow-visible">
      <path d="M50 112 C 48 92, 52 78, 50 58" stroke="#3f9b3f" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path className="anim-leaf-l" d="M48 96 C 30 96, 22 86, 18 78 C 32 78, 44 84, 49 92 Z" fill="#49b24a" />
      <path className="anim-leaf-r" d="M52 100 C 70 100, 78 90, 82 82 C 68 82, 56 88, 51 96 Z" fill="#3f9b3f" />
      <g className="anim-sway" style={{ transformOrigin: '50px 58px' }}>
        {petals.map((a) => (
          <ellipse
            key={a}
            cx="50"
            cy="16"
            rx="8"
            ry="15"
            fill="#ffc93c"
            stroke="#e8a010"
            strokeWidth="1.5"
            transform={`rotate(${a} 50 38)`}
          />
        ))}
        <circle cx="50" cy="38" r="19" fill="#a06a2c" />
        <circle cx="50" cy="38" r="16.5" fill="#b87c38" />
        {[
          [44, 32], [56, 32], [50, 38], [42, 42], [58, 42], [47, 47], [55, 47],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#8a5a24" />
        ))}
        <circle cx="43.5" cy="35" r="2.4" fill="#3a2410" />
        <circle cx="56.5" cy="35" r="2.4" fill="#3a2410" />
        <circle cx="44.4" cy="34.2" r="0.8" fill="#fff" />
        <circle cx="57.4" cy="34.2" r="0.8" fill="#fff" />
        <path d="M44 42.5 Q 50 48 56 42.5" stroke="#3a2410" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="38.5" cy="40.5" r="2.6" fill="#e8913d" opacity="0.65" />
        <circle cx="61.5" cy="40.5" r="2.6" fill="#e8913d" opacity="0.65" />
      </g>
    </svg>
  );
}

// ---------- ГОРОХОСТРЕЛ (вид спереди, дуло смотрит вверх) ----------

function PeashooterSprite({ variant }: { variant: 'peashooter' | 'snowpea' | 'repeater' }) {
  const ice = variant === 'snowpea';
  const rep = variant === 'repeater';
  const head = ice ? '#7cc4e8' : '#5cb84f';
  const headDark = ice ? '#57a8d4' : '#43a047';
  const stem = ice ? '#5aa8cf' : '#3f9b3f';
  const leaf = ice ? '#6cb9dd' : '#49b24a';
  const mouth = ice ? '#2f6f96' : '#2e7031';
  const barrels = rep ? [42, 74] : [58];
  return (
    <svg viewBox="0 0 116 116" className="h-full w-full overflow-visible">
      <ellipse cx="58" cy="112" rx="28" ry="5" fill="#000" opacity="0.14" />
      <rect x="54" y="78" width="8" height="34" rx="4" fill={stem} />
      <path className="anim-leaf-l" d="M54 92 C 38 92, 28 84, 24 74 C 38 74, 50 80, 55 88 Z" fill={leaf} />
      <path className="anim-leaf-r" d="M62 98 C 78 98, 88 90, 92 80 C 78 80, 66 86, 61 94 Z" fill={stem} />
      <g className="anim-idle" style={{ transformOrigin: '58px 60px' }}>
        {barrels.map((cx) => (
          <g key={cx}>
            <rect x={cx - 11} y="10" width="22" height="42" rx="10" fill={head} stroke={headDark} strokeWidth="2" />
            <ellipse cx={cx} cy="12" rx="8" ry="4.5" fill={mouth} />
            <path d={`M${cx - 6} 22 L${cx - 6} 34`} stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="58" cy="58" r="26" fill={head} stroke={headDark} strokeWidth="2" />
        <circle cx="48" cy="54" r="4.2" fill="#22301c" />
        <circle cx="68" cy="54" r="4.2" fill="#22301c" />
        <circle cx="49.3" cy="52.6" r="1.3" fill="#fff" />
        <circle cx="69.3" cy="52.6" r="1.3" fill="#fff" />
        <circle cx="40" cy="66" r="3.2" fill="#ff9e8a" opacity="0.5" />
        <circle cx="76" cy="66" r="3.2" fill="#ff9e8a" opacity="0.5" />
        <path d="M50 66 Q58 74 66 66" stroke="#22301c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {ice && (
          <g stroke="#eaf7ff" strokeWidth="2" strokeLinecap="round">
            <path d="M22 40 L 28 46 M28 40 L 22 46" />
            <path d="M90 36 L 96 42 M96 36 L 90 42" />
            <path d="M58 22 L 58 16 M55 19 L 61 19" opacity="0.9" />
          </g>
        )}
      </g>
    </svg>
  );
}

// ---------- ОРЕХ ----------

function WallnutSprite({ ratio }: { ratio: number }) {
  return (
    <svg viewBox="0 0 96 116" className="h-full w-full overflow-visible">
      <ellipse cx="48" cy="108" rx="26" ry="6" fill="#000" opacity="0.14" />
      <g className="anim-nut" style={{ transformOrigin: '48px 108px' }}>
        <ellipse cx="48" cy="64" rx="32" ry="44" fill="#c89454" stroke="#9a6c34" strokeWidth="3" />
        <ellipse cx="48" cy="64" rx="26" ry="37" fill="#d9a764" />
        <path d="M48 22 C 52 30, 52 40, 48 48" stroke="#b8874a" strokeWidth="2.5" fill="none" />
        <circle cx="38" cy="52" r="3.6" fill="#3a2410" />
        <circle cx="58" cy="52" r="3.6" fill="#3a2410" />
        <circle cx="39.2" cy="50.8" r="1.2" fill="#fff" />
        <circle cx="59.2" cy="50.8" r="1.2" fill="#fff" />
        {ratio > 0.66 ? (
          <path d="M40 68 Q 48 74 56 68" stroke="#3a2410" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : ratio > 0.33 ? (
          <path d="M41 70 Q 48 66 55 70" stroke="#3a2410" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : (
          <ellipse cx="48" cy="70" rx="4" ry="5" fill="#3a2410" />
        )}
        {ratio <= 0.66 && (
          <path d="M30 30 L 38 44 L 32 52" stroke="#8a5e2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {ratio <= 0.33 && (
          <>
            <path d="M66 34 L 60 48 L 68 58 L 62 70" stroke="#8a5e2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M36 82 L 44 90" stroke="#8a5e2e" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}

// ---------- ВИШНЯ-БОМБА ----------

function CherrySprite({ arming }: { arming: boolean }) {
  return (
    <svg viewBox="0 0 110 116" className={`h-full w-full overflow-visible ${arming ? 'anim-pulse-fast' : ''}`}>
      <ellipse cx="55" cy="108" rx="30" ry="6" fill="#000" opacity="0.14" />
      <path d="M48 62 C 46 40, 52 24, 62 12" stroke="#3f7a2e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M72 66 C 74 46, 70 28, 62 12" stroke="#4c8f38" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M62 12 C 60 8, 62 5, 66 4" stroke="#8a5a24" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {arming && <circle cx="66" cy="4" r="4.5" fill="#ffd54a" className="anim-spark" />}
      <g className={arming ? '' : 'anim-idle'} style={{ transformOrigin: '40px 84px' }}>
        <circle cx="40" cy="84" r="23" fill="#d42a2a" stroke="#a01818" strokeWidth="2.5" />
        <ellipse cx="33" cy="76" rx="7" ry="5" fill="#f06464" opacity="0.85" />
        <circle cx="33" cy="84" r="3" fill="#3a1010" />
        <circle cx="47" cy="84" r="3" fill="#3a1010" />
        <path d="M28 77 L 37 80" stroke="#3a1010" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M52 77 L 43 80" stroke="#3a1010" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M34 93 Q 40 90 46 93" stroke="#3a1010" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <g className={arming ? '' : 'anim-idle'} style={{ transformOrigin: '76px 90px', animationDelay: '-0.6s' }}>
        <circle cx="76" cy="90" r="19" fill="#e03a3a" stroke="#a01818" strokeWidth="2.5" />
        <ellipse cx="70" cy="83" rx="6" ry="4" fill="#f57878" opacity="0.85" />
        <circle cx="71" cy="90" r="2.6" fill="#3a1010" />
        <circle cx="82" cy="90" r="2.6" fill="#3a1010" />
        <path d="M70 99 Q 76 96 82 99" stroke="#3a1010" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---------- РАСТЕНИЕ (обёртка) ----------

export function PlantSprite({
  type,
  hpRatio = 1,
  arming = false,
  mini = false,
}: {
  type: PlantType;
  hpRatio?: number;
  arming?: boolean;
  mini?: boolean;
}) {
  const body = (() => {
    switch (type) {
      case 'sunflower':
        return <SunflowerSprite />;
      case 'peashooter':
      case 'snowpea':
      case 'repeater':
        return <PeashooterSprite variant={type} />;
      case 'wallnut':
        return <WallnutSprite ratio={hpRatio} />;
      case 'cherrybomb':
        return <CherrySprite arming={arming} />;
    }
  })();
  return <div className={`h-full w-full ${mini ? '' : 'drop-shadow-[0_3px_2px_rgba(0,0,0,0.25)]'}`}>{body}</div>;
}

// ---------- ЗОМБИ (вид спереди: идёт на игрока) ----------

export function ZombieSprite({
  type,
  eating,
  dying,
  slowed,
}: {
  type: ZombieType;
  eating: boolean;
  dying: boolean;
  slowed: boolean;
}) {
  const skin = '#9fbf8a';
  const skinDark = '#7fa06a';
  const walking = !eating && !dying;
  return (
    <svg
      viewBox="0 -24 120 174"
      className={cn('h-full w-full overflow-visible', dying && 'anim-zfall')}
      style={slowed ? { filter: 'saturate(0.75) hue-rotate(160deg) brightness(1.08)' } : undefined}
    >
      <ellipse cx="60" cy="148" rx="34" ry="7" fill="#000" opacity="0.18" />
      <g className={walking ? 'anim-zbob' : undefined}>
        {/* ноги */}
        <g className={walking ? 'anim-step-a' : undefined}>
          <rect x="40" y="98" width="16" height="42" rx="6" fill="#4a3b2c" />
          <ellipse cx="46" cy="143" rx="10" ry="5.5" fill="#2e241b" />
        </g>
        <g className={walking ? 'anim-step-b' : undefined}>
          <rect x="64" y="98" width="16" height="42" rx="6" fill="#3f3224" />
          <ellipse cx="74" cy="143" rx="10" ry="5.5" fill="#2e241b" />
        </g>
        {/* руки (тянутся вперёд, к игроку) */}
        <g
          className={eating ? 'anim-arm-eat-l' : walking ? 'anim-arm-l' : undefined}
          style={{ transformOrigin: '36px 62px' }}
        >
          <path d="M36 62 Q18 80 22 104" stroke="#6b5236" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="22" cy="108" r="8" fill={skin} stroke={skinDark} strokeWidth="1.6" />
        </g>
        <g
          className={eating ? 'anim-arm-eat-r' : walking ? 'anim-arm-r' : undefined}
          style={{ transformOrigin: '84px 62px' }}
        >
          <path d="M84 62 Q102 80 98 104" stroke="#6b5236" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="98" cy="108" r="8" fill={skin} stroke={skinDark} strokeWidth="1.6" />
        </g>
        {/* торс (пиджак) */}
        <path d="M38 54 Q60 46 82 54 L86 104 Q60 110 34 104 Z" fill="#6b5236" stroke="#4d3b26" strokeWidth="2" strokeLinejoin="round" />
        <path d="M50 54 L60 74 L70 54 Z" fill="#d8d3c3" />
        <path d="M57 64 L63 64 L62 92 L58 92 Z" fill="#a03030" />
        <rect x="34" y="98" width="52" height="7" rx="2" fill="#2e241b" />
        <rect x="56" y="98" width="8" height="7" fill="#b89a45" />
        <circle cx="44" cy="80" r="3" fill="#4d3b26" />
        <circle cx="76" cy="90" r="2.4" fill="#4d3b26" />
        <path d="M70 62 l5 3 l-2 6" stroke="#4d3b26" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* голова */}
        <g className={eating ? 'anim-chomp' : undefined} style={{ transformOrigin: '60px 60px' }}>
          <rect x="52" y="46" width="16" height="12" fill={skinDark} />
          <circle cx="60" cy="34" r="24" fill={skin} stroke={skinDark} strokeWidth="2" />
          <path d="M38 28 Q40 8 60 10 Q80 8 82 28 Q76 18 60 19 Q44 18 38 28 Z" fill="#4c3b2a" />
          {/* глазницы и глаза */}
          <ellipse cx="50" cy="35" rx="7" ry="6" fill="#5b7a44" opacity="0.6" />
          <ellipse cx="70" cy="35" rx="7" ry="6" fill="#5b7a44" opacity="0.6" />
          <circle cx="50" cy="35" r="4.4" fill="#f5f2e4" />
          <circle cx="70" cy="35" r="4.4" fill="#f5f2e4" />
          <circle cx="51" cy="36" r="2" fill="#2c2418" />
          <circle cx="71" cy="36" r="2" fill="#2c2418" />
          {/* брови */}
          <path d="M42 27 L56 30" stroke="#3d2e1e" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M78 27 L64 30" stroke="#3d2e1e" strokeWidth="2.4" strokeLinecap="round" />
          {/* нос и рана */}
          <path d="M59 41 L61 45 L59 46" stroke="#5f7a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="75" cy="22" r="3" fill="#7a3a3a" opacity="0.6" />
          {/* рот с зубами */}
          <g className={eating ? 'anim-jaw' : undefined} style={{ transformOrigin: '60px 48px' }}>
            <path d="M48 47 Q60 46 72 47 Q67 58 60 58 Q53 58 48 47 Z" fill="#4a1818" />
            <path d="M50 47 L52 53 L54 47 M57 47 L59 54 L61 47 M64 47 L66 53 L68 47" fill="#f5f0dc" />
          </g>
          {type === 'cone' && (
            <g>
              <path d="M38 22 L60 -18 L82 22 Z" fill="#e8842c" stroke="#c66a1a" strokeWidth="2" strokeLinejoin="round" />
              <path d="M46 6 L74 6" stroke="#fff5e0" strokeWidth="4" />
              <path d="M42 14 L78 14" stroke="#fff5e0" strokeWidth="4" />
              <rect x="34" y="18" width="52" height="5" rx="2.5" fill="#c66a1a" />
            </g>
          )}
          {type === 'bucket' && (
            <g>
              <path d="M32 26 L36 -10 L84 -10 L88 26 Z" fill="#9aa4ad" stroke="#6e7880" strokeWidth="2" strokeLinejoin="round" />
              <path d="M36 4 L84 4" stroke="#6e7880" strokeWidth="2" />
              <path d="M40 16 L80 16" stroke="#c9d1d8" strokeWidth="2" opacity="0.6" />
              <ellipse cx="60" cy="-10" rx="26" ry="5" fill="#b9c3cb" stroke="#6e7880" strokeWidth="2" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

// ---------- ГАЗОНОКОСИЛКА (вид сверху, едет вверх) ----------

export function MowerSprite({ running }: { running: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-full w-full overflow-visible ${running ? 'anim-mower' : ''}`}>
      {/* ручка сзади (внизу) */}
      <path d="M30 78 L 22 94 L 78 94 L 70 78" fill="none" stroke="#7a4a22" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* колёса */}
      <rect x="4" y="14" width="12" height="22" rx="5" fill="#2b2b2b" />
      <rect x="84" y="14" width="12" height="22" rx="5" fill="#2b2b2b" />
      <rect x="4" y="58" width="12" height="22" rx="5" fill="#2b2b2b" />
      <rect x="84" y="58" width="12" height="22" rx="5" fill="#2b2b2b" />
      {/* корпус */}
      <rect x="18" y="8" width="64" height="70" rx="12" fill="#d43a2a" stroke="#a02418" strokeWidth="2.5" />
      {/* решётка спереди */}
      <rect x="30" y="8" width="40" height="8" rx="3" fill="#333" />
      {/* капот и мотор */}
      <rect x="28" y="22" width="44" height="40" rx="10" fill="#e8573f" stroke="#a02418" strokeWidth="2" />
      <circle cx="50" cy="42" r="12" fill="#555" stroke="#333" strokeWidth="2" />
      <circle cx="50" cy="42" r="5" fill="#999" />
    </svg>
  );
}

// ---------- СОЛНЦЕ ----------

export function SunSprite({ size = 76 }: { size?: number }) {
  const rays = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className="overflow-visible">
      <g className="anim-rays" style={{ transformOrigin: '40px 40px' }}>
        {rays.map((a) => (
          <path key={a} d="M40 4 L 44 18 L 36 18 Z" fill="#ffd54a" transform={`rotate(${a} 40 40)`} />
        ))}
      </g>
      <circle cx="40" cy="40" r="21" fill="#ffdf6b" stroke="#f0b429" strokeWidth="3" />
      <circle cx="40" cy="40" r="14" fill="#ffe98f" />
      <circle cx="35" cy="37" r="2.2" fill="#c78a12" />
      <circle cx="45" cy="37" r="2.2" fill="#c78a12" />
      <path d="M35 43 Q40 47 45 43" stroke="#c78a12" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---------- ГОРОШИНА ----------

export function PeaSprite({ ice }: { ice: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" className="overflow-visible">
      <circle cx="10" cy="10" r="8" fill={ice ? '#8fd4f0' : '#67c24f'} stroke={ice ? '#57a8d4' : '#43a047'} strokeWidth="2" />
      <circle cx="7" cy="7" r="2.4" fill="#ffffff" opacity="0.75" />
      {ice && <path d="M10 2 L 10 18 M4 6 L 16 14 M16 6 L 4 14" stroke="#eaf7ff" strokeWidth="1.4" opacity="0.9" />}
    </svg>
  );
}

// ---------- ЭФФЕКТЫ ----------

export function FxSprite({ kind, t, ttl }: { kind: string; t: number; ttl: number }) {
  const p = Math.min(1, t / ttl);
  if (kind === 'boom') {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
        <g style={{ transform: `scale(${0.4 + p * 1.1})`, transformOrigin: '120px 120px' }}>
          {Array.from({ length: 12 }, (_, i) => i * 30).map((a) => (
            <path key={a} d="M120 8 L 134 76 L 106 76 Z" fill="#ff9a2c" transform={`rotate(${a} 120 120)`} />
          ))}
          <circle cx="120" cy="120" r="64" fill="#ffcf3f" />
          <circle cx="120" cy="120" r="40" fill="#fff3c4" />
        </g>
        <circle cx="120" cy="120" r={30 + p * 95} fill="none" stroke="#fff" strokeWidth={8 * (1 - p)} opacity={0.8 * (1 - p)} />
      </svg>
    );
  }
  if (kind === 'leaf') {
    const sway = Math.sin(p * Math.PI * 2.4) * (10 + p * 18);
    return (
      <svg viewBox="0 0 60 60" className="h-full w-full overflow-visible" style={{ opacity: 1 - p * .75 }}>
        <g style={{ transform: `translate(${30 + sway}px ${30 - p * 34}px) rotate(${p * 250}deg) scale(${.7 + p * .45})`, transformOrigin: '0 0' }}>
          <path d="M-13 1-8-2-10-9-4-7-2-14 2-8 8-10 7-4 14-2 11 3 4 5 1 11-4 4Z" fill="#d8813a" stroke="#7e3429" strokeWidth="1.6" />
          <path d="M-2 12 2 3 5-4" fill="none" stroke="#f2ad55" strokeWidth="1.8" />
        </g>
      </svg>
    );
  }
  if (kind === 'dust') {
    return (
      <svg viewBox="0 0 80 80" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
        <g style={{ transform: `scale(${.5 + p * .9})`, transformOrigin: '40px 40px' }}>
          <circle cx="27" cy="45" r="13" fill="#d8e6ef" />
          <circle cx="45" cy="34" r="16" fill="#eef6fb" />
          <circle cx="55" cy="50" r="11" fill="#c7d6df" />
        </g>
      </svg>
    );
  }
  if (kind === 'spark') {
    return (
      <svg viewBox="0 0 40 40" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
        <g style={{ transform: `scale(${0.4 + p * 1.2})`, transformOrigin: '20px 20px' }}>
          <line x1="20" y1="6" x2="20" y2="34" stroke="#22d3ee" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="6" y1="20" x2="34" y2="20" stroke="#67e8f9" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="20" cy="20" r="4.5" fill="#ffffff" />
        </g>
      </svg>
    );
  }
  if (kind === 'laserhit') {
    return (
      <svg viewBox="0 0 60 60" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
        <circle cx="30" cy="30" r={10 + p * 20} fill="none" stroke="#22d3ee" strokeWidth={3 * (1 - p)} />
        <circle cx="30" cy="30" r={4 + p * 10} fill="#a5f3fc" />
      </svg>
    );
  }
  if (kind === 'splat' || kind === 'icesplat') {
    const c1 = kind === 'icesplat' ? '#8fd4f0' : '#67c24f';
    const c2 = kind === 'icesplat' ? '#57a8d4' : '#43a047';
    return (
      <svg viewBox="0 0 60 60" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
        <g style={{ transform: `scale(${0.5 + p})`, transformOrigin: '30px 30px' }}>
          {Array.from({ length: 7 }, (_, i) => i * (360 / 7)).map((a) => (
            <ellipse key={a} cx="30" cy="12" rx="5" ry="10" fill={c1} stroke={c2} strokeWidth="1.5" transform={`rotate(${a} 30 30)`} />
          ))}
          <circle cx="30" cy="30" r="8" fill={c1} />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full overflow-visible" style={{ opacity: 1 - p }}>
      <g style={{ transform: `scale(${0.6 + p * 0.9})`, transformOrigin: '40px 40px' }}>
        <circle cx="26" cy="44" r="14" fill="#e8e2d2" />
        <circle cx="44" cy="30" r="16" fill="#f2ecdc" />
        <circle cx="54" cy="48" r="12" fill="#e8e2d2" />
      </g>
    </svg>
  );
}
