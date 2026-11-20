import { COLS, LAWN_RIGHT, LAWN_X, MOD_PADS, MOD_PAD_X, PAD_ROWS, PLANT_MAP, PLANT_PADS, PLANT_PAD_X, STAGE_W, SUN_VALUE, plantX, plantY, type Game, type GameEvent, type MowerMod, type PlantType } from './constants';
import { FIELD_VIEW, projectGround } from './perspective';
import { isCell, plantAt, tryPlant } from './planting';
import { firstWallBetween, moveInsideArena, roverScale, safeParking, type Cell, type Point } from './arenaGeometry';
import { firstEntity, isFenceCell, launchShot, muzzlePoint, SEED_CARD_BOXES, SHOT_SPEED, sunPoint, traceFlight, type Contact, type SeedBox, type Shot, type ShotKind, type ShotPayload } from './cannon';
import { fenceSection, type FenceSection } from './fence';
import { acquireMod } from './mowerMods';

export type { Point, Cell } from './arenaGeometry';
export { roverScale } from './arenaGeometry';
export { muzzlePoint, SEED_CARD_ROW_Y, SEED_CARD_BOXES, SHOT_SPEED, type Shot, type ShotKind, type ShotPayload } from './cannon';
export type RoverPhase = 'idle' | 'to-card' | 'loading' | 'carrying' | 'to-cell' | 'planting' | 'to-sun' | 'collecting' | 'returning' | 'to-fence' | 'at-fence';
type DrivePhase = 'to-card' | 'to-cell' | 'to-sun' | 'returning' | 'to-fence';
type CommandResult = 'ok' | 'busy' | 'funds' | 'cooldown' | 'occupied' | 'invalid';
interface SeedOrder { type: PlantType; source: Point; cell: Cell | null }
interface Route { start: Point; control: Point; end: Point; duration: number }

export interface SmartMower extends Point {
  phase: RoverPhase;
  age: number;
  heading: number;         // 0 = forward (up), 90 = right, 180 = down, 270 = left
  angularVel: number;      // rotational velocity (deg/s)
  vx: number;              // physics velocity X (px/s)
  vy: number;              // physics velocity Y (px/s)
  odometer: number;
  slip: number;            // wheelspin timer
  leafT: number;           // autumn leaf timer
  flashT: number;          // laser muzzle flash timer
  recoilOffset: number;    // physical kickback translation (pixels)
  thrusting: boolean;      // thruster active
  braking: boolean;        // brake active
  drifting: boolean;       // drift sliding active
  speed: number;           // scalar speed hypot(vx, vy)
  manualMove: Point;       // Left stick / WASD directional vector
  thrustHeld: { key: boolean; mouse: boolean };
  manualAim: Point | null; // Right stick / mouse aiming vector
  cursorPoint: Point | null;
  wasMoving: boolean;
  route: Route | null;
  order: SeedOrder | null;
  selection: number;
  plantingMark: (Cell & { type: PlantType }) | null;
  padMark: { side: 'plant' | 'mod'; row: number; type: PlantType } | null;
  fenceOrder: { section: FenceSection; remaining: number } | null;
  seedBoxes: SeedBox[];
  mod: MowerMod | null;
  cargo: PlantType | null;
  prepaidType: PlantType | null;
  lastX: number;
  lastY: number;
  sunQueue: number[];
  activeSun: number | null;
  feedback: { kind: 'sun' | 'plant'; at: Point; age: number } | null;
}

export const ROVER_HOME = { x: STAGE_W / 2, y: FIELD_VIEW.nearY + 51 };
export const LOAD_TIME = .54;
export const PLANT_TIME = .52;
export const COLLECT_TIME = .36;
export const TRANSFER_TIME = .46;

// Physics constants tuned from Striker (ШТУРМОВИК)
export const MANUAL_SPEED = 630;
export const AUTO_SPEED = 940;
export const STRIKER_THRUST = 1850;   // px/s^2 forward acceleration
export const STRIKER_RECOIL = 185;    // px/s instantaneous backward kickback on shot
export const STRIKER_TURN_RATE = 420; // deg/s steering rate

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const ease = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const canWork = (g: Game) => g.status === 'playing' || g.status === 'ready';
const isWinterSide = (x: number) => x < STAGE_W / 2;
const isAutumnSide = (x: number) => x > STAGE_W / 2;

