import { CELL_W, COLS, DIVIDER_LEFT, DIVIDER_RIGHT, LAWN_BOTTOM, LAWN_RIGHT, LAWN_TOP, LAWN_X, ROWS, STAGE_H, cellTop, columnLeft } from './constants';
import { FIELD_VIEW, LAWN_CENTER, projectGround, unprojectX } from './perspective';

export interface Point { x: number; y: number }
export interface Cell { row: number; col: number }
export type WallId = 'left' | 'right' | 'back' | 'rail-left' | 'rail-right' | 'rail-end' | 'apron-left' | 'apron-right' | 'apron-end';
export interface Wall { id: WallId; a: Point; b: Point }
export interface WallHit { wall: Wall; point: Point; distance: number }

// Низкий проезжной порог шириной в одно поле: держит снаряды, но не косилку.
export const RAIL = { left: DIVIDER_LEFT, right: DIVIDER_RIGHT, far: LAWN_TOP - 3, near: LAWN_BOTTOM + 6, height: 3 };
const leftFar = projectGround(LAWN_X, LAWN_TOP);
const rightFar = projectGround(LAWN_RIGHT, LAWN_TOP);
const leftNear = projectGround(LAWN_X, LAWN_BOTTOM);
const rightNear = projectGround(LAWN_RIGHT, LAWN_BOTTOM);
const railLeftFar = projectGround(RAIL.left, RAIL.far, RAIL.height);
const railRightFar = projectGround(RAIL.right, RAIL.far, RAIL.height);
const railLeftNear = projectGround(RAIL.left - 1.7, RAIL.near);
const railRightNear = projectGround(RAIL.right + 1.7, RAIL.near);
const apronEnd = STAGE_H - 3;
const floorRows = Array.from({ length: ROWS + 1 }, (_, r) => projectGround(LAWN_CENTER, cellTop(r)).y);
const EPS = 1e-6;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// There is deliberately no wall across the near end: both lanes open onto the nursery.
export const WALLS: readonly Wall[] = [
  { id: 'left', a: leftFar, b: leftNear },
  { id: 'right', a: rightFar, b: rightNear },
  { id: 'back', a: leftFar, b: rightFar },
  { id: 'rail-left', a: railLeftFar, b: railLeftNear },
  { id: 'rail-right', a: railRightFar, b: railRightNear },
  { id: 'rail-end', a: railLeftNear, b: railRightNear },
  { id: 'apron-left', a: leftNear, b: { x: leftNear.x, y: apronEnd } },
  { id: 'apron-right', a: rightNear, b: { x: rightNear.x, y: apronEnd } },
  { id: 'apron-end', a: { x: leftNear.x, y: apronEnd }, b: { x: rightNear.x, y: apronEnd } },
];

export function rowAt(y: number) {
  for (let row = 0; row < ROWS - 1; row++) if (y < floorRows[row + 1]) return row;
  return ROWS - 1;
}

export function firstWall(from: Point, unit: Point, range: number, passesFences = false): WallHit | null {
  let first: WallHit | null = null;
  for (const wall of WALLS) {
    // Empty bolts pass the low metal limiter; the tall timber fence still blocks them.
    if (passesFences && wall.id.startsWith('rail-')) continue;
    const ex = wall.b.x - wall.a.x, ey = wall.b.y - wall.a.y;
    const ax = wall.a.x - from.x, ay = wall.a.y - from.y;
    const determinant = unit.x * ey - unit.y * ex;
    if (Math.abs(determinant) < EPS) {
      if (Math.abs(ax * unit.y - ay * unit.x) > EPS) continue;
      const a = ax * unit.x + ay * unit.y;
      const b = a + ex * unit.x + ey * unit.y;
      const distance = Math.max(0, Math.min(a, b));
      if (Math.max(a, b) < 0 || distance > range || (first && distance >= first.distance)) continue;
      first = { wall, distance, point: { x: from.x + unit.x * distance, y: from.y + unit.y * distance } };
      continue;
    }
    const t = (ax * ey - ay * ex) / determinant;
    const u = (ax * unit.y - ay * unit.x) / determinant;
    if (t < -EPS || t > range + EPS || u < -EPS || u > 1 + EPS || (first && t >= first.distance)) continue;
    const distance = Math.max(0, t);
    first = { wall, distance, point: { x: from.x + unit.x * distance, y: from.y + unit.y * distance } };
  }
  return first;
}

export function wallCell(hit: WallHit): Cell | null {
  const { id } = hit.wall;
  if (id.startsWith('apron')) return null;
  const row = rowAt(hit.point.y);
  if (id === 'back') {
    // The timber fence follows the plantable fields; above the divider there is no cell.
    const x = unprojectX(hit.point.x, hit.point.y);
    for (let col = 0; col < COLS; col++) {
      const left = columnLeft(col);
      if (x >= left && x <= left + CELL_W) return { row: 0, col };
    }
    return null;
  }
  if (id === 'left' || id === 'right') return { row, col: id === 'left' ? 0 : COLS - 1 };
  return { row, col: hit.point.x < LAWN_CENTER ? COLS / 2 - 1 : COLS / 2 };
}

export function firstWallBetween(from: Point, to: Point, passesFences = false): WallHit | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > EPS ? firstWall(from, { x: dx / length, y: dy / length }, length - EPS, passesFences) : null;
}

const atY = (a: Point, b: Point, y: number) => a.x + (b.x - a.x) * clamp((y - a.y) / (b.y - a.y), 0, 1);
export function fencePoint(cell: Cell): Point {
  const wall = WALLS.find((w) => w.id === (['left', 'rail-left', 'rail-right', 'right'] as const)[cell.col])!;
  const y = (floorRows[cell.row] + floorRows[cell.row + 1]) / 2;
  return { x: atY(wall.a, wall.b, y), y };
}

// The steel strip is a drive-over threshold. Only the perimeter constrains the
// chassis; WALLS still includes the strip for shots aimed at the inner lanes.
export const BODY_RADIUS = 34;
export const roverScale = (y: number) => .52 + .22 * clamp((y - FIELD_VIEW.farY) / (FIELD_VIEW.nearY - FIELD_VIEW.farY), 0, 1);
const wallInset = BODY_RADIUS * Math.hypot(1, (leftNear.x - leftFar.x) / (leftNear.y - leftFar.y));

export function driveBounds(y: number) {
  return {
    left: atY(leftFar, leftNear, y) + wallInset,
    right: atY(rightFar, rightNear, y) - wallInset,
  };
}

export function safeParking(p: Point): Point {
  const y = clamp(p.y, FIELD_VIEW.farY + BODY_RADIUS, apronEnd - BODY_RADIUS);
  const b = driveBounds(y);
  return { x: clamp(p.x, b.left, b.right), y };
}

export function moveInsideArena(_start: Point, end: Point): Point {
  // The two halves and their common apron now form one convex driving area.
  return safeParking(end);
}