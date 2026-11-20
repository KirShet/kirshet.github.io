import { Ghost, Settings2, Sun, Ban } from 'lucide-react';
import {
  MOD_PADS, MOD_PAD_X, PAD_H, PAD_ROWS, PAD_W, PLANT_MAP, PLANT_PADS, PLANT_PAD_X, STAGE_H, STAGE_W,
  type Game,
} from '../game/constants';
import { projectGround } from '../game/perspective';
import { PlantSprite } from '../game/sprites';
import { cn } from '../utils/cn';

const FIELDS = {
  winter: { light: '#f8fcff', shade: '#485f8a', line: '#e5f2ff' },
  autumn: { light: '#e9aa68', shade: '#4f2634', line: '#ffc88d' },
} as const;

function tilePoints(x: number, y: number) {
  const corners = [
    projectGround(x - PAD_W / 2, y - PAD_H / 2),
    projectGround(x + PAD_W / 2, y - PAD_H / 2),
    projectGround(x + PAD_W / 2, y + PAD_H / 2),
    projectGround(x - PAD_W / 2, y + PAD_H / 2),
  ];
  return {
    points: corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
    center: projectGround(x, y),
  };
}

/** Поля у борта арены выглядят как обычные клетки газона, но зомби по ним не ходят. */
export function ServicePads({ game, side }: { game: Game; side: 'plant' | 'mod' }) {
  const rover = game.rover;
  const x = side === 'plant' ? PLANT_PAD_X : MOD_PAD_X;
  const pads = side === 'plant' ? PLANT_PADS : MOD_PADS;
  const palette = side === 'plant' ? FIELDS.winter : FIELDS.autumn;

  return (
    <>
      <svg className="service-pad-layer" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
        {pads.map((pad, index) => {
          const { points } = tilePoints(x, pad.y);
          const def = PLANT_MAP[pad.type];
          const row = PAD_ROWS[index];
          const held = rover.cargo === pad.type && rover.prepaidType === pad.type;
          const installed = rover.mod?.type === pad.type;
          const marked = rover.padMark?.side === side && rover.padMark.row === row;
          const cooling = game.cds[pad.type] > 0;
          const affordable = side === 'plant' ? game.sun >= def.cost && !cooling : !installed;
          const shade = index % 2 === 0;
          return (
            <polygon key={pad.type} data-service-pad={side} data-pad={pad.type}
              data-held={held} data-installed={installed} data-affordable={affordable}
              data-primed={marked || undefined}
              points={points} className="service-field"
              fill={marked ? '#d4f4a6' : shade ? palette.shade : palette.light}
              fillOpacity={marked ? .36 : shade ? .42 : .48}
              stroke={marked ? '#e6ffb4' : palette.line}
              strokeDasharray={marked ? '9 5' : undefined}
              strokeOpacity={marked ? .95 : .62} strokeWidth={marked ? 2.6 : 1.8} strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <div className="service-chip-layer" aria-hidden="true">
        {pads.map((pad, index) => {
          const { center } = tilePoints(x, pad.y);
          const def = PLANT_MAP[pad.type];
          const row = PAD_ROWS[index];
          const held = rover.cargo === pad.type && rover.prepaidType === pad.type;
          const installed = rover.mod?.type === pad.type;
          const marked = rover.padMark?.side === side && rover.padMark.row === row;
          const cooling = game.cds[pad.type] > 0;
          const width = PAD_W * .62 * center.scale;
          const height = PAD_H * .72 * center.scale;
          return (
            <div key={pad.type} className={cn('service-chip', side === 'mod' && 'is-mod',
              held && 'is-held', installed && 'is-installed', marked && 'is-affordable', cooling && 'is-cooling')}
              style={{ left: center.x - width / 2, top: center.y - height / 2, width, height }}>
              <div className="chip-art"><PlantSprite type={pad.type} mini /></div>
              <div className="chip-label">
                {side === 'plant' ? <><Sun size={9} fill="currentColor" /> {def.cost}</> : <Settings2 size={11} />}
              </div>
              <span className="chip-no-zombies" title="Зомби по этим полям не ходят"><Ghost size={10} /><Ban size={10} /></span>
              {marked && (
                <span className="blueprint-count" aria-label="Первое попадание из двух">1<span>/</span>2</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
