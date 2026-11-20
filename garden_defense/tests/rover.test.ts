import assert from 'node:assert/strict';
import test from 'node:test';
import { START_SUN, SUN_VALUE, plantX, plantY, type Game, type SunDrop } from '../src/game/constants';
import { createGame, tick, tryPlant } from '../src/game/engine';
import { PLANT_TIME, ROVER_HOME, SEED_CARD_BOXES, fireDirectionalCannon, fireShot, muzzlePoint, requestPlanting, requestSeed, requestSun } from '../src/game/rover';
import { projectGround } from '../src/game/perspective';
import { fencePoint } from '../src/game/arenaGeometry';
import { sunPoint } from '../src/game/cannon';

const card = { x: 157, y: 48 };
const step = 1 / 60;
function garden() {
  const g = createGame();
  g.status = 'playing';
  g.spawnT = g.skySunT = 1000;
  return g;
}
function until(g: Game, condition: () => boolean, limit = 8) {
  for (let i = 0; i < limit / step && !condition(); i++) tick(g, step);
  assert.ok(condition(), `condition not reached; rover is ${g.rover.phase}`);
}
function addSun(g: Game, row: number, col: number): SunDrop {
  const s: SunDrop = {
    id: g.nextId++, x: plantX(col), y: plantY(row), ty: plantY(row), vy: 0, grav: 0,
    landed: true, reserved: false, life: 30, collected: false, collectT: 0, fx: 0, fy: 0,
  };
  g.suns.push(s);
  return s;
}

test('the mower drives to the actual card, loads a visible cargo and waits for a cell', () => {
  const g = garden();
  assert.equal(requestSeed(g, 'sunflower', card), 'ok');
  assert.equal(g.rover.phase, 'to-card');
  assert.equal(g.rover.cargo, null);
  assert.equal(g.plants.length, 0);
  assert.equal(g.sun, START_SUN);
  tick(g, step);
  assert.ok(g.rover.x < ROVER_HOME.x);
  until(g, () => g.rover.phase === 'loading');
  assert.equal(g.rover.x, card.x);
  assert.equal(g.rover.y, ROVER_HOME.y);
  until(g, () => g.rover.phase === 'carrying');
  assert.equal(g.rover.cargo, 'sunflower');
  for (let i = 0; i < 80; i++) tick(g, step);
  assert.equal(g.rover.phase, 'carrying');
  assert.equal(g.plants.length, 0);
  assert.equal(g.sun, START_SUN);
  assert.equal(requestPlanting(g, 7, 1), 'ok');
  until(g, () => g.rover.phase === 'planting');
  assert.equal(g.rover.cargo, 'sunflower');
  assert.equal(g.plants.length, 0);
  assert.equal(g.cds.sunflower, 0);
  until(g, () => g.rover.age >= PLANT_TIME / 2);
  assert.equal(g.plants.length, 0);
  until(g, () => g.plants.length === 1);
  assert.equal(g.rover.cargo, null);
  assert.equal(g.rover.order, null);
  assert.equal(g.sun, START_SUN - 50);
  assert.equal(g.cds.sunflower, 5);
  assert.deepEqual([g.plants[0].row, g.plants[0].col], [7, 1]);
  until(g, () => g.rover.phase === 'idle' && g.rover.y === ROVER_HOME.y);
});

test('an early cell tap waits for loading, and repeated commands never double-charge', () => {
  const g = garden();
  requestSeed(g, 'peashooter', card);
  assert.equal(requestPlanting(g, 5, 2), 'ok');
  assert.equal(requestPlanting(g, 5, 2), 'ok');
  assert.equal(requestSeed(g, 'wallnut', card), 'busy');
  assert.equal(g.rover.phase, 'to-card');
  until(g, () => g.rover.phase === 'to-cell');
  assert.equal(g.rover.cargo, 'peashooter');
  assert.equal(g.sun, START_SUN);
  assert.equal(requestPlanting(g, 6, 3), 'ok');
  until(g, () => g.plants.length > 0);
  assert.deepEqual([g.plants[0].row, g.plants[0].col], [6, 3]);
  assert.equal(g.sun, START_SUN - 100);
  assert.equal(requestSeed(g, 'peashooter', card), 'cooldown');
  assert.equal(requestPlanting(g, 2, 2), 'invalid');
});

test('invalid or occupied cells keep cargo, and cancelled selections cost nothing', () => {
  const g = garden();
  assert.equal(requestSeed(g, 'repeater', card), 'funds');
  assert.equal(g.rover.phase, 'idle');
  tryPlant(g, 'wallnut', 3, 1);
  requestSeed(g, 'sunflower', card);
  until(g, () => g.rover.phase === 'carrying');
  assert.equal(requestPlanting(g, 3, 1), 'occupied');
  assert.equal(requestPlanting(g, 3, 4), 'invalid');
  assert.equal(g.rover.cargo, 'sunflower');
  assert.equal(requestSeed(g, null, card), 'ok');
  assert.equal(g.rover.cargo, null);
  assert.equal(g.sun, START_SUN - 50);
  assert.equal(g.cds.sunflower, 0);
});

