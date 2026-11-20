import { memo, useId } from 'react';
import {
  COLS, DIVIDER_LEFT, DIVIDER_RIGHT, LAWN_BOTTOM, LAWN_RIGHT, LAWN_TOP, LAWN_X,
  ROWS, STAGE_H, STAGE_W, cellTop,
} from '../game/constants';
import { FIELD_TILES, FIELD_VIEW, projectGround } from '../game/perspective';
import { RAIL } from '../game/arenaGeometry';
import { GardenFence } from './GardenFence';

const skyCenter = STAGE_W / 2;

function points(...positions: { x: number; y: number }[]) {
  return positions.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function strip(left: number, right: number, far: number, near: number, height = 0) {
  return points(projectGround(left, far, height), projectGround(right, far, height),
    projectGround(right, near, height), projectGround(left, near, height));
}

const winterOutline = strip(LAWN_X, DIVIDER_LEFT, LAWN_TOP, LAWN_BOTTOM);
const autumnOutline = strip(DIVIDER_RIGHT, LAWN_RIGHT, LAWN_TOP, LAWN_BOTTOM);

// The metal threshold is exactly one field wide and shares the lawn perspective.
const { far: railFar, near: railNear, height: railHeight, left: railLeft, right: railRight } = RAIL;
const railHalf = (railRight - railLeft) / 2;
const railCenter = (railLeft + railRight) / 2;
const railRims = Array.from({ length: ROWS + 1 }, (_, row) => cellTop(row));
const palettes = {
  winter: { light: '#f8fcff', shade: '#485f8a', line: '#e5f2ff', edge: '#cae0f5' },
  autumn: { light: '#e9aa68', shade: '#4f2634', line: '#ffc88d', edge: '#d49c70' },
} as const;

function SteelDivider({ finish }: { finish: string }) {
  return (
    <g data-arena-divider="steel">
      <polygon points={strip(railLeft - 8, railRight + 11, railFar, railNear + 2)} fill="#151c29" opacity=".44" />
      <polygon points={points(
        projectGround(railRight, railFar, railHeight), projectGround(railRight + 1.7, railFar),
        projectGround(railRight + 1.7, railNear), projectGround(railRight, railNear, railHeight),
      )} fill="#313740" stroke="#242731" strokeWidth=".8" />
      <polygon points={points(
        projectGround(railLeft, railNear, railHeight), projectGround(railRight, railNear, railHeight),
        projectGround(railRight + 1.7, railNear), projectGround(railLeft - 1.7, railNear),
      )} fill="#465365" stroke="#242731" strokeWidth="1.25" />
      <polygon data-divider-strip points={strip(railLeft, railRight, railFar, railNear, railHeight)} fill={`url(#${finish})`}
        stroke="#283746" strokeWidth="1.25" strokeLinejoin="round" />
      {/* Polished bevels follow the strip's own half-width */}
      <polygon points={strip(railLeft + railHalf * .18, railLeft + railHalf * .52, railFar, railNear, railHeight)} fill="#e6f0ff" opacity=".72" />
      <polygon points={strip(railRight - railHalf * .52, railRight - railHalf * .18, railFar, railNear, railHeight)} fill="#c8abb0" opacity=".5" />
      <polygon points={strip(railCenter - 1.2, railCenter, railFar, railNear, railHeight)} fill="#e6eeff" opacity=".3" />
      <polygon points={strip(railLeft, railRight, railFar, railFar + 7, railHeight)} fill="#52606d" opacity=".38" />
      {railRims.map((y, i) => (
        <g key={y}>
          <polygon points={strip(railLeft + .5, railRight - .5, y - 1, y + 1.3, railHeight)} fill="#333c4b" />
          <polygon points={strip(railLeft + 1, railRight - 1, y + 1.3, y + 2.8, railHeight)} fill="#d4dce7" opacity=".65" />
          {[-railHalf + 4.5, railHalf - 4.5].map((offset) => {
            const p = projectGround(railCenter + offset, y + (i === ROWS ? -10 : 11), railHeight);
            return (
              <g key={offset} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}>
                <ellipse rx="2.5" ry="1.9" cx=".35" cy=".55" fill="#38404c" />
                <ellipse rx="1.75" ry="1.45" fill="#acb8c5" />
                <path d="M-.95 -.22 .83 .36" stroke="#4d5563" strokeWidth=".7" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

const snow = Array.from({ length: 31 }, (_, i) => ({
  x: 3 + (i * 113) % (skyCenter - 8), y: 117 + (i * 71) % 875,
  radius: 1 + (i % 5) * .42, duration: 8 + i % 6, delay: -((i * 2.37) % 12),
}));
const leaves = Array.from({ length: 11 }, (_, i) => ({
  x: skyCenter + 56 + (i * 117) % (skyCenter - 57), y: 135 + (i * 139) % 805,
  size: .57 + (i % 5) * .14, duration: 10 + i % 5, delay: -((i * 3.14) % 13),
}));

export const ArenaTerrain = memo(function ArenaTerrain() {
  const uid = useId();
  const steel = `${uid}-steel`;
  const snowClip = `${uid}-snow`;
  const leafClip = `${uid}-leaves`;

  return (
    <>
      <img className="arena-scenery" src="/images/two-seasons-terrain.webp" width={STAGE_W} height={STAGE_H}
        alt="" draggable={false} />
      <svg className="arena-ground" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
        <defs>
          <linearGradient id={steel} x1="0" x2="1" y1="0" y2=".38">
            <stop stopColor="#afc4d8" />
            <stop offset=".24" stopColor="#697f96" />
            <stop offset=".45" stopColor="#b8c6d3" />
            <stop offset=".68" stopColor="#8c9ba9" />
            <stop offset="1" stopColor="#4b5666" />
          </linearGradient>
          <clipPath id={snowClip}><rect width={skyCenter - 5} height={FIELD_VIEW.nearY + 39} /></clipPath>
          <clipPath id={leafClip}><rect x={skyCenter + 5} width={skyCenter - 5} height={FIELD_VIEW.nearY + 39} /></clipPath>
        </defs>
        <g fill="none" stroke="#151d2a" strokeWidth="7" strokeOpacity=".55" strokeLinejoin="round">
          <polygon points={winterOutline} />
          <polygon points={autumnOutline} />
        </g>
        {FIELD_TILES.map(({ row, col, points: tile }) => {
          const season = col < COLS / 2 ? 'winter' : 'autumn';
          const color = palettes[season];
          const light = (row + col) % 2 === 0;
          return <polygon key={`${row}:${col}`} data-season={season} points={tile} fill={light ? color.light : color.shade}
            fillOpacity={light ? .26 : .23} stroke={color.line} strokeOpacity=".5" strokeWidth="1.6" strokeLinejoin="round" />;
        })}
        <polygon points={winterOutline} fill="none" stroke={palettes.winter.edge} strokeOpacity=".8" strokeWidth="2" />
        <polygon points={autumnOutline} fill="none" stroke={palettes.autumn.edge} strokeOpacity=".8" strokeWidth="2" />
        <SteelDivider finish={steel} />
        <GardenFence />
        <g className="arena-weather" clipPath={`url(#${snowClip})`} fill="#f4f9ff">
          {snow.map(({ x, y, radius, duration, delay }, i) => (
            <circle key={i} className="arena-flake" cx={x} cy={y} r={radius}
              style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }} />
          ))}
        </g>
        <g className="arena-weather" clipPath={`url(#${leafClip})`}>
          {leaves.map(({ x, y, size, duration, delay }, i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${size})`}>
              <g className="arena-leaf" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
                <path d="M-8 1-5-1-7-5-3-4-2-8 1-5 5-7 4-3 8-2 6 2 2 3 0 7-2 3Z"
                  fill={i % 2 ? '#eb9440' : '#c25331'} stroke="#7e3429" strokeWidth=".65" />
                <path d="M-1 8 1 2 3-3" fill="none" stroke="#f5ad55" strokeWidth=".8" />
              </g>
            </g>
          ))}
        </g>
      </svg>
    </>
  );
});
