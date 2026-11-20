import { useState, type CSSProperties } from 'react';
import {
  COLS, LAWN_BOTTOM, LAWN_TOP, PEA_HEIGHT, PLANT_MAP,
  ROWS, STAGE_H, STAGE_W, SUN_VALUE, plantX, plantY,
  type Game, type PlantType,
} from '../game/constants';
import { FIELD_TILES, LAWN_CENTER, projectGround } from '../game/perspective';
import { rowAt } from '../game/arenaGeometry';
import { FENCE_SECTIONS, boardPoint, fenceSection, pickFenceSection } from '../game/fence';
import { FxSprite, MowerSprite, PeaSprite, PlantSprite, SunSprite, ZombieSprite } from '../game/sprites';
import { cn } from '../utils/cn';
import { ArenaTerrain } from './ArenaTerrain';
import { ServicePads } from './ServicePads';
import { FenceHighlight } from './GardenFence';
import { RoverGround } from './SmartMower';
import { sunPoint } from '../game/cannon';

function spriteStyle(
  x: number, y: number, width: number, height: number,
  pivot = 1, elevation = 0, layer?: number,
): CSSProperties {
  const p = projectGround(x, y, elevation);
  return {
    left: p.x - width / 2, top: p.y - height * pivot, width, height,
    transformOrigin: `50% ${pivot * 100}%`, transform: `scale(${p.scale})`,
    zIndex: layer ?? 20 + Math.round(y / 3),
  };
}

function Health({ value, max }: { value: number; max: number }) {
  if (value >= max) return null;
  return <div className="entity-health"><i style={{ width: `${100 * value / max}%`, background: value / max < .3 ? '#e7744c' : '#b0e365' }} /></div>;
}

export interface BorderTarget {
  side: 'left' | 'center' | 'right';
  row: number;
  col: number;
  x: number;
  y: number;
}

interface BoardProps {
  game: Game;
  selected: PlantType | null;
  shovel: boolean;
  auto: boolean;
  onCellClick: (row: number, col: number) => void;
  onSunClick: (id: number) => void;
  onBorderShot: (target: BorderTarget) => void;
  onFenceCommand: (section: string) => void;
}

