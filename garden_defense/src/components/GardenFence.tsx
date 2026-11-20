import { memo } from 'react';
import { FENCE_SECTIONS, boardPoint, type FenceSpan, type FenceSection } from '../game/fence';
import { projectGround } from '../game/perspective';
import { CELL_W, cellTop, LAWN_TOP, LAWN_X, LAWN_RIGHT, ROWS } from '../game/constants';

const winter = { wood: '#89877c', light: '#c4c7bc', edge: '#49515b', side: '#5f6367', snow: '#eff5fa' };
const autumn = { wood: '#ab794a', light: '#d9ad74', edge: '#594134', side: '#7a5239', snow: '#e0b478' };
type Finish = typeof winter;
const path = (points: { x: number; y: number }[]) => `M${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('L')}Z`;

type PlankSpan = FenceSpan;

function Planks({ s }: { s: PlankSpan }) {
  const f = s.winter ? winter : autumn;
  const p = (t: number, h: number) => boardPoint(s, t, h);
  return <g data-fence-section={s.id} strokeLinejoin="round">
    {[8, 23].map((height) => <g key={height}>
      <path d={path([p(0, height - 1), p(1, height - 1), p(1, height + 5), p(0, height + 5)])}
        fill={f.wood} stroke={f.edge} strokeWidth="1.4" />
      {s.side !== 'back' && (() => {
        const a = p(0, height + 5), b = p(1, height + 5);
        const width = s.side === 'left' ? -6 : 6;
        return <path d={path([a, b, { x: b.x + width * b.scale, y: b.y - b.scale },
          { x: a.x + width * a.scale, y: a.y - a.scale }])}
          fill={s.winter ? '#d2deea' : f.light} stroke={f.edge} strokeWidth="1" />;
      })()}
      <path d={`M${p(0, height + 4).x} ${p(0, height + 4).y}L${p(1, height + 4).x} ${p(1, height + 4).y}`}
        stroke={s.winter ? f.snow : f.light} strokeWidth={s.winter ? 2.1 : 1.4} strokeLinecap="round" />
    </g>)}
    {s.side === 'back' && [.24, .5, .76].map((t, i) => {
      const { x, y, scale } = p(t, 0);
      const h = 30 + (i % 2) * 3;
      return <g key={t} transform={`translate(${x} ${y}) scale(${scale})`}>
        <path d={`M-4 0V${5 - h}l4-5 4 5V0Z`} fill={f.wood} stroke={f.edge} strokeWidth="1.8" />
        <path d={`M-3 ${5 - h}l3-4 3 4`} fill="none" stroke={f.snow} strokeWidth="2.5" />
        <circle cy="-23" r="1.2" fill="#494843" />
      </g>;
    })}
  </g>;
}

function Post({ x, y, scale, f, snowy }: { x: number; y: number; scale: number; f: Finish; snowy: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
    <ellipse cx="2" cy="1" rx="10" ry="3.2" fill="#26303a" opacity=".24" />
    <path d="M-5.5-30-1-36 5-32 6 0-3 2-6 0Z" fill={f.wood} stroke={f.edge} strokeWidth="2" />
    <path d="m2-30 3-2 1 32-4 1Z" fill={f.side} />
    <path d="m-6-30 5-7 7 5-4 3Z" fill={f.light} stroke={f.edge} strokeWidth="1.3" />
    {snowy && <path d="m-7-30 5-8 4 1 5 5-3 3-4-2-4 2Z" fill={f.snow} stroke="#b6c9dc" strokeWidth="1" />}
    <path d="m-3-24 .5 16m1-9 .5 12" stroke={f.side} strokeWidth="1.1" opacity=".8" />
    <circle cx="-1.2" cy="-23" r="1.65" fill="#474843" /><circle cx="-1.6" cy="-23.6" r=".65" fill="#d8d6bc" />
  </g>;
}

// The back fence closes visually above the two selection fields too.
const DECORATIVE_BACK: PlankSpan[] = [
  { id: 'back-decor-left', side: 'back', winter: true, a: { x: LAWN_X, y: LAWN_TOP }, b: { x: LAWN_X + CELL_W, y: LAWN_TOP } },
  { id: 'back-decor-right', side: 'back', winter: false, a: { x: LAWN_RIGHT - CELL_W, y: LAWN_TOP }, b: { x: LAWN_RIGHT, y: LAWN_TOP } },
];

export const GardenFence = memo(function GardenFence() {
  const back = FENCE_SECTIONS.filter((s) => s.side === 'back');
  return <g aria-hidden="true" data-garden-fence="timber">
    {[...DECORATIVE_BACK, ...back].sort((a, b) => a.a.x - b.a.x).map((s) => <Planks key={s.id} s={s} />)}
    {[...DECORATIVE_BACK, ...back].sort((a, b) => a.a.x - b.a.x).slice(1).map((s) => <Post key={s.id} {...boardPoint(s, 0, 0)} f={s.winter ? winter : autumn} snowy={s.winter} />)}
    {(['left', 'right'] as const).map((side) => {
      const snowy = side === 'left', f = snowy ? winter : autumn;
      const spans = FENCE_SECTIONS.filter((s) => s.side === side);
      return <g key={side} data-fence-side={side}>
        <Post {...boardPoint(spans[0], 0, 0)} f={f} snowy={snowy} />
        {spans.map((s) => <g key={s.id}>
          <Planks s={s} /><Post {...boardPoint(s, 1, 0)} f={f} snowy={snowy} />
        </g>)}
        {(() => {
          const p = projectGround(snowy ? LAWN_X - 6 : LAWN_RIGHT + 6, cellTop(ROWS), 35);
          return <g transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}>
            <path d="M-6-9-7-13 0-17 7-13 6-9Z" fill="#49515a" stroke="#34363c" strokeWidth="1.3" />
            <path d="M-5-9H5L4-1H-4Z" fill={snowy ? '#e4f2f5' : '#ffcf75'} stroke="#585449" strokeWidth="1.7" />
            <path d="M0-9v8" stroke="#726550" strokeWidth="1.2"/><path d="M-5 0H5" stroke="#45413c" strokeWidth="2"/>
          </g>;
        })()}
      </g>;
    })}
  </g>;
});

export function FenceHighlight({ section }: { section: FenceSection }) {
  const p = (t: number, h: number) => boardPoint(section, t, h);
  return <g className="fence-highlight" data-highlight={section.id} aria-hidden="true">
    <path d={path([p(.03, 3), p(.97, 3), p(.97, 30), p(.03, 30)])} fill="#f0d692" fillOpacity=".24"
      stroke="#ffe8ac" strokeWidth="2.3" strokeLinejoin="round" />
  </g>;
}