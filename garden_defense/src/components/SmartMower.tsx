import { memo, useId } from 'react';
import { Gauge, Radio, Settings2, ShieldAlert, Sun } from 'lucide-react';
import { BOTTOM_BAR_H, MOD_COPY, PLANT_MAP, STAGE_H, STAGE_W, SUN_VALUE, type Game, type SunDrop } from '../game/constants';
import { COLLECT_TIME, LOAD_TIME, PLANT_TIME, ROVER_HOME, TRANSFER_TIME, cargoMount, clamp01, ease, plantingPoint, roverScale, type SmartMower } from '../game/rover';
import { projectGround } from '../game/perspective';
import { PlantSprite, SunSprite } from '../game/sprites';
import { modCooldown, modName } from '../game/mowerMods';
import { cn } from '../utils/cn';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const RoverSprite = memo(function RoverSprite({
  mileage = 0,
  armed = false,
  flash = 0,
  thrusting = false,
  recoilOffset = 0,
  drifting = false,
}: {
  mileage?: number;
  armed?: boolean;
  flash?: number;
  thrusting?: boolean;
  recoilOffset?: number;
  drifting?: boolean;
}) {
  const id = useId();
  return (
    <svg viewBox="0 -32 120 162" className="rover-sprite overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-paint`} x2=".35" y2="1">
          <stop stopColor={armed ? '#67e8f9' : '#ffe09b'} />
          <stop offset=".28" stopColor={armed ? '#22d3ee' : '#eeb74c'} />
          <stop offset=".68" stopColor={armed ? '#0891b2' : '#d5912e'} />
          <stop offset="1" stopColor={armed ? '#0e7490' : '#b26724'} />
        </linearGradient>
        <linearGradient id={`${id}-steel`} x2=".2" y2="1">
          <stop stopColor="#93a2a0" />
          <stop offset=".3" stopColor="#5c6767" />
          <stop offset="1" stopColor="#2a3539" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x2=".3" y2="1">
          <stop stopColor="#2d5353" />
          <stop offset=".45" stopColor="#112c30" />
          <stop offset="1" stopColor="#172022" />
        </linearGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset=".25" stopColor="#67e8f9" />
          <stop offset=".6" stopColor="#06b6d4" />
          <stop offset="1" stopColor="rgba(6, 182, 212, 0)" />
        </linearGradient>
        <pattern id={`${id}-tread`} patternUnits="userSpaceOnUse" width="16" height="7" patternTransform={`translate(0 ${mileage * .26 % 7})`}>
          <rect width="16" height="7" fill="#293030" />
          <path d="m-3 1 9 2 10-2" fill="none" stroke="#59605b" strokeWidth="2.7" />
          <path d="m-3 4 9 2 10-2" fill="none" stroke="#1a2223" strokeWidth="1.5" />
        </pattern>
      </defs>

      {/* Striker Neon Hull Glow */}
      {armed && (
        <path
          d="M19 23Q19 13 31 12L87 12Q99 13 101 25L104 77Q104 91 91 96L30 96Q16 92 16 79Z"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="6"
          strokeOpacity="0.32"
          className="striker-aura-glow"
        />
      )}

      {/* Rear Thruster Plasma Flames (from Striker ship) */}
      {thrusting && (
        <g className="rover-thruster-flames">
          {/* Left Thruster Jet */}
          <path d="M30 96 L22 126 Q30 134 38 126 Z" fill={`url(#${id}-flame)`} className="thruster-flicker" />
          <path d="M26 96 L22 114 Q30 120 34 114 Z" fill="#ffffff" />
          {/* Right Thruster Jet */}
          <path d="M82 96 L74 126 Q82 134 90 126 Z" fill={`url(#${id}-flame)`} className="thruster-flicker-alt" />
          <path d="M78 96 L74 114 Q82 120 86 114 Z" fill="#ffffff" />
        </g>
      )}

      {/* Main Chassis group with physical recoil offset translation */}
      <g style={{ transform: `translateY(${recoilOffset}px)` }}>
        <g stroke="#282c29" strokeWidth="2.8" strokeLinejoin="round">
          {/* Treads */}
          {[[8, 18], [96, 18], [7, 65], [97, 65]].map(([x, y]) => (
            <g key={`${x}:${y}`}>
              <rect x={x} y={y} width="16" height="28" rx="5" fill={`url(#${id}-tread)`} />
              <path d={`M${x + 2} ${y + 5}v18`} stroke="#98988a" strokeWidth="1.5" />
            </g>
          ))}

          {/* Body Hull */}
          <path d="M19 23Q19 13 31 12L87 12Q99 13 101 25L104 77Q104 91 91 96L30 96Q16 92 16 79Z" fill="#2d373f" />
          <path d="M20 24Q20 15 30 14L88 14Q98 15 99 25L100 73Q101 84 92 89L29 89Q19 84 18 75Z" fill={`url(#${id}-paint)`} />
          <path d="M24 17 34 16 32 76 23 77 21 66Z" fill="#f8e6b1" strokeWidth="1.5" />
          <path d="M89 17 96 21 98 75 90 76Z" fill="#e9d6a5" strokeWidth="1.5" />

          {/* Cargo Platform */}
          <path d="M30 19 89 19 88 46 31 46Z" fill="#7c674a" />
          <path d="M33 22 86 22 84 41 35 41Z" fill="#202c2e" strokeWidth="1.6" />
          <path d="m35 25 47 1m-43 5 40 1m-41 4 46 1" stroke="#8e7751" strokeWidth="1.8" />
          <path d="M28 17 90 17 90 22 30 22ZM29 40 90 40 88 47 31 47Z" fill={`url(#${id}-steel)`} strokeWidth="2" />

          {/* Windshield */}
          <path d="M31 52Q31 48 38 48L81 48Q88 48 89 55L88 74Q86 79 80 79H38Q31 78 30 72Z" fill={`url(#${id}-glass)`} />
          <path d="M35 52Q58 49 84 52" stroke="#98a99b" fill="none" strokeWidth="1.6" />

          {/* Robot Eyes (Mint Cyan) */}
          <g fill={armed ? '#22d3ee' : '#80f6da'} stroke="none">
            <rect x="39" y="56" width="10" height="11" rx="2.5" />
            <rect x="70" y="56" width="10" height="11" rx="2.5" />
            <path d="M50 68Q60 77 69 67Q60 73 50 68Z" />
          </g>

          {/* Rear Bumper */}
          <path d="M20 79 31 83 88 83 99 78 100 89 91 95 28 95 18 89Z" fill={`url(#${id}-steel)`} />
          <path d="M35 87H83" stroke="#bcc0ac" strokeWidth="2" />
          <rect x="19" y="75" width="11" height="6" rx="2" fill="#fff4b0" strokeWidth="1.6" />
          <rect x="90" y="74" width="10" height="6" rx="2" fill="#fff4b0" strokeWidth="1.6" />

          {/* Striker Laser Cannon with Recoil */}
          {armed && (
            <g className="rover-cannon">
              <rect x="50" y="-22" width="17" height="39" rx="6" fill={`url(#${id}-steel)`} />
              <rect x="47" y="-26" width="23" height="9" rx="4" fill="#0891b2" />
              <ellipse cx="58.5" cy="-23" rx="6" ry="3.4" fill="#22d3ee" />
              <path d="M54 -14h9" stroke="#e0f2fe" strokeWidth="2" />
            </g>
          )}

          {/* Laser Muzzle Flash */}
          {armed && flash > 0 && (
            <g className="rover-muzzle-flash" style={{ opacity: flash / .16 }}>
              {Array.from({ length: 8 }, (_, i) => i * 45).map((a) => (
                <path key={a} d="M58 -28 66 -48 50 -48Z" fill="#22d3ee" transform={`rotate(${a} 58 -28)`} />
              ))}
              <circle cx="58" cy="-30" r="14" fill="#ffffff" />
            </g>
          )}

          {/* Antenna */}
          <path d="M96 26 99 7" fill="none" strokeWidth="3" />
          <rect x="95.5" y="2" width="8" height="11" rx="4" fill={armed ? '#22d3ee' : '#91efbd'} stroke="#405e4d" strokeWidth="2" />
          <path d="M97 5h5" stroke="#ebffd5" strokeWidth="2" />

          {/* Rivets */}
          {[[32, 19], [86, 19], [33, 43], [85, 43], [24, 87], [94, 86]].map(([cx, cy]) => (
            <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="1.45" fill="#b2beb2" strokeWidth=".8" />
          ))}
        </g>
      </g>

      {/* Drift tire smoke/sparks when drifting */}
      {drifting && (
        <g className="drift-skid-sparks">
          <circle cx="8" cy="95" r="5" fill="#22d3ee" opacity="0.6" className="anim-spark" />
          <circle cx="102" cy="95" r="5" fill="#22d3ee" opacity="0.6" className="anim-spark" />
        </g>
      )}
    </svg>
  );
});

