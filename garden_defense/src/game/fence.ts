import { CELL_W, COLS, LAWN_RIGHT, LAWN_TOP, LAWN_X, MOD_PAD_X, PAD_H, PAD_ROWS, PAD_W, PLANT_PAD_X, ROWS, cellTop, columnLeft } from './constants';
import { BODY_RADIUS, safeParking, type Cell, type Point } from './arenaGeometry';
import { LAWN_CENTER, projectGround } from './perspective';

export type FenceSide = 'left' | 'right' | 'back';
export interface FenceSection {
  id: string; side: FenceSide; index: number; cell: Cell; a: Point; b: Point;
  target: Point; parking: Point; winter: boolean;
}

function section(side: FenceSide, index: number, a: Point, b: Point, cell: Cell): FenceSection {
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const target = projectGround(middle.x, middle.y);
  const inward = side === 'back' ? { x: 0, y: 1 } : { x: side === 'left' ? 1 : -1, y: .18 };
  const standoff = BODY_RADIUS + 27;
  return { id: `${side}-${index}`, side, index, a, b, cell, target,
    winter: middle.x < LAWN_CENTER,
    parking: safeParking({ x: target.x + inward.x * standoff, y: target.y + inward.y * standoff }),
  };
}

export const FENCE_SECTIONS: readonly FenceSection[] = [
  ...Array.from({ length: COLS }, (_, col) => section('back', col,
    { x: columnLeft(col), y: LAWN_TOP }, { x: columnLeft(col) + CELL_W, y: LAWN_TOP }, { row: 0, col })),
  ...(['left', 'right'] as const).flatMap((side) => Array.from({ length: ROWS }, (_, row) => {
    const x = side === 'left' ? LAWN_X : LAWN_RIGHT;
    return section(side, row, { x, y: cellTop(row) }, { x, y: cellTop(row + 1) }, { row, col: side === 'left' ? 0 : COLS - 1 });
  })),
];

const byId = new Map(FENCE_SECTIONS.map((s) => [s.id, s]));
export const fenceSection = (id: string) => byId.get(id);

export type FenceSpan = Pick<FenceSection, 'id' | 'side' | 'a' | 'b' | 'winter'>;

export function boardPoint(s: FenceSpan, t: number, elevation = 0) {
  const outward = s.side === 'left' ? -1 : s.side === 'right' ? 1 : 0;
  return projectGround(s.a.x + (s.b.x - s.a.x) * t + outward * (3 + elevation * .17),
    s.a.y + (s.b.y - s.a.y) * t, elevation);
}

function distanceToSpan(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

// Picking covers the raised timber, not just its thin ground collision line.
const pickSpans = FENCE_SECTIONS.map((s) => ({ s,
  spans: [0, 12, 28].map((h) => [boardPoint(s, 0, h), boardPoint(s, 1, h)] as const),
  middle: boardPoint(s, .5, 16),
}));

export function pickFenceSection(p: Point): FenceSection | null {
  let result: FenceSection | null = null;
  let best = Infinity;
  for (const { s, spans, middle } of pickSpans) {
    const d = Math.min(...spans.map(([a, b]) => distanceToSpan(p, a, b)));
    if (d > 15) continue;
    const score = d + .07 * Math.hypot(middle.x - p.x, middle.y - p.y);
    if (score < best) { result = s; best = score; }
  }
  if (result) return result;
  // Also allow clicking directly on the left/right service pad tiles
  for (const row of PAD_ROWS) {
    const cy = cellTop(row) + PAD_H / 2;
    for (const [side, x] of [['left', PLANT_PAD_X], ['right', MOD_PAD_X]] as const) {
      const center = projectGround(x, cy);
      if (Math.abs(p.x - center.x) <= PAD_W * .55 * center.scale && Math.abs(p.y - center.y) <= PAD_H * .55 * center.scale) {
        return fenceSection(`${side}-${row}`) ?? null;
      }
    }
  }
  return null;
}