test('marked suns survive the journey and are credited exactly once after pickup', () => {
  const g = garden();
  const a = addSun(g, 1, 0), b = addSun(g, 6, 3);
  assert.ok(requestSun(g, a.id));
  assert.equal(requestSun(g, a.id), false);
  assert.ok(requestSun(g, b.id));
  assert.deepEqual(g.rover.sunQueue, [b.id]);
  assert.equal(g.sun, START_SUN);
  assert.equal(a.collected, false);
  until(g, () => g.rover.phase === 'collecting');
  assert.equal(a.collected, false);
  assert.ok(g.suns.includes(b));
  until(g, () => a.collected);
  assert.equal(g.sun, START_SUN);
  assert.equal(requestSun(g, a.id), false);
  until(g, () => g.sun === START_SUN + 2 * SUN_VALUE);
  assert.equal(g.suns.length, 0);
  assert.equal(g.mowers.filter((m) => m.state === 'idle').length, 4);
});

test('the mower retains its plant while collecting; a new delivery follows the active pickup', () => {
  const g = garden();
  requestSeed(g, 'wallnut', card);
  until(g, () => g.rover.phase === 'carrying');
  const s = addSun(g, 3, 2);
  s.landed = false;
  s.y = -50;
  s.vy = 60;
  requestSun(g, s.id);
  requestPlanting(g, 5, 1);
  assert.equal(g.rover.phase, 'to-sun');
  assert.equal(g.rover.cargo, 'wallnut');
  until(g, () => s.collected);
  assert.equal(s.landed, true);
  assert.equal(g.rover.phase, 'to-cell');
  assert.equal(g.rover.cargo, 'wallnut');
  until(g, () => g.plants.length === 1);
  assert.equal(g.sun, START_SUN - 50 + SUN_VALUE);
});

test('arrival revalidates the cell; a stopped or restarted game has no delayed side effects', () => {
  const g = garden();
  g.sun = 500;
  requestSeed(g, 'sunflower', card);
  requestPlanting(g, 2, 2);
  until(g, () => g.rover.phase === 'planting');
  tryPlant(g, 'wallnut', 2, 2);
  until(g, () => g.rover.phase === 'carrying');
  assert.equal(g.rover.cargo, 'sunflower');
  assert.equal(g.sun, 450);
  assert.equal(g.plants.length, 1);
  requestPlanting(g, 1, 1);
  g.status = 'lost';
  const snapshot = JSON.stringify(g);
  for (let i = 0; i < 200; i++) tick(g, step);
  assert.equal(JSON.stringify(g), snapshot);
  assert.equal(requestSeed(g, 'sunflower', card), 'invalid');
  const fresh = createGame();
  assert.equal(fresh.rover.phase, 'idle');
  assert.equal(fresh.rover.order, null);
  assert.equal(fresh.rover.cargo, null);
  assert.equal(fresh.sun, START_SUN);
});

test('auto mode raises route speed and winter starts with wheelspin', () => {
  const manual = garden();
  requestSeed(manual, 'sunflower', card);
  const manualDuration = manual.rover.route!.duration;
  const g = garden();
  g.auto = true;
  requestSeed(g, 'sunflower', card);
  assert.ok(g.rover.route!.duration < manualDuration);
  assert.ok(g.rover.slip > 0);
  const x0 = g.rover.x, y0 = g.rover.y;
  for (let i = 0; i < 12; i++) tick(g, step);
  assert.ok(g.rover.odometer > 5);
  assert.ok(Math.hypot(g.rover.x - x0, g.rover.y - y0) < 1);
  assert.ok(g.fxs.some((fx) => fx.kind === 'dust'));
  until(g, () => g.rover.phase === 'loading');
});

test('auto mode scatters leaves while driving through the autumn half', () => {
  const g = garden();
  g.auto = true;
  const s = addSun(g, 4, 3);
  assert.ok(requestSun(g, s.id));
  assert.equal(g.rover.slip, 0);
  for (let i = 0; i < 30 && !g.fxs.some((fx) => fx.kind === 'leaf'); i++) tick(g, step);
  assert.ok(g.fxs.some((fx) => fx.kind === 'leaf'));
});

test('a shot credits the sun at impact, without a collection route or a second payout', () => {
  const g = garden();
  g.auto = true;
  const events: import('../src/game/constants').GameEvent[] = [];
  const s = addSun(g, 2, 1);
  const point = sunPoint(s);
  Object.assign(g.rover, { x: point.x, y: point.y + 155, heading: 0 });
  assert.ok(fireShot(g, 'sun', point, { sunId: s.id }, events));
  assert.equal(g.shots.length, 1);
  assert.equal(s.reserved, false);
  for (let i = 0; i < 120 && g.shots.length; i++) tick(g, step);
  assert.equal(g.shots.length, 0);
  assert.equal(s.collected, true);
  assert.equal(s.reserved, false);
  assert.equal(g.rover.activeSun, null);
  assert.equal(g.rover.sunQueue.length, 0);
  assert.equal(g.sun, START_SUN + SUN_VALUE);
  until(g, () => !g.suns.length);
  assert.equal(g.sun, START_SUN + SUN_VALUE);
});

