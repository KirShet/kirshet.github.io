import assert from 'node:assert/strict';
import test from 'node:test';
import { LAWN_BOTTOM, LAWN_TOP, START_SUN, STAGE_H, SUN_VALUE, plantX, plantY, type Game, type SunDrop } from '../src/game/constants';
import { BODY_RADIUS, WALLS, driveBounds, fencePoint, firstWall, moveInsideArena, safeParking, type Cell } from '../src/game/arenaGeometry';
import { FENCE_SECTIONS, boardPoint, pickFenceSection } from '../src/game/fence';
import { traceFlight, sunPoint } from '../src/game/cannon';
import { createGame, tick, tryPlant } from '../src/game/engine';
import { FIELD_VIEW, projectGround } from '../src/game/perspective';
import { fireDirectionalCannon, fireShot, muzzlePoint, requestFenceCommand, requestSeed, requestSun, setPilotMode } from '../src/game/rover';

function garden(x = 240, y = 660) {
  const g = createGame();
  g.status = 'playing';
  g.spawnT = g.skySunT = 1000;
  setPilotMode(g, true);
  Object.assign(g.rover, { x, y, heading: 90 });
  return g;
}
function addSun(g: Game, row: number, col: number): SunDrop {
  const s: SunDrop = { id: g.nextId++, x: plantX(col), y: plantY(row), ty: plantY(row), vy: 0, grav: 0,
    landed: true, reserved: false, life: 30, collected: false, collectT: 0, fx: 0, fy: 0 };
  g.suns.push(s);
  return s;
}
function finish(g: Game) {
  for (let i = 0; i < 150 && g.shots.length; i++) tick(g, 1 / 60);
  assert.equal(g.shots.length, 0);
}
function load(g: Game) {
  requestSeed(g, 'sunflower', { x: 142, y: 1200 });
  for (let i = 0; i < 600 && !g.rover.cargo; i++) tick(g, 1 / 60);
  assert.equal(g.rover.cargo, 'sunflower');
  Object.assign(g.rover, { x: 235, y: 700, heading: 90 });
}
function shootCell(g: Game, cell: Cell) {
  assert.ok(fireShot(g, 'cell', fencePoint(cell), { cell }, []));
  finish(g);
}

test('planting shots and their sight stop at the first fence including steel', () => {
  for (const [origin, direction, wall] of [
    [{ x: 235, y: 650 }, { x: 1, y: 0 }, 'rail-left'],
    [{ x: 490, y: 650 }, { x: -1, y: 0 }, 'rail-right'],
    [{ x: 245, y: 650 }, { x: -1, y: 0 }, 'left'],
    [{ x: 475, y: 650 }, { x: 1, y: 0 }, 'right'],
    [{ x: 250, y: 420 }, { x: 0, y: -1 }, 'back'],
    [{ x: 360, y: 1090 }, { x: 0, y: -1 }, 'rail-end'],
  ] as const) {
    const g = garden(origin.x, origin.y);
    g.rover.cargo = 'sunflower';
    g.rover.heading = Math.atan2(direction.x, -direction.y) * 180 / Math.PI;
    const sight = traceFlight(g, direction);
    assert.equal(sight.hit.wall, wall);
    fireDirectionalCannon(g, direction.x, direction.y, []);
    assert.deepEqual(g.shots[0].to, sight.hit.point);
    assert.equal(g.shots[0].terminal.wall, wall);
    finish(g);
    assert.equal(g.plants.length, 0);
  }
});

test('while carrying a plant, clicking behind the steel divider cannot bypass it', () => {
  const g = garden();
  g.rover.cargo = 'sunflower';
  const s = addSun(g, 5, 3);
  const p = sunPoint(s);
  g.rover.y = p.y;
  fireShot(g, 'sun', p, { sunId: s.id }, []);
  assert.equal(g.shots[0].terminal.wall, 'rail-left');
  assert.ok(g.shots[0].to.x < 360);
  finish(g);
  assert.equal(g.sun, START_SUN);
  assert.ok(!s.reserved && !s.collected);
  const source = { x: 590, y: 1200 };
  fireShot(g, 'seed', source, { type: 'cherrybomb', source }, []);
  finish(g);
  assert.equal(g.rover.order, null);
});

test('two shots at one sun produce one immediate credit and cancel any existing pickup order', () => {
  const g = garden();
  const s = addSun(g, 5, 0);
  const p = sunPoint(s);
  Object.assign(g.rover, { x: p.x + 85, y: p.y, heading: -90 });
  requestSun(g, s.id);
  assert.equal(g.rover.activeSun, s.id);
  fireShot(g, 'sun', p, { sunId: s.id }, []);
  fireShot(g, 'sun', p, { sunId: s.id }, []);
  finish(g);
  assert.ok(s.collected && s.paidOnHit);
  assert.equal(g.sun, START_SUN + SUN_VALUE);
  assert.equal(g.rover.activeSun, null);
  for (let i = 0; i < 60; i++) tick(g, 1 / 60);
  assert.equal(g.sun, START_SUN + SUN_VALUE);
  assert.equal(g.suns.length, 0);
});

