import { BOTTOM_BAR_H, COLS, PLANTS, STAGE_H, plantX, type Game, type PlantType, type SunDrop } from './constants';
import { firstWall, firstWallBetween, roverScale, wallCell, type Cell, type Point, type WallId } from './arenaGeometry';
import { projectGround } from './perspective';
import type { SmartMower } from './rover';

export type ShotKind = 'sun' | 'seed' | 'cell' | 'border' | 'zombie' | 'ground';
export type ShotPayload = { sunId: number } | { type: PlantType; source: Point } | { cell: Cell } | { zombieId: number } | { ground: Point };
export interface Contact {
  kind: ShotKind;
  point: Point;
  distance: number;
  payload: ShotPayload;
  wall?: WallId;
}
export interface Shot {
  id: number; kind: ShotKind; from: Point; to: Point; direction: Point;
  t: number; ttl: number; terminal: Contact; selection: number;
  passesDivider: boolean;
  damage?: number;
  slow?: boolean;
}
export interface SeedBox {
  type: PlantType; minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number;
}
export const SEED_CARD_ROW_Y = STAGE_H - BOTTOM_BAR_H + 58;
export const SEED_CARD_BOXES: SeedBox[] = PLANTS.map((p, i) => ({
  type: p.type, minX: 101 + i * 90, maxX: 183 + i * 90, centerX: 142 + i * 90,
  minY: STAGE_H - BOTTOM_BAR_H + 3, maxY: STAGE_H - 3, centerY: SEED_CARD_ROW_Y,
}));
export const SHOT_SPEED = 1200;
const RANGE = STAGE_H * 1.5;
const EPS = 1e-5;
const along = (from: Point, d: Point, t: number): Point => ({ x: from.x + d.x * t, y: from.y + d.y * t });
export const sunPoint = (s: SunDrop) => projectGround(s.x, s.ty, s.ty - s.y);
export const hasSelectedPlant = (r: SmartMower) => !!(r.order?.type || r.cargo);

export function muzzlePoint(r: SmartMower, passesFences = !hasSelectedPlant(r)): Point {
  const angle = r.heading * Math.PI / 180;
  const facing = { x: Math.sin(angle), y: -Math.cos(angle) };
  const length = (44 - r.recoilOffset) * roverScale(r.y);
  const wall = firstWall(r, facing, length, passesFences);
  return along(r, facing, wall ? Math.max(0, wall.distance - .2) : length);
}

function boxEntry(p: Point, d: Point, b: SeedBox): number {
  // Seed slots lie on a single picking line; adjacent UI buttons are not walls.
  if (Math.abs(d.y) < EPS) return Infinity;
  const t = (b.centerY - p.y) / d.y;
  const x = p.x + d.x * t;
  return t > EPS && x >= b.minX && x <= b.maxX ? t : Infinity;
}

// Use the same live, screen-space silhouettes for aiming and swept projectile hits.
export function firstEntity(g: Game, from: Point, direction: Point, range: number, passesFences = !hasSelectedPlant(g.rover)): Contact | null {
  let hit: Contact | null = null;
  let closest = range;
  const consider = (center: Point, radius: number, kind: ShotKind, payload: ShotPayload) => {
    const dx = center.x - from.x, dy = center.y - from.y;
    const projection = dx * direction.x + dy * direction.y;
    const offset = dx * direction.y - dy * direction.x;
    if (Math.abs(offset) > radius) return;
    const halfChord = Math.sqrt(Math.max(0, radius * radius - offset * offset));
    const entry = Math.max(0, projection - halfChord);
    if (projection + halfChord < 0 || entry > closest + EPS) return;
    if (firstWallBetween(from, center, passesFences)) return;
    closest = entry;
    hit = { kind, distance: entry, point: along(from, direction, entry), payload };
  };
  for (const s of g.suns) {
    if (s.collected) continue;
    const p = sunPoint(s);
    consider(p, 34 * p.scale, 'sun', { sunId: s.id });
  }
  for (const z of g.zombies) {
    if (z.dieT !== null) continue;
    const p = projectGround(plantX(z.col), z.y, 65);
    consider(p, 34 * p.scale, 'zombie', { zombieId: z.id });
  }
  return hit;
}

export function traceFlight(g: Game, aim: Point, maxRange = RANGE, fencesSolid = hasSelectedPlant(g.rover)) {
  const passesFences = !fencesSolid;
  const from = muzzlePoint(g.rover, passesFences);
  const length = Math.hypot(aim.x, aim.y);
  const facing = g.rover.heading * Math.PI / 180;
  const direction = length > EPS && Number.isFinite(length)
    ? { x: aim.x / length, y: aim.y / length }
    : { x: Math.sin(facing), y: -Math.cos(facing) };
  const limit = Math.max(0, Math.min(RANGE, maxRange));
  const wall = firstWall(from, direction, limit, passesFences);
  const cell = wall && wallCell(wall);
  const end = wall?.point ?? along(from, direction, limit);
  let terminal: Contact = {
    kind: cell ? 'border' : 'ground', point: end, distance: wall?.distance ?? limit,
    payload: cell ? { cell } : { ground: end }, wall: wall?.wall.id,
  };
  for (const card of g.rover.seedBoxes) {
    const distance = boxEntry(from, direction, card);
    if (distance >= terminal.distance - EPS) continue;
    terminal = { kind: 'seed', point: along(from, direction, distance), distance,
      payload: { type: card.type, source: { x: card.centerX, y: card.centerY } } };
  }
  const entity = firstEntity(g, from, direction, terminal.distance, passesFences);
  return { from, direction, terminal, passesDivider: passesFences, hit: entity && entity.distance < terminal.distance - EPS ? entity : terminal };
}

export function launchShot(g: Game, aim: Point, maxRange?: number): Shot {
  const { from, direction, terminal, hit, passesDivider } = traceFlight(g, aim, maxRange);
  return {
    id: g.nextId++, kind: hit.kind, from, to: terminal.point, direction,
    t: 0, ttl: Math.max(.001, terminal.distance / SHOT_SPEED), terminal,
    selection: g.rover.selection,
    // Keep the firing mode even if the player switches seeds during flight.
    passesDivider,
  };
}

export function isFenceCell(cell: Cell) {
  return cell.row === 0 || [0, COLS / 2 - 1, COLS / 2, COLS - 1].includes(cell.col);
}