export function createRover(): SmartMower {
  return {
    ...ROVER_HOME,
    heading: 15,
    angularVel: 0,
    vx: 0,
    vy: 0,
    odometer: 0,
    slip: 0,
    leafT: 0,
    flashT: 0,
    recoilOffset: 0,
    thrusting: false,
    braking: false,
    drifting: false,
    speed: 0,
    manualMove: { x: 0, y: 0 },
    thrustHeld: { key: false, mouse: false },
    manualAim: null,
    cursorPoint: null,
    wasMoving: false,
    phase: 'idle',
    age: 0,
    route: null,
    order: null,
    selection: 0,
    plantingMark: null,
    padMark: null,
    fenceOrder: null,
    seedBoxes: SEED_CARD_BOXES.map((box) => ({ ...box })),
    mod: null,
    cargo: null,
    prepaidType: null,
    lastX: ROVER_HOME.x,
    lastY: ROVER_HOME.y,
    sunQueue: [],
    activeSun: null,
    feedback: null,
  };
}

export function cargoMount(r: SmartMower): Point {
  const angle = r.heading * Math.PI / 180;
  const scale = roverScale(r.y);
  return { x: r.x + Math.sin(angle) * 19 * scale, y: r.y - (4 + Math.cos(angle) * 19) * scale };
}

export const plantingPoint = (cell: Cell) => projectGround(plantX(cell.col), plantY(cell.row));

export function clearPilotInput(r: SmartMower) {
  r.manualMove = { x: 0, y: 0 };
  r.thrustHeld.key = r.thrustHeld.mouse = false;
  r.manualAim = r.cursorPoint = null;
}

function stop(r: SmartMower, phase: RoverPhase) {
  r.phase = phase;
  r.route = null;
  r.age = 0;
  r.thrusting = false;
  r.braking = false;
}

function steer(r: SmartMower, targetAngleDeg: number, dt: number, rate: number) {
  const turn = ((targetAngleDeg - r.heading + 540) % 360 + 360) % 360 - 180;
  r.heading += turn * (1 - Math.exp(-rate * dt));
}

// Autonomous routes use the unscaled stage coordinates
function drive(g: Game, r: SmartMower, phase: DrivePhase, destination: Point) {
  const end = safeParking(destination);
  const start = { x: r.x, y: r.y };
  const length = distance(start, end);
  const speed = g.auto ? AUTO_SPEED : MANUAL_SPEED;
  const control = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  r.phase = phase;
  r.age = 0;
  r.slip = g.auto && isWinterSide(end.x) ? .42 : 0;
  r.vx = r.vy = 0;
  r.route = { start, control, end, duration: Math.max(.16, length / speed + .14) };
}

function dispatch(g: Game) {
  const r = g.rover;
  if (r.order && !r.cargo) {
    // Cards are in the bottom tray now, so the loading bay is just above it.
    drive(g, r, 'to-card', { x: Math.max(LAWN_X + 30, Math.min(LAWN_RIGHT - 30, r.order.source.x)), y: ROVER_HOME.y });
    return;
  }
  if (r.order?.cell && r.cargo) {
    const p = plantingPoint(r.order.cell);
    drive(g, r, 'to-cell', { x: p.x + (r.order.cell.col % 2 ? -1 : 1) * 49 * p.scale, y: p.y + 6 * p.scale });
    return;
  }
  while (r.sunQueue.length) {
    const id = r.sunQueue.shift()!;
    const sun = g.suns.find((s) => s.id === id && !s.collected);
    if (!sun) continue;
    const p = projectGround(sun.x, sun.ty);
    r.activeSun = id;
    drive(g, r, 'to-sun', { x: p.x, y: p.y + 13 * p.scale });
    return;
  }
  stop(r, r.cargo ? 'carrying' : 'idle');
}

function refundPadPurchase(g: Game, r: SmartMower) {
  if (!r.prepaidType) return;
  g.sun += PLANT_MAP[r.prepaidType].cost;
  // An unused purchase does not consume the seed's cooldown.
  g.cds[r.prepaidType] = 0;
  r.prepaidType = null;
}
const isPrepaid = (r: SmartMower, type: PlantType) => r.prepaidType === type;

function placeSelectedPlant(g: Game, row: number, col: number, point: Point, events: GameEvent[]) {
  const r = g.rover;
  const type = r.order?.type ?? r.cargo;
  if (!type || !isCell(row, col) || plantAt(g, row, col)) return false;
  const prepaid = isPrepaid(r, type);
  if (!prepaid && (g.sun < PLANT_MAP[type].cost || g.cds[type] > 0)) return false;
  if (!tryPlant(g, type, row, col, prepaid)) return false;
  r.feedback = { kind: 'plant', at: point, age: 0 };
  r.order = r.cargo = null;
  r.prepaidType = null;
  clearPlantingMark(g);
  if (r.activeSun === null) dispatch(g);
  events.push({ type: 'plant' });
  return true;
}