test('manual joystick movement drives the mower, slips on winter side and vacuums suns', () => {
  const g = garden();
  g.auto = true;
  g.rover.x = 200; // winter side
  g.rover.y = 800;
  g.rover.manualMove = { x: -1, y: 0 }; // drive left
  tick(g, step);
  assert.ok(g.rover.slip > 0);
  assert.ok(g.rover.wasMoving);

  // Advance past slip
  for (let i = 0; i < 40; i++) tick(g, step);
  assert.ok(g.rover.x < 200);

  // Drive to autumn side: the inertial swing must reverse the travel direction
  const west = g.rover.x;
  g.rover.manualMove = { x: 1, y: 0 };
  for (let i = 0; i < 60; i++) tick(g, step);
  assert.ok(g.rover.x > west + 60, 'opposite thrust reverses the mower');

  // Driving over a sun vacuums it up
  const s = addSun(g, 6, 2);
  const p = projectGround(s.x, s.ty);
  g.rover.x = p.x;
  g.rover.y = p.y;
  tick(g, step);
  assert.equal(s.collected, true);
  assert.equal(g.rover.feedback?.kind, 'sun');
});

test('activate a bottom seed card, mark a rail cell, then plant on the second impact', () => {
  const g = garden();
  g.auto = true;
  const events: import('../src/game/constants').GameEvent[] = [];
  g.rover.x = 300;
  g.rover.y = 800;

  // Aim toward the sunflower card in the bottom seed tray
  const from = muzzlePoint(g.rover);
  const cardBox = SEED_CARD_BOXES[0];
  const dirCard = { x: cardBox.centerX - from.x, y: cardBox.centerY - from.y };
  assert.ok(fireDirectionalCannon(g, dirCard.x, dirCard.y, events));
  for (let i = 0; i < 120 && !g.rover.order; i++) tick(g, step);
  assert.equal(g.rover.order?.type, 'sunflower');

  assert.equal(g.rover.cargo, 'sunflower');
  const chosen = { row: 5, col: 1 };
  const rail = fencePoint(chosen);
  const shootRail = () => {
    const from = muzzlePoint(g.rover);
    assert.ok(fireDirectionalCannon(g, rail.x - from.x, rail.y - from.y, events));
    until(g, () => !g.shots.length);
  };
  shootRail();
  assert.deepEqual(g.rover.plantingMark, { ...chosen, type: 'sunflower' });
  assert.equal(g.plants.length, 0);
  assert.equal(g.sun, START_SUN);
  assert.equal(g.cds.sunflower, 0);
  shootRail();
  assert.equal(g.plants.length, 1);
  assert.equal(g.plants[0].type, 'sunflower');
  assert.equal(g.plants[0].col, 1); // adjacent to center rail on left side
  assert.equal(g.plants[0].row, 5);
  assert.equal(g.rover.plantingMark, null);
  assert.equal(g.sun, START_SUN - 50);
  assert.equal(g.cds.sunflower, 5);
});

test('striker cannon fire generates backward physical recoil impulse and laser audio event', () => {
  const g = garden();
  g.auto = true;
  g.rover.x = 360;
  g.rover.y = 800;
  g.rover.vx = 0;
  g.rover.vy = 0;
  g.rover.heading = 0; // pointing UP

  const events: import('../src/game/constants').GameEvent[] = [];
  // Fire straight up
  assert.ok(fireDirectionalCannon(g, 0, -1, events));
  assert.ok(events.some((e) => e.type === 'laser'));
  assert.ok(g.rover.recoilOffset > 5);
  // Recoil should push backward (DOWN, i.e. vy > 0)
  assert.ok(g.rover.vy > 100);
});

test('striker thruster accelerates forward and inertial drift preserves momentum', () => {
  const g = garden();
  g.auto = true;
  g.rover.x = 250;
  g.rover.y = 700;
  g.rover.manualMove = { x: 0, y: -1 }; // Thrust forward (UP)

  tick(g, step);
  assert.equal(g.rover.thrusting, true);

  // Run a few steps to build velocity
  for (let i = 0; i < 30; i++) tick(g, step);
  assert.ok(g.rover.speed > 200);
  assert.ok(g.rover.vy < -150);

  // Release thruster, inertia keeps ship moving
  g.rover.manualMove = { x: 0, y: 0 };
  const vyBefore = g.rover.vy;
  tick(g, step);
  assert.equal(g.rover.thrusting, false);
  // Velocity is preserved with drag, not halted immediately
  assert.ok(Math.abs(g.rover.vy) > Math.abs(vyBefore) * 0.9);
});