export function RoverGround({ rover: r }: { rover: SmartMower }) {
  const route = r.route;
  const t = route ? ease(r.age / route.duration) : 0;
  const target = r.order?.cell && plantingPoint(r.order.cell);
  const gold = r.phase === 'to-sun';
  return (
    <svg className="rover-ground" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
      <g transform={`translate(${ROVER_HOME.x} ${ROVER_HOME.y})`}>
        <path d="m-52-24 9-6h86l9 6 4 43-9 9h-94l-9-9Z" fill="#243235" fillOpacity=".87" stroke="#a3ad9d" strokeWidth="2" />
        <path d="M-45-9v-11h13m64 0h13v11m2 17v10H32m-64 0h-15V8" fill="none" stroke="#b1d995" strokeWidth="3" />
        <path d="M-20 23h40" stroke="#85c4a3" strokeWidth="3" strokeLinecap="round" />
      </g>
      {route && r.phase !== 'returning' && (
        <g>
          <path
            d={`M${r.x} ${r.y} Q${mix(route.control.x, route.end.x, t)} ${mix(route.control.y, route.end.y, t)} ${route.end.x} ${route.end.y}`}
            fill="none"
            stroke={gold ? '#ffe291' : '#ecffbf'}
            strokeOpacity=".72"
            strokeWidth="3"
            strokeDasharray="3 11"
            strokeLinecap="round"
          />
          <ellipse cx={route.end.x} cy={route.end.y}
            rx="9" ry="5" fill="none" stroke={gold ? '#ffe6a0' : '#dff9b2'} strokeWidth="2.4" />
        </g>
      )}
      {target && (
        <g transform={`translate(${target.x} ${target.y}) scale(${target.scale})`}>
          <ellipse rx="24" ry="10" fill="#415635" fillOpacity=".33" stroke="#edffb1" strokeWidth="2.5" strokeDasharray="8 4" />
          <path d="M-6 0H6m-6-4v8" stroke="#f3ffcb" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

function statusText(r: SmartMower, auto: boolean) {
  const name = r.order ? PLANT_MAP[r.order.type].name : '';
  if (r.fenceOrder) return 'Еду к выбранной секции забора';
  if (auto) {
    if (r.plantingMark) return 'Клетка отмечена. Ещё один выстрел для посадки';
    if (r.padMark) return 'Поле отмечено (1/2). Ещё один выстрел для выбора';
    if (r.cargo) return `${name} на борту. Дважды попади в бортик`;
    if (r.order) return `Забираю растение: ${name}`;
    return 'Попади в солнце или выбери семена снизу';
  }
  switch (r.phase) {
    case 'at-fence': return 'На месте. Выбери растение или солнышко';
    case 'to-card': return `За растением: ${name}`;
    case 'loading': return `Погрузка: ${name}`;
    case 'carrying': return `${name} на борту. Выберите клетку`;
    case 'to-cell': return `Доставка: ${name}`;
    case 'planting': return `Посадка: ${name}`;
    case 'to-sun': return 'Еду за солнышком';
    case 'collecting': return 'Собираю солнышко';
    case 'returning': return 'Возвращаюсь на базу';
    default: return 'Выберите растение или солнышко';
  }
}

// Collected energy is drawn above the chassis and HUD, all the way to the counter.
function EnergyTransfer({ sun, rover }: { sun: SunDrop; rover: SmartMower }) {
  const ground = projectGround(sun.x, sun.ty, sun.ty - sun.y);
  const mount = cargoMount(rover);
  const pull = rover.phase === 'collecting' && sun.landed ? ease(rover.age / COLLECT_TIME) : 0;
  const flight = clamp01(sun.collectT / TRANSFER_TIME);
  const transfer = 1 - (1 - flight) ** 2;
  const x = sun.collected ? mix(sun.fx, 61, transfer) : mix(ground.x, mount.x, pull);
  const y = sun.collected ? mix(sun.fy, 62, transfer) - Math.sin(flight * Math.PI) * 36 : mix(ground.y, mount.y, pull) - Math.sin(pull * Math.PI) * 12;
  const scale = ground.scale * (sun.collected ? .48 - flight * .2 : 1 - pull * .52);
  return (
    <div
      className="rover-energy"
      data-entity="reserved-sun"
      data-transferring={sun.collected}
      style={{ left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})` }}
    >
      <div className="anim-sun-glow"><SunSprite size={72} /></div>
      {!sun.collected && <i className="sun-target-ring" />}
    </div>
  );
}

export function SmartMowerLayer({ game }: { game: Game }) {
  const r = game.rover;
  const scale = roverScale(r.y);
  const mount = cargoMount(r);
  const inLoad = r.phase === 'loading';
  const plant = inLoad ? r.order?.type : r.cargo;
  let width = 75 * scale, height = 80 * scale;
  let x = mount.x, y = mount.y;

  if (inLoad && r.order) {
    const p = ease(r.age / LOAD_TIME);
    x = mix(r.order.source.x, mount.x, p);
    y = mix(r.order.source.y + 23, mount.y, p) - Math.sin(p * Math.PI) * 20;
    width = mix(49, width, p);
    height = mix(54, height, p);
  } else if (r.phase === 'planting' && r.order?.cell) {
    const end = plantingPoint(r.order.cell);
    const p = ease(r.age / PLANT_TIME);
    x = mix(mount.x, end.x, p);
    y = mix(mount.y, end.y, p) - Math.sin(p * Math.PI) * 26 * end.scale;
    width = mix(width, 104 * end.scale, p);
    height = mix(height, 108 * end.scale, p);
  } else if (r.route) {
    y += Math.sin(r.odometer / 6) * .95 * scale;
  }

  const feedback = r.feedback;
  const fade = feedback ? clamp01(feedback.age / .9) : 0;

  return (
    <>
      <div className="smart-mower-layer" aria-hidden="true">
        <div
          className={cn('smart-mower', game.auto && 'armed', r.drifting && 'is-drifting')}
          data-mods={r.mod?.type ?? ''} data-mod={r.mod?.type ?? 'none'}
          data-entity="smart-mower"
          data-phase={r.phase}
          data-cargo={r.cargo ?? ''}
          data-auto={game.auto}
          style={{
            left: r.x,
            top: r.y,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <div className="rover-shadow" />
          <div className="rover-chassis" style={{ transform: `rotate(${r.heading}deg)` }}>
            <RoverSprite
              mileage={r.odometer}
              armed={game.auto}
              flash={r.flashT}
              thrusting={r.thrusting}
              recoilOffset={r.recoilOffset}
              drifting={r.drifting}
            />
          </div>
        </div>

        {plant && (
          <div
            data-entity="rover-cargo"
            data-plant={plant}
            className="rover-cargo"
            style={{ left: x, top: y, width, height }}
          >
            <PlantSprite type={plant} mini />
          </div>
        )}

        {game.suns.filter((s) => s.collected || s.id === r.activeSun).map((sun) => (
          <EnergyTransfer key={sun.id} sun={sun} rover={r} />
        ))}

        {feedback && (
          <div className="rover-feedback" style={{ left: feedback.at.x, top: feedback.at.y, opacity: 1 - fade }}>
            {feedback.kind === 'sun' && <span style={{ transform: `translate(-50%, ${-25 - 42 * fade}px)` }}>+{SUN_VALUE}</span>}
            <i style={{ width: 26 + fade * 62, height: 11 + fade * 26, borderColor: feedback.kind === 'sun' ? '#ffe69b' : '#22d3ee' }} />
          </div>
        )}
      </div>

      <div className={cn('rover-radio', game.auto && 'striker-radio')} style={{ bottom: BOTTOM_BAR_H }}>
        <span className={cn('rover-call-sign', game.auto && 'text-[#22d3ee]')}>
          {game.auto ? <ShieldAlert size={19} className="text-[#22d3ee] animate-pulse" /> : <Radio size={19} />}
          {game.auto ? 'М-01 ШТУРМОВИК' : 'М-01 АВТОПИЛОТ'}
        </span>
        <span className="rover-message" role="status" aria-live="polite">
          {statusText(r, game.auto)}
        </span>
        {game.auto && (
          <span className="rover-speed-gauge text-cyan-300">
            <Gauge size={16} />
            <span>{Math.round(r.speed)} км/ч</span>
          </span>
        )}
        {r.mod && (
          <span className="rover-mods" aria-label={`Модуль: ${MOD_COPY[r.mod.type]}`}>
            <Settings2 size={16} />
            <i data-mod-chip={r.mod.type} data-ready={r.mod.cd <= 0} title={modName(r.mod.type)}>
              <PlantSprite type={r.mod.type} mini />
              {modCooldown(r.mod.type) > 0 && <b style={{ width: `${100 * (1 - r.mod.cd / modCooldown(r.mod.type))}%` }} />}
            </i>
          </span>
        )}
        {r.sunQueue.length > 0 && (
          <span className="rover-queue" aria-label={`Солнышек в очереди: ${r.sunQueue.length}`}>
            <Sun size={16} /> {r.sunQueue.length}
          </span>
        )}
      </div>
    </>
  );
}