export function requestSeed(g: Game, type: PlantType | null, source: Point): CommandResult {
  const r = g.rover;
  if (!canWork(g)) return 'invalid';
  if (type && (!Number.isFinite(source.x) || !Number.isFinite(source.y))) return 'invalid';
  if (r.order?.cell) return 'busy';
  if (type && r.cargo === type && isPrepaid(r, type)) return 'ok';
  if (type && !isPrepaid(r, type) && g.cds[type] > 0) return 'cooldown';
  if (type && !isPrepaid(r, type) && g.sun < PLANT_MAP[type].cost) return 'funds';
  refundPadPurchase(g, r);
  r.plantingMark = null;
  r.padMark = null;
  r.fenceOrder = null;
  r.selection++;
  r.order = type ? { type, source: { ...source }, cell: null } : null;
  r.cargo = null;
  if (r.activeSun === null) dispatch(g);
  return 'ok';
}

// A pad purchase is paid up front: the plant rides on the mower until planted.
function buyPadPlant(g: Game, type: PlantType, at: Point) {
  const r = g.rover;
  const def = PLANT_MAP[type];
  g.sun -= def.cost;
  g.cds[type] = def.cooldown;
  r.plantingMark = null;
  r.padMark = null;
  r.fenceOrder = null;
  r.selection++;
  r.order = { type, source: { ...at }, cell: null };
  r.cargo = type;
  r.prepaidType = type;
  r.feedback = { kind: 'plant', at, age: 0 };
  return true;
}

/** Проезд по площадке больше не покупает растение: выбор делается двумя выстрелами в забор. */
export function updateServicePads(_g: Game, _events: GameEvent[]) {
  // No-op: selection is now triggered exclusively by shooting the fence twice.
}

/** Растение едет на косилке к выбранной клетке (автопилот). */
export function requestPlanting(g: Game, row: number, col: number): CommandResult {
  const r = g.rover;
  if (!canWork(g) || !isCell(row, col) || !r.order) return 'invalid';
  if (r.phase === 'planting') return 'busy';
  if (plantAt(g, row, col)) return 'occupied';
  if (!isPrepaid(r, r.order.type)) {
    if (g.sun < PLANT_MAP[r.order.type].cost) return 'funds';
    if (g.cds[r.order.type] > 0) return 'cooldown';
  }
  if (r.order.cell?.row === row && r.order.cell.col === col) return 'ok';
  r.order.cell = { row, col };
  if (r.cargo && r.activeSun === null) dispatch(g);
  return 'ok';
}

/** Автопилот сам подъезжает к солнышку. */
export function requestSun(g: Game, id: number): boolean {
  const s = g.suns.find((sun) => sun.id === id);
  if (!canWork(g) || !s || s.collected || s.reserved) return false;
  s.reserved = true;
  g.rover.sunQueue.push(id);
  if (['idle', 'carrying', 'returning', 'at-fence'].includes(g.rover.phase)) dispatch(g);
  return true;
}

function commitShot(g: Game, shot: Shot, events: GameEvent[]) {
  const r = g.rover;
  if (r.phase === 'to-fence') stop(r, r.cargo ? 'carrying' : 'idle');
  r.fenceOrder = null;
  g.shots.push(shot);
  r.vx -= shot.direction.x * STRIKER_RECOIL;
  r.vy -= shot.direction.y * STRIKER_RECOIL;
  r.recoilOffset = 8.5;
  r.flashT = .18;
  events.push({ type: 'laser' });
}

/** Лёгкий снаряд модуля косилки: летит точно в зомби, сквозь ограничитель. */
export function fireBolt(g: Game, zombieId: number, damage: number, slow: boolean, spread: number, events: GameEvent[]) {
  if (!canWork(g) || !g.auto) return false;
  const zombie = g.zombies.find((z) => z.id === zombieId && z.dieT === null);
  if (!zombie) return false;
  const from = muzzlePoint(g.rover, true);
  const point = projectGround(plantX(zombie.col), zombie.y, 65);
  const to = { x: point.x + spread, y: point.y };
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  commitShot(g, {
    id: g.nextId++, kind: 'zombie', from, to,
    direction: { x: (to.x - from.x) / length, y: (to.y - from.y) / length },
    t: 0, ttl: Math.max(.04, length / SHOT_SPEED),
    terminal: { kind: 'zombie', point, distance: length, payload: { zombieId } },
    selection: g.rover.selection, passesDivider: true, damage, slow,
  }, events);
  return true;
}

