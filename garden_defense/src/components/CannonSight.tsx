import { STAGE_H, STAGE_W, type Game } from '../game/constants';
import { traceFlight } from '../game/cannon';

export function CannonSight({ game }: { game: Game }) {
  const r = game.rover;
  const angle = r.heading * Math.PI / 180;
  const { from, hit, direction } = traceFlight(game, r.manualAim ?? { x: Math.sin(angle), y: -Math.cos(angle) });
  const x = hit.point.x, y = hit.point.y;
  const planting = !!r.order && hit.kind === 'border';
  const cell = 'cell' in hit.payload ? hit.payload.cell : null;
  const occupied = cell && game.plants.some((p) => p.row === cell.row && p.col === cell.col);
  const color = hit.kind === 'sun' ? '#ffe889' : planting && !occupied ? '#d8f99c' : hit.wall ? '#ffc58b' : '#a9eef0';
  const rotate = Math.atan2(direction.y, direction.x) * 180 / Math.PI;

  return <svg className="ballistics-layer" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
    <g data-aim-kind={hit.kind} data-aim-wall={hit.wall ?? 'none'}>
      <line x1={from.x} y1={from.y} x2={x} y2={y} stroke="#193136" strokeOpacity=".55" strokeWidth="3.5" />
      <line data-aim-line x1={from.x} y1={from.y} x2={x} y2={y} stroke={color} strokeWidth="2" strokeDasharray="8 7" />
      <g transform={`translate(${x} ${y}) rotate(${rotate})`} fill="none" stroke={color}>
        {hit.wall ? <>
          <path d="M0-8V8" stroke="#28303b" strokeWidth="4" /><path d="M0-8V8" strokeWidth="2.4" />
          <path d="m-11-4 5 4-5 4" strokeWidth="2" strokeLinejoin="round" />
        </> : <><circle r="9" strokeWidth="1.8" /><circle r="2.2" fill={color} stroke="none" /></>}
      </g>
    </g>
    {game.shots.map((s) => {
      const fraction = Math.min(1, s.t / s.ttl);
      const head = fraction * s.terminal.distance;
      const tail = Math.max(0, head - 23);
      const line = { x1: s.from.x + s.direction.x * tail, y1: s.from.y + s.direction.y * tail,
        x2: s.from.x + s.direction.x * head, y2: s.from.y + s.direction.y * head };
      const tint = s.kind === 'sun' ? '#ffd26c' : s.kind === 'seed' ? '#bef078' : '#80ebed';
      return <g key={s.id} data-shot={s.kind}>
        <line {...line} stroke={tint} strokeWidth="9" opacity=".28" />
        <line {...line} stroke={tint} strokeWidth="4.8" /><line {...line} stroke="#fffce8" strokeWidth="1.8" />
      </g>;
    })}
  </svg>;
}