test('a different cell starts a fresh mark; changing seed or pilot clears the mark', () => {
  const g = garden();
  load(g);
  shootCell(g, { row: 4, col: 1 });
  shootCell(g, { row: 5, col: 1 });
  assert.deepEqual(g.rover.plantingMark, { type: 'sunflower', row: 5, col: 1 });
  assert.equal(g.plants.length, 0);
  assert.equal(g.sun, START_SUN);
  requestSeed(g, 'wallnut', { x: 320, y: 1200 });
  assert.equal(g.rover.plantingMark, null);
  setPilotMode(g, false);
  assert.equal(g.rover.plantingMark, null);
  assert.equal(g.rover.order, null);
});

test('the second impact rechecks occupancy, funds and cooldown without losing cargo', () => {
  for (const unavailable of ['occupied', 'funds', 'cooldown']) {
    const g = garden();
    load(g);
    const cell = { row: 5, col: 1 };
    shootCell(g, cell);
    assert.ok(g.rover.plantingMark);
    if (unavailable === 'occupied') assert.ok(tryPlant(g, 'wallnut', cell.row, cell.col));
    if (unavailable === 'funds') g.sun = 1;
    if (unavailable === 'cooldown') g.cds.sunflower = 10;
    const balance = g.sun;
    shootCell(g, cell);
    assert.equal(g.sun, balance);
    assert.ok(!g.plants.some((p) => p.type === 'sunflower'));
    assert.equal(g.rover.cargo, 'sunflower');
    assert.equal(g.rover.plantingMark, null);
  }
});

test('a new selection cannot be confirmed by old pellets already in flight', () => {
  const g = garden();
  load(g);
  const cell = { row: 4, col: 1 };
  shootCell(g, cell);
  fireShot(g, 'cell', fencePoint(cell), { cell }, []);
  requestSeed(g, 'wallnut', { x: 320, y: 1200 });
  finish(g);
  assert.equal(g.plants.length, 0);
  assert.equal(g.rover.plantingMark, null);
  assert.equal(g.sun, START_SUN);
});

test('three simultaneous rounds on one fence plant and charge exactly once', () => {
  const g = garden();
  load(g);
  const cell = { row: 6, col: 0 };
  for (let i = 0; i < 3; i++) fireShot(g, 'cell', fencePoint(cell), { cell }, []);
  finish(g);
  assert.equal(g.plants.length, 1);
  assert.equal(g.sun, START_SUN - 50);
  assert.equal(g.rover.order, null);
  assert.equal(g.rover.plantingMark, null);
});

test('the chassis crosses the divider in both directions but cannot leave the perimeter', () => {
  const start = { x: 235, y: 570 };
  const left = moveInsideArena(start, { x: -900, y: 370 });
  assert.ok(left.x >= driveBounds(left.y).left - 1e-6);
  const rear = moveInsideArena(start, { x: 246, y: -1000 });
  assert.equal(rear.y, FIELD_VIEW.farY + BODY_RADIUS);
  const across = moveInsideArena(start, { x: 465, y: start.y });
  assert.deepEqual(across, { x: 465, y: start.y });
  assert.deepEqual(moveInsideArena(across, start), start);
  const g = garden(start.x, start.y);
  g.rover.vx = 45000;
  let crossed = false;
  for (let i = 0; i < 100; i++) {
    tick(g, 1 / 60);
    if (g.rover.x > 360) crossed = true;
    assert.ok(g.rover.x <= driveBounds(g.rover.y).right + 1e-6);
    assert.ok(g.rover.y >= FIELD_VIEW.farY + BODY_RADIUS);
  }
  assert.ok(crossed);
});

test('the lower nursery remains open, including its central entrance', () => {
  const left = { x: 240, y: 800 };
  const apron = moveInsideArena(left, { x: 240, y: 1200 });
  assert.ok(Math.abs(apron.y - 1200) < 1e-6);
  const over = moveInsideArena(apron, { x: 465, y: 1200 });
  assert.ok(Math.abs(over.x - 465) < 1e-6);
  const right = moveInsideArena(over, { x: 465, y: 500 });
  assert.deepEqual(right, { x: 465, y: 500 });
  const cap = moveInsideArena({ x: 360, y: 1160 }, { x: 360, y: 230 });
  assert.equal(cap.y, FIELD_VIEW.farY + BODY_RADIUS);
  assert.equal(cap.x, 360);
  assert.ok(moveInsideArena(apron, { x: 240, y: 7000 }).y <= STAGE_H - BODY_RADIUS);
});