export function Board({ game, selected, shovel, auto, onCellClick, onSunClick, onBorderShot, onFenceCommand }: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [hoverFence, setHoverFence] = useState<string | null>(null);
  const occupants = new Map(game.plants.map((p) => [p.row * COLS + p.col, p]));
  const affordable = !!selected && game.sun >= PLANT_MAP[selected].cost && game.cds[selected] <= 0;
  const tile = hover !== null ? FIELD_TILES[hover] : undefined;
  const destination = game.rover.order?.cell;
  const mark = game.rover.plantingMark;
  const fence = game.rover.fenceOrder?.section ?? (auto && game.rover.cursorPoint ? pickFenceSection(game.rover.cursorPoint) : null) ?? fenceSection(hoverFence ?? '');
  const ghost = !auto && tile && selected && !destination && affordable && !occupants.has(hover!);

  return (
    <div className={cn('arena-world absolute inset-0 isolate overflow-hidden', game.shakeT > 0 && 'anim-shake')}
      onContextMenu={(e) => e.preventDefault()}>
      <ArenaTerrain />
      <ServicePads game={game} side="plant" />
      <ServicePads game={game} side="mod" />
      <RoverGround rover={game.rover} />
        <svg className="auto-border-layer" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          role="group" aria-label="Секции садовой ограды">
          {auto && <line role="button" tabIndex={0} data-border="center" aria-label="Выстрелить в металлический разделитель"
            x1={LAWN_CENTER} y1={projectGround(LAWN_CENTER, LAWN_TOP).y} x2={LAWN_CENTER} y2={projectGround(LAWN_CENTER, LAWN_BOTTOM).y}
            className="auto-border" onPointerDown={(e) => {
              if (e.button !== 0 && e.button !== 2) return;
              const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
              const y = (e.clientY - rect.top) * STAGE_H / rect.height;
              onBorderShot({ side: 'center', x: LAWN_CENTER, y, row: rowAt(y), col: game.rover.x < LAWN_CENTER ? 1 : 2 });
            }} onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              const y = (projectGround(LAWN_CENTER, LAWN_TOP).y + projectGround(LAWN_CENTER, LAWN_BOTTOM).y) / 2;
              onBorderShot({ side: 'center', x: LAWN_CENTER, y, row: rowAt(y), col: game.rover.x < LAWN_CENTER ? 1 : 2 });
            }} />}
          {FENCE_SECTIONS.map((s) => {
            const a = boardPoint(s, 0, 0), b = boardPoint(s, 1, 0);
            const c = boardPoint(s, 1, 35), d = boardPoint(s, 0, 35);
            return <path key={s.id} role="button" tabIndex={0} data-border={s.side} data-fence-target={s.id}
              aria-label={`Забор: ${s.side === 'back' ? 'дальний край' : s.winter ? 'слева' : 'справа'}, секция ${s.index + 1}`}
              d={`M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}L${d.x} ${d.y}Z`}
              className="perimeter-target" onFocus={() => setHoverFence(s.id)} onBlur={() => setHoverFence(null)}
              onPointerEnter={() => setHoverFence(s.id)} onPointerLeave={() => setHoverFence(null)}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.button !== 2) return;
                e.preventDefault();
                if (!auto && e.button === 0 && e.pointerType !== 'touch') { onCellClick(s.cell.row, s.cell.col); return; }
                onFenceCommand(s.id);
              }} onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault(); onFenceCommand(s.id);
              }} />;
          })}
          {fence && <FenceHighlight section={fence} />}
        </svg>
      <svg className="arena-cell-layer" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        role="group" aria-label={`Арена: ${COLS} дорожки по ${ROWS} клеток. Слева зима, справа осень.`}>
        {FIELD_TILES.map(({ row, col, points }, i) => {
          const occupant = occupants.get(i);
          const active = hover === i && (selected || shovel);
          const ordered = destination?.row === row && destination.col === col;
          const marked = mark?.row === row && mark.col === col;
          const color = shovel ? '#ff9375' : affordable && !occupant ? '#edffc2' : '#fff3b4';
          return (
            <polygon key={i} role="button" tabIndex={0} data-cell={i} data-row={row} data-col={col}
              aria-label={`Дорожка ${col + 1}, ряд ${row + 1}: ${occupant ? PLANT_MAP[occupant.type].name : marked ? 'отмечено, нужен второй выстрел' : 'свободно'}`}
              data-destination={ordered || undefined}
              data-primed={marked || undefined}
              points={points} fill={marked || ordered ? '#d4f4a6' : active ? color : 'transparent'} fillOpacity={marked || ordered ? .24 : active ? .36 : 1}
              stroke={marked || ordered ? '#e6ffb4' : active ? color : 'none'} strokeDasharray={marked || ordered ? '9 5' : undefined}
              strokeWidth="3" className={cn('arena-cell', (selected || shovel) && 'can-interact')}
              onPointerEnter={(e) => { if (e.pointerType !== 'touch') setHover(i); }}
              onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              onClick={() => onCellClick(row, col)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick(row, col); }
              }} />
          );
        })}
      </svg>

      {mark && <div className="scene-sprite planting-blueprint" data-entity="planting-preview"
        data-row={mark.row} data-col={mark.col} style={spriteStyle(plantX(mark.col), plantY(mark.row), 90, 94, 1, 0, 10)}>
        <div className="blueprint-plant"><PlantSprite type={mark.type} mini /></div>
        <span className="blueprint-count" aria-label="Первое попадание из двух">1<span>/</span>2</span>
      </div>}

      {ghost && tile && selected && (
        <div className="scene-sprite opacity-60" style={spriteStyle(plantX(tile.col), plantY(tile.row), 104, 108)}>
          <PlantSprite type={selected} mini />
        </div>
      )}

      {game.mowers.filter((m) => m.state !== 'gone').map((m) => (
        <div key={m.col} data-entity="mower" data-col={m.col} className="scene-sprite"
          style={spriteStyle(plantX(m.col), m.y, 78, 78, .5)}>
          <MowerSprite running={m.state === 'run'} />
        </div>
      ))}

      {game.plants.map((p) => (
        <div key={p.id} data-entity="plant" data-row={p.row} data-col={p.col} className="scene-sprite"
          style={spriteStyle(plantX(p.col), plantY(p.row), 104, 108)}>
          <div className={cn('h-full w-full', p.bornT < .35 && 'plant-settle', p.flashT > 0 && 'flash-hit')}>
            <PlantSprite type={p.type} hpRatio={p.hp / p.maxHp} arming={p.type === 'cherrybomb' && p.armT < .9} />
          </div>
          <Health value={p.hp} max={p.maxHp} />
        </div>
      ))}

      {game.zombies.map((z) => (
        <div key={z.id} data-entity="zombie" data-col={z.col} className="scene-sprite"
          style={spriteStyle(plantX(z.col), z.y, 112, 150, .98)}>
          <div className={cn('h-full w-full', z.flashT > 0 && 'flash-hit')}>
            <ZombieSprite type={z.type} eating={z.eatingId !== null} dying={z.dieT !== null} slowed={z.slowT > 0} />
          </div>
          {z.dieT === null && <Health value={z.hp} max={z.maxHp} />}
        </div>
      ))}

      {game.peas.map((p) => (
        <div key={p.id} className="scene-sprite" style={spriteStyle(plantX(p.col), p.y, 20, 20, .5, PEA_HEIGHT, 600)}>
          <PeaSprite ice={p.ice} />
        </div>
      ))}

      {game.fxs.map((fx) => {
        const size = fx.kind === 'boom' ? 260 : fx.kind === 'spark' ? 32 : 80;
        const style = fx.stageSpace ? { left: fx.x - size / 2, top: fx.y - size / 2, width: size, height: size, zIndex: 650 } : spriteStyle(fx.x, fx.y, size, size, .5, fx.elevation, 650);
        return <div key={fx.id} className="scene-sprite" style={style}>
          <FxSprite kind={fx.kind} t={fx.t} ttl={fx.ttl} />
        </div>;
      })}

      {game.suns.map((sun) => {
        if (sun.collected) return null;
        const onRoute = sun.id === game.rover.activeSun;
        const p = sunPoint(sun);
        return (
          <button key={sun.id} data-entity="sun" data-reserved={sun.reserved} aria-label={sun.reserved ? 'Солнышко отмечено для косилки' : `Собрать солнце: ${SUN_VALUE}`}
            aria-disabled={sun.reserved} onClick={() => { if (!sun.reserved) onSunClick(sun.id); }}
            className={cn('sun-pickup', sun.landed && !sun.reserved && sun.life < 2 && 'anim-blink')}
            style={{ left: p.x, top: p.y, zIndex: 700 }}>
            {!onRoute && <span className="anim-sun-glow" style={{ transform: `scale(${p.scale})` }}><SunSprite size={72} /></span>}
            {sun.reserved && !onRoute && <i className="sun-target-ring" style={{ width: 79 * p.scale, height: 79 * p.scale }} />}
          </button>
        );
      })}
    </div>
  );
}