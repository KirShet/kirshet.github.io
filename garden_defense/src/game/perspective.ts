import {
  CELL_W, COLS, LAWN_H, LAWN_RIGHT, LAWN_TOP, LAWN_W, LAWN_X, ROWS,
  STAGE_W, cellTop, columnLeft,
} from './constants';

export const LAWN_CENTER = (LAWN_X + LAWN_RIGHT) / 2;

export const FIELD_VIEW = {
  farY: 248,
  nearY: 990,
  nearWidth: 640,
  farRatio: 0.57,
} as const;

// A ground-plane homography keeps lane edges straight while shortening distant rows.
// Simulation coordinates stay rectangular; elevation is only a rendering offset.
export function projectGround(x: number, y: number, elevation = 0) {
  const { farY, nearY, nearWidth, farRatio } = FIELD_VIEW;
  const depth = (y - LAWN_TOP) / LAWN_H;
  const perspective = farRatio / Math.max(0.25, 1 - (1 - farRatio) * depth);
  const scale = (nearWidth / LAWN_W) * perspective;
  return {
    x: STAGE_W / 2 + (x - STAGE_W / 2) * scale,
    y: farY + (nearY - farY) * depth * perspective - elevation * scale,
    scale,
  };
}

// Inverse of the horizontal part of projectGround: screen X back to stage X.
export function unprojectX(x: number, y: number) {
  const { scale } = projectGround(LAWN_CENTER, y);
  return LAWN_CENTER + (x - STAGE_W / 2) / scale;
}

export function cellCorners(row: number, col: number) {
  const left = columnLeft(col);
  const right = left + CELL_W;
  return [
    projectGround(left, cellTop(row)),
    projectGround(right, cellTop(row)),
    projectGround(right, cellTop(row + 1)),
    projectGround(left, cellTop(row + 1)),
  ];
}

/** Клетка под точкой на экране (клик мышью по спроецированному полю). */
export function cellAtPoint(p: { x: number; y: number }): { row: number; col: number } | null {
  for (const tile of FIELD_TILES) {
    const c = tile.corners;
    let sign = 0;
    let inside = true;
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cross !== 0) {
        const sgn = cross > 0 ? 1 : -1;
        if (sign === 0) sign = sgn;
        else if (sign !== sgn) { inside = false; break; }
      }
    }
    if (inside) return { row: tile.row, col: tile.col };
  }
  return null;
}

// These very same polygons are both the visible tiles and their touch targets.
export const FIELD_TILES = Array.from({ length: ROWS * COLS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const corners = cellCorners(row, col);
  return {
    row, col, corners,
    points: corners.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' '),
  };
});