test('autonomous harvesting goes directly over steel without a nursery detour', () => {
  const g = garden(220, 430);
  g.auto = false;
  const target = addSun(g, 3, 3);
  requestSun(g, target.id);
  let crossed = false;
  for (let i = 0; i < 700 && !target.collected; i++) {
    const last = { x: g.rover.x, y: g.rover.y };
    tick(g, 1 / 60);
    const r = g.rover;
    const safe = safeParking(r);
    assert.ok(Math.hypot(safe.x - r.x, safe.y - r.y) < .001);
    assert.ok(r.y < FIELD_VIEW.nearY);
    if (last.x < 360 && r.x >= 360) crossed = true;
    const length = Math.hypot(last.x - r.x, last.y - r.y);
    if (length) {
      const hit = firstWall(last, { x: (r.x - last.x) / length, y: (r.y - last.y) / length }, length);
      assert.ok(!hit || hit.wall.id.startsWith('rail-'));
    }
  }
  assert.ok(crossed && target.collected);
});

test('every painted fence section can be picked on its wood, with no fence across the nursery', () => {
  assert.equal(FENCE_SECTIONS.length, 22);
  for (const s of FENCE_SECTIONS) {
    for (const h of [0, 10, 26]) {
      assert.equal(pickFenceSection(boardPoint(s, .5, h))?.id, s.id, `${s.id} at height ${h}`);
    }
    assert.deepEqual(safeParking(s.parking), s.parking);
  }
  assert.equal(pickFenceSection({ x: 360, y: 1110 }), null);
});

test('two clicks on any perimeter section reach its cell from either season, including blocked sight lines', () => {
  for (const x of [225, 475]) for (const s of FENCE_SECTIONS) {
    const g = garden();
    load(g);
    Object.assign(g.rover, { x, y: 630 });
    assert.equal(requestFenceCommand(g, s.id, []), 'ok');
    assert.equal(requestFenceCommand(g, s.id, []), 'ok');
    const events: string[] = [];
    for (let i = 0; i < 420 && !g.plants.length; i++) {
      events.push(...tick(g, 1 / 60).map((e) => e.type));
      const r = g.rover;
      assert.deepEqual(safeParking(r), { x: r.x, y: r.y });
    }
    assert.equal(g.plants.length, 1, s.id);
    assert.deepEqual({ row: g.plants[0].row, col: g.plants[0].col }, s.cell, s.id);
    assert.equal(events.filter((e) => e === 'marked').length, 1);
    assert.equal(g.sun, START_SUN - 50);
    assert.equal(g.rover.fenceOrder, null);
  }
});

test('a fence command without cargo fires through the divider and marks the pad on first hit', () => {
  const g = garden(220, 630);
  assert.equal(requestFenceCommand(g, 'right-4', []), 'ok');
  assert.equal(g.rover.phase, 'idle');
  assert.equal(g.shots.length, 1);
  assert.equal(g.shots[0]?.terminal.wall, 'right');
  assert.ok(g.rover.x < 360);
  finish(g);
  assert.equal(g.plants.length, 0);
  assert.equal(g.sun, START_SUN);
  assert.equal(g.rover.plantingMark, null);
  assert.equal(g.rover.padMark?.side, 'mod');
  assert.equal(g.rover.padMark?.row, 4);
});

test('far and near cells on both faces of the metal rail are addressed by their projected row', () => {
  for (const row of [0, 1, 7, 8]) for (const col of [1, 2]) {
    const cell = { row, col };
    const point = fencePoint(cell);
    const g = garden(col === 1 ? 260 : 460, point.y);
    g.rover.cargo = 'sunflower';
    const from = muzzlePoint(g.rover);
    const { hit } = traceFlight(g, { x: point.x - from.x, y: point.y - from.y });
    assert.deepEqual(hit.payload, { cell });
  }
  assert.ok(WALLS.every((w) => !Number.isNaN(w.a.x)));
  assert.equal(projectGround(360, LAWN_TOP).y, FIELD_VIEW.farY);
  assert.ok(Math.abs(projectGround(360, LAWN_BOTTOM).y - FIELD_VIEW.nearY) < .001);
});

test('autopilot parks inside the clicked fence and can take a new job there', () => {
  const g = garden(235, 640);
  setPilotMode(g, false);
  assert.equal(requestFenceCommand(g, 'right-4', []), 'ok');
  const target = FENCE_SECTIONS.find((s) => s.id === 'right-4')!;
  for (let i = 0; i < 250; i++) tick(g, 1 / 60);
  assert.equal(g.rover.phase, 'at-fence');
  assert.deepEqual({ x: g.rover.x, y: g.rover.y }, target.parking);
  assert.equal(g.shots.length, 0);
  const sun = addSun(g, 3, 0);
  assert.ok(requestSun(g, sun.id));
  for (let i = 0; i < 250 && !sun.collected; i++) tick(g, 1 / 60);
  assert.ok(sun.collected);
});