function shoot(g: Game, aim: Point, events: GameEvent[], range?: number): boolean {
  if (!canWork(g) || !g.auto || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return false;
  commitShot(g, launchShot(g, aim, range), events);
  return true;
}

export function fireDirectionalCannon(g: Game, dx: number, dy: number, events: GameEvent[]) {
  return shoot(g, { x: dx, y: dy }, events);
}

function canHitSection(g: Game, s: FenceSection) {
  const from = muzzlePoint(g.rover);
  const { terminal } = traceFlight(g, { x: s.target.x - from.x, y: s.target.y - from.y });
  return terminal.wall === s.side && 'cell' in terminal.payload &&
    terminal.payload.cell.row === s.cell.row && terminal.payload.cell.col === s.cell.col;
}

export function requestFenceCommand(g: Game, id: string, events: GameEvent[]): CommandResult {
  const s = fenceSection(id);
  if (!canWork(g) || !s) return 'invalid';
  const r = g.rover;
  if (!g.auto) {
    if (r.order) return requestPlanting(g, s.cell.row, s.cell.col);
    if (r.activeSun !== null) return 'busy';
    r.fenceOrder = { section: s, remaining: 0 };
    drive(g, r, 'to-fence', s.parking);
    return 'ok';
  }
  r.cursorPoint = { ...s.target };
  if (r.fenceOrder?.section.id === id) {
    r.fenceOrder.remaining = Math.min(2, r.fenceOrder.remaining + 1);
    return 'ok';
  }
  if (canHitSection(g, s)) return fireShot(g, 'border', s.target, { cell: s.cell }, events) ? 'ok' : 'invalid';
  // Planting shots respect the divider; ordinary shots need no positioning detour.
  r.fenceOrder = { section: s, remaining: 1 };
  drive(g, r, 'to-fence', s.parking);
  return 'ok';
}

export function fireShot(g: Game, kind: ShotKind, target: Point, payload: ShotPayload, events: GameEvent[]) {
  let to = target;
  if (kind === 'sun' && 'sunId' in payload) {
    const sun = g.suns.find((s) => s.id === payload.sunId && !s.collected);
    if (!sun) return false;
    to = sunPoint(sun);
  } else if (kind === 'seed' && 'type' in payload) {
    const card = g.rover.seedBoxes.find((b) => b.type === payload.type);
    if (!card) return false;
    to = { x: card.centerX, y: card.centerY };
  } else if (kind === 'cell' && 'cell' in payload) {
    if (!isCell(payload.cell.row, payload.cell.col)) return false;
    // Прямой приказ: снаряд летит к клетке сквозь ограничитель.
    return shootDirect(g, plantingPoint(payload.cell), kind, payload, events);
  }
  const from = muzzlePoint(g.rover);
  const d = { x: to.x - from.x, y: to.y - from.y };
  // A click supplies a direction, never permission to reach a target through a wall.
  const length = Math.hypot(d.x, d.y);
  const fired = shoot(g, d, events, length + .1);
  if (fired && length > .001) {
    g.rover.cursorPoint = { ...to };
    g.rover.manualAim = { x: d.x / length, y: d.y / length };
  }
  return fired;
}

/** Выстрел-приказ: летит точно в цель сквозь стены (размещение по клику на клетку). */
function shootDirect(g: Game, to: Point, kind: ShotKind, payload: ShotPayload, events: GameEvent[]): boolean {
  if (!canWork(g) || !g.auto) return false;
  const from = muzzlePoint(g.rover, true);
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 6) return false;
  const direction = { x: dx / length, y: dy / length };
  commitShot(g, {
    id: g.nextId++, kind, from, to: { ...to }, direction,
    t: 0, ttl: Math.max(.04, length / SHOT_SPEED),
    terminal: { kind, point: { ...to }, distance: length, payload },
    selection: g.rover.selection, passesDivider: true,
  }, events);
  g.rover.cursorPoint = { ...to };
  g.rover.manualAim = direction;
  return true;
}

function clearPlantingMark(g: Game) {
  g.rover.plantingMark = null;
  g.rover.padMark = null;
  g.rover.selection++;
}

/** Выстрел в свободное поле без выбранного растения идёт сквозь межсезонную стену. */
export function fireAtField(g: Game, target: Point, events: GameEvent[]): boolean {
  if (!canWork(g) || !g.auto) return false;
  const from = muzzlePoint(g.rover);
  const dx = target.x - from.x, dy = target.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 6) return false;
  const direction = { x: dx / length, y: dy / length };
  const entity = firstEntity(g, from, direction, length);
  const shot = launchShot(g, { x: dx, y: dy }, (entity ? entity.distance : length) + 1);
  // The tapped field is the landing point only when nothing opaque is in front of it.
  const reachedField = !entity && (shot.terminal.kind === 'ground' || shot.terminal.distance >= length - 2);
  if (reachedField) {
    shot.terminal = { kind: 'ground', point: { ...target }, distance: length, payload: { ground: { ...target } } };
    shot.to = { ...target };
    shot.ttl = Math.max(.012, length / SHOT_SPEED);
  }
  commitShot(g, shot, events);
  return true;
}

export function setPilotMode(g: Game, manual: boolean) {
  if (!canWork(g) || g.auto === manual) return;
  const r = g.rover;
  g.auto = manual;
  clearPlantingMark(g);
  g.shots = [];
  clearPilotInput(r);
  r.fenceOrder = null;
  r.vx = r.vy = r.slip = 0;
  r.activeSun = null;
  r.sunQueue = [];
  g.suns.forEach((s) => { s.reserved = false; });
  if (r.order) r.order.cell = null;
  if (!r.cargo) {
    refundPadPurchase(g, r);
    r.order = null;
  }
  stop(r, r.cargo ? 'carrying' : 'idle');
}

function applyContact(g: Game, hit: Contact, selection: number, events: GameEvent[], shot?: Shot) {
  const r = g.rover;
  const payload = hit.payload;
  if (hit.kind === 'sun' && 'sunId' in payload) {
    const s = g.suns.find((sun) => sun.id === payload.sunId);
    if (!s || s.collected) return;
    s.collected = s.paidOnHit = true;
    s.collectT = 0;
    s.reserved = false;
    s.fx = hit.point.x;
    s.fy = hit.point.y;
    g.sun += SUN_VALUE;
    r.sunQueue = r.sunQueue.filter((id) => id !== s.id);
    if (r.activeSun === s.id) { r.activeSun = null; dispatch(g); }
    r.feedback = { kind: 'sun', at: hit.point, age: 0 };
    events.push({ type: 'collect' });
    return;
  }
  if (hit.kind === 'seed' && 'type' in payload) {
    if (requestSeed(g, payload.type, payload.source) !== 'ok') { events.push({ type: 'error' }); return; }
    if (g.auto) {
      r.cargo = payload.type;
      stop(r, 'carrying');
      r.slip = 0;
      events.push({ type: 'loaded' });
    }
    return;
  }
  if (hit.kind === 'zombie' && 'zombieId' in payload) {
    const z = g.zombies.find((z) => z.id === payload.zombieId && z.dieT === null);
    if (!z) return;
    z.hp -= shot?.damage ?? 50;
    if (shot?.slow) z.slowT = Math.max(z.slowT, 4.5);
    z.flashT = .12;
    g.fxs.push({ id: g.nextId++, kind: 'laserhit', ...hit.point, stageSpace: true, t: 0, ttl: .25 });
    events.push({ type: 'splat' });
    if (z.hp <= 0) { z.dieT = 0; z.eatingId = null; g.killed++; events.push({ type: 'zdie' }); }
    return;
  }
  g.fxs.push({ id: g.nextId++, kind: 'spark', ...hit.point, stageSpace: true, t: 0, ttl: .24 });
  if ((hit.kind !== 'border' && hit.kind !== 'cell') || !('cell' in payload) || selection !== r.selection) return;
  const { row, col } = payload.cell;
  const type = r.order?.type ?? r.cargo;
  if (!type) {
    // Выбор растения/способности делается только выстрелом в боковой забор.
    if (hit.kind !== 'border') return;
    // Shooting the side fence without a selected plant targets the adjacent plant/ability pad (2 shots)
    const padIdx = PAD_ROWS.indexOf(row);
    const isLeft = col === 0 && hit.wall === 'left';
    const isRight = col === COLS - 1 && hit.wall === 'right';
    if (padIdx === -1 || (!isLeft && !isRight)) return;
    const side: 'plant' | 'mod' = isLeft ? 'plant' : 'mod';
    const pad = (isLeft ? PLANT_PADS : MOD_PADS)[padIdx];
    if (!pad) return;
    if (side === 'plant') {
      const def = PLANT_MAP[pad.type];
      if (g.cds[pad.type] > 0 || g.sun < def.cost) {
        r.padMark = null;
        events.push({ type: 'error' });
        return;
      }
    }
    const pMark = r.padMark;
    if (!pMark || pMark.side !== side || pMark.row !== row || pMark.type !== pad.type) {
      r.padMark = { side, row, type: pad.type };
      events.push({ type: 'marked' });
      return;
    }
    r.padMark = null;
    const at = projectGround(isLeft ? PLANT_PAD_X : MOD_PAD_X, pad.y);
    if (side === 'plant') {
      buyPadPlant(g, pad.type, at);
      events.push({ type: 'loaded' });
    } else {
      acquireMod(g, pad.type);
      r.feedback = { kind: 'plant', at, age: 0 };
      events.push({ type: 'loaded' });
    }
    return;
  }
  const blocked = !isPrepaid(r, type) && (g.cds[type] > 0 || g.sun < PLANT_MAP[type].cost);
  // Клик по клетке сажает в любую клетку; выстрел в забор — только в соседнюю с ним.
  const badTarget = !isCell(row, col) || plantAt(g, row, col) || blocked ||
    (hit.kind === 'border' && !isFenceCell(payload.cell));
  if (badTarget) {
    r.plantingMark = null;
    events.push({ type: 'error' });
    return;
  }
  const mark = r.plantingMark;
  if (!mark || mark.type !== type || mark.row !== row || mark.col !== col) {
    r.plantingMark = { row, col, type };
    events.push({ type: 'marked' });
    return;
  }
  placeSelectedPlant(g, row, col, plantingPoint(payload.cell), events);
}

export function advanceShots(g: Game, dt: number, events: GameEvent[]) {
  if (!canWork(g)) return;
  // Process in launch order. Two pellets reaching a cell in one tick are two impacts.
  g.shots = g.shots.filter((shot) => {
    const length = shot.terminal.distance;
    const previous = Math.min(1, shot.t / shot.ttl) * length;
    shot.t += dt;
    const next = Math.min(1, shot.t / shot.ttl) * length;
    const start = { x: shot.from.x + shot.direction.x * previous, y: shot.from.y + shot.direction.y * previous };
    const movingHit = firstEntity(g, start, shot.direction, next - previous, shot.passesDivider);
    if (movingHit && previous + movingHit.distance < length - .00001) {
      applyContact(g, movingHit, shot.selection, events, shot);
      return false;
    }
    if (shot.t >= shot.ttl) {
      applyContact(g, shot.terminal, shot.selection, events, shot);
      return false;
    }
    return true;
  });
}

// Main Rover Physics & Automation Tick
export function advanceRover(g: Game, dt: number, events: GameEvent[]) {
  if (!canWork(g)) return;
  const r = g.rover;
  const frameUnits = dt * 60;
  if (g.auto && r.cursorPoint) {
    const from = muzzlePoint(r);
    const dx = r.cursorPoint.x - from.x, dy = r.cursorPoint.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) r.manualAim = { x: dx / d, y: dy / d };
  }

  // Visual timers
  if (r.flashT > 0) r.flashT = Math.max(0, r.flashT - dt);
  r.recoilOffset *= Math.pow(0.76, frameUnits);
  if (r.feedback) {
    r.feedback.age += dt;
    if (r.feedback.age >= .9) r.feedback = null;
  }

  // Wheelspin on autonomous route start on winter side
  if (r.route && r.slip > 0) {
    r.slip = Math.max(0, r.slip - dt);
    r.odometer += 820 * dt;
    r.heading += Math.sin(r.odometer / 2.1) * 2.4 * dt;
    if (r.slip + dt >= .42 || Math.random() < dt * 34) {
      g.fxs.push({
        id: g.nextId++, kind: 'dust',
        x: r.x + (Math.random() - .5) * 70, y: r.y + (Math.random() - .5) * 18,
        elevation: 2, t: 0, ttl: .42,
      });
    }
    return;
  }

  // Universal state timer advancement
  r.age += dt;

  // ============================================================
  // STRIKER (ШТУРМОВИК) INERTIAL DRIFT PHYSICS
  // ============================================================
  const moveLen = Math.hypot(r.manualMove.x, r.manualMove.y);
  // W and LMB are two sources of the same throttle, never additive thrust.
  const throttle = r.thrustHeld.key || r.thrustHeld.mouse ? 1 : Math.min(1, moveLen);
  const hasManualMove = g.auto && throttle > 0.04;
  const isWinter = isWinterSide(r.x);

  // Surface friction: Winter is icy (low drag -> strong drift!), Autumn is leaf-carpeted
  const surfaceDrag = isWinter ? 0.985 : 0.942;

  if (hasManualMove) {
    if (r.phase === 'to-fence') {
      r.fenceOrder = null;
      stop(r, r.cargo ? 'carrying' : 'idle');
    }
    r.route = null;

    // Winter initial wheelspin when starting from standstill
    const currentSpeed = Math.hypot(r.vx, r.vy);
    if (!r.wasMoving && currentSpeed < 40 && isWinter) {
      r.slip = 0.38;
    }

    r.wasMoving = true;
    r.thrusting = true;

    // Steering toward joystick direction or aim
    if (r.manualAim && Math.hypot(r.manualAim.x, r.manualAim.y) > 0.1) {
      const aimDeg = Math.atan2(r.manualAim.x, -r.manualAim.y) * 180 / Math.PI;
      steer(r, aimDeg, dt, 18);
    } else if (moveLen > 0.04) {
      const moveDeg = Math.atan2(r.manualMove.x, -r.manualMove.y) * 180 / Math.PI;
      steer(r, moveDeg, dt, 15);
    }

    // Forward thrust acceleration
    const facingRad = r.heading * Math.PI / 180;
    const fx = Math.sin(facingRad);
    const fy = -Math.cos(facingRad);

    let thrustPower = STRIKER_THRUST * throttle;
    if (r.slip > 0) {
      r.slip = Math.max(0, r.slip - dt);
      r.odometer += 820 * dt;
      thrustPower *= 0.15; // reduced traction during wheelspin
      if (Math.random() < dt * 28) {
        g.fxs.push({
          id: g.nextId++, kind: 'dust',
          x: r.x + (Math.random() - .5) * 65, y: r.y + (Math.random() - .5) * 16,
          elevation: 2, t: 0, ttl: .42,
        });
      }
    }

    r.vx += fx * thrustPower * dt;
    r.vy += fy * thrustPower * dt;
    r.odometer += currentSpeed * dt;

    // Autumn leaves thrown by thruster / treads
    if (isAutumnSide(r.x)) {
      r.leafT += dt;
      if (r.leafT >= 0.08) {
        r.leafT = 0;
        g.fxs.push({
          id: g.nextId++, kind: 'leaf',
          x: r.x + (Math.random() - .5) * 58, y: r.y + (Math.random() - .5) * 14,
          elevation: 5, t: 0, ttl: .85,
        });
      }
    }
  } else {
    r.wasMoving = false;
    r.thrusting = false;
    if (g.auto && r.manualAim && Math.hypot(r.manualAim.x, r.manualAim.y) > 0.1) {
      const aimDeg = Math.atan2(r.manualAim.x, -r.manualAim.y) * 180 / Math.PI;
      steer(r, aimDeg, dt, 18);
    }
  }

  // Apply inertial drag
  const dragFactor = Math.pow(surfaceDrag, frameUnits);
  r.vx *= dragFactor;
  r.vy *= dragFactor;

  if (!r.route && (hasManualMove || Math.hypot(r.vx, r.vy) > 1)) {
    const wanted = { x: r.x + r.vx * dt, y: r.y + r.vy * dt };
    const next = moveInsideArena(r, wanted);
    if (Math.abs(next.x - wanted.x) > .01) r.vx = 0;
    if (Math.abs(next.y - wanted.y) > .01) r.vy = 0;
    r.x = next.x;
    r.y = next.y;
  }

  r.speed = Math.hypot(r.vx, r.vy);

  // Drift detection: velocity angle vs ship heading
  if (r.speed > 120) {
    const moveDeg = (Math.atan2(r.vx, -r.vy) * 180 / Math.PI + 360) % 360;
    const faceDeg = (r.heading % 360 + 360) % 360;
    const diff = Math.abs(((moveDeg - faceDeg + 540) % 360) - 180);
    r.drifting = diff > 26;

    // Spawn drift sparks when sliding sideways at high speed
    if (r.drifting && Math.random() < dt * 18) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const angle = r.heading * Math.PI / 180 + Math.PI / 2 * side;
      g.fxs.push({
        id: g.nextId++,
        kind: 'spark',
        x: r.x + Math.sin(angle) * 32,
        y: r.y - Math.cos(angle) * 32,
        elevation: 4,
        t: 0,
        ttl: 0.22,
      });
    }
  } else {
    r.drifting = false;
  }

  // Vacuum proximity collection when manually driving over a landed sun
  if (hasManualMove || r.speed > 60) {
    for (const s of g.suns) {
      if (s.landed && !s.collected && !s.reserved) {
        const p = projectGround(s.x, s.ty);
        const d = Math.hypot(p.x - r.x, p.y - r.y);
        if (d < 52 && !firstWallBetween(r, p)) {
          s.collected = true;
          s.collectT = 0;
          s.fx = r.x;
          s.fy = r.y;
          r.feedback = { kind: 'sun', at: { x: r.x, y: r.y }, age: 0 };
          events.push({ type: 'collect' });
        }
      }
    }
  }

  // ============================================================
  // AUTONOMOUS ROUTE EXECUTION (when not using manual joystick)
  // ============================================================
  if (r.route && !hasManualMove) {
    const { start, control, end, duration } = r.route;
    const t = ease(r.age / duration);
    const a = 1 - t;
    const x = a * a * start.x + 2 * a * t * control.x + t * t * end.x;
    const y = a * a * start.y + 2 * a * t * control.y + t * t * end.y;
    const dx = x - r.x, dy = y - r.y;
    r.odometer += Math.hypot(dx, dy);
    if (Math.abs(dx) + Math.abs(dy) > .015) {
      const headingDeg = Math.atan2(dx, -dy) * 180 / Math.PI;
      steer(r, headingDeg, dt, 14);
    }
    if (r.phase === 'to-fence') r.speed = Math.hypot(dx, dy) / dt;
    const next = moveInsideArena(r, { x, y });
    r.x = next.x;
    r.y = next.y;

    if (g.auto && isAutumnSide(x)) {
      r.leafT += dt;
      if (r.leafT >= .075) {
        r.leafT = 0;
        g.fxs.push({
          id: g.nextId++, kind: 'leaf',
          x: r.x + (Math.random() - .5) * 58, y: r.y + (Math.random() - .5) * 14,
          elevation: 5, t: 0, ttl: .85,
        });
      }
    }

    if (r.age >= duration) {
      if (r.phase === 'to-fence' && r.fenceOrder) {
        const { section, remaining } = r.fenceOrder;
        stop(r, !g.auto ? 'at-fence' : r.cargo ? 'carrying' : 'idle');
        r.fenceOrder = null;
        r.heading = Math.atan2(section.target.x - r.x, r.y - section.target.y) * 180 / Math.PI;
        for (let i = 0; i < remaining; i++) fireShot(g, 'border', section.target, { cell: section.cell }, events);
        if (!g.auto && r.sunQueue.length) dispatch(g);
        return;
      }
      const arrival = r.phase === 'to-card' ? 'loading' : r.phase === 'to-cell' ? 'planting' : r.phase === 'to-sun' ? 'collecting' : 'idle';
      stop(r, arrival);
    }
    return;
  }

  // Idle steering recovery when not aiming
  if (!g.auto && (r.phase === 'loading' || r.phase === 'carrying' || r.phase === 'idle')) {
    if (!r.manualAim || Math.hypot(r.manualAim.x, r.manualAim.y) <= 0.1) {
      steer(r, 12, dt, 6);
    }
  }

  // Work states: loading, planting, collecting
  if (r.phase === 'loading' && r.age >= LOAD_TIME && r.order) {
    r.cargo = r.order.type;
    events.push({ type: 'loaded' });
    dispatch(g);
  } else if (r.phase === 'planting' && r.age >= PLANT_TIME && r.order?.cell && r.cargo) {
    const { row, col } = r.order.cell;
    if (placeSelectedPlant(g, row, col, plantingPoint(r.order.cell), events)) {
      events.push({ type: 'plant' });
    } else {
      r.order.cell = null;
      events.push({ type: 'error' });
    }
    dispatch(g);
  } else if (r.phase === 'collecting') {
    const sun = g.suns.find((s) => s.id === r.activeSun && !s.collected);
    if (sun && !sun.landed) { r.age = 0; return; }
    if (sun && r.age < COLLECT_TIME) return;
    if (sun) {
      const at = cargoMount(r);
      sun.collected = true;
      sun.collectT = 0;
      sun.fx = at.x;
      sun.fy = at.y;
      r.feedback = { kind: 'sun', at, age: 0 };
    }
    r.activeSun = null;
    dispatch(g);
  } else if (!g.auto && r.phase === 'idle' && r.age > .7 && distance(r, ROVER_HOME) > 1 && !hasManualMove) {
    drive(g, r, 'returning', ROVER_HOME);
  }
}
