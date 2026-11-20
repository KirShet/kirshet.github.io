import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, tick } from '../src/game/engine';
import { clearPilotInput, fireDirectionalCannon, fireShot, muzzlePoint, requestSeed, setPilotMode } from '../src/game/rover';
import { traceFlight, sunPoint } from '../src/game/cannon';
import { projectGround } from '../src/game/perspective';
import { START_SUN, SUN_VALUE, plantX, plantY, type Game, type SunDrop } from '../src/game/constants';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds - 1e-6; t += DT) tick(g, DT); };
function game(x = 240, y = 650) {
  const g = createGame();
  g.status = 'playing';
  g.spawnT = g.skySunT = 10000;
  setPilotMode(g, true);
  Object.assign(g.rover, { x, y, heading: 90 });
  return g;
}
function sun(g: Game, col: number) {
  const y = plantY(4);
  const s: SunDrop = { id: g.nextId++, x: plantX(col), y, ty: y, vy: 0, grav: 0, landed: true,
    life: 30, reserved: false, collected: false, collectT: 0, fx: 0, fy: 0 };
  g.suns.push(s);
  return s;
}
const motion = (g: Game) => {
  const { x, y, heading, vx, vy, speed, thrusting, slip } = g.rover;
  return { x, y, heading, vx, vy, speed, thrusting, slip };
};

test('W and LMB give identical acceleration, turning and traction on either surface', () => {
  for (const x of [240, 470]) for (const heading of [0, 90, 180, 270]) {
    const key = game(x), mouse = game(x), both = game(x);
    for (const g of [key, mouse, both]) {
      g.rover.heading = heading;
      g.rover.manualAim = { x: .6, y: -.8 };
    }
    key.rover.thrustHeld.key = true;
    mouse.rover.thrustHeld.mouse = true;
    both.rover.thrustHeld.key = both.rover.thrustHeld.mouse = true;
    for (let n = 0; n < 25; n++) {
      for (const g of [key, mouse, both]) tick(g, DT);
      assert.deepEqual(motion(key), motion(mouse));
      assert.deepEqual(motion(key), motion(both), 'using both inputs must not double thrust');
    }
  }
});

test('forward throttle alone follows current heading, not screen north', () => {
  const g = game(480);
  g.rover.thrustHeld.key = true;
  run(g, .2);
  assert.equal(g.rover.heading, 90);
  assert.ok(g.rover.x > 500);
  assert.ok(Math.abs(g.rover.y - 650) < .0001);
});

test('releasing one throttle does not cancel the other, but releasing both ends acceleration', () => {
  const g = game();
  g.rover.thrustHeld.key = g.rover.thrustHeld.mouse = true;
  tick(g, DT);
  g.rover.thrustHeld.key = false;
  tick(g, DT);
  assert.ok(g.rover.thrusting);
  g.rover.thrustHeld.key = true;
  g.rover.thrustHeld.mouse = false;
  tick(g, DT);
  assert.ok(g.rover.thrusting);
  g.rover.thrustHeld.key = false;
  const speed = Math.hypot(g.rover.vx, g.rover.vy);
  tick(g, DT);
  assert.equal(g.rover.thrusting, false);
  assert.ok(g.rover.speed < speed);
});

test('input reset and switching pilot release both throttle sources without changing heading', () => {
  const g = game();
  g.rover.thrustHeld.key = g.rover.thrustHeld.mouse = true;
  g.rover.manualMove = { x: 1, y: 0 };
  clearPilotInput(g.rover);
  tick(g, DT);
  assert.equal(g.rover.thrusting, false);
  assert.equal(g.rover.heading, 90);
  g.rover.thrustHeld.key = g.rover.thrustHeld.mouse = true;
  setPilotMode(g, false);
  assert.deepEqual(g.rover.thrustHeld, { key: false, mouse: false });
});

test('empty fire crosses the low limiter but the tall outer fence still stops it', () => {
  for (const [x, y, dx, dy, wall] of [
    [235, 650, 1, 0, 'right'], [490, 650, -1, 0, 'left'],
    [360, 1100, 0, -1, 'back'], [360, 500, 0, 1, 'apron-end'],
  ] as const) {
    const g = game(x, y);
    g.rover.seedBoxes = []; // isolate barriers from the seed tray
    g.rover.heading = Math.atan2(dx, -dy) * 180 / Math.PI;
    const sight = traceFlight(g, { x: dx, y: dy });
    assert.equal(sight.hit.wall, wall, 'outer fence remains the sight terminus');
    assert.ok(sight.passesDivider);
    assert.ok(!sight.terminal.wall?.startsWith('rail'), 'empty bolt ignores the limiter');
    fireDirectionalCannon(g, dx, dy, []);
    assert.ok(g.shots[0].passesDivider);
    run(g, 1);
    assert.equal(g.rover.plantingMark, null);
    assert.equal(g.plants.length, 0);
  }
});

test('empty laser can collect suns across the divider from both seasons', () => {
  for (const col of [0, 3]) {
    const g = game(col === 0 ? 490 : 235);
    const s = sun(g, col);
    g.rover.y = sunPoint(s).y;
    g.rover.heading = col === 0 ? -90 : 90;
    const from = muzzlePoint(g.rover), p = sunPoint(s);
    assert.equal(traceFlight(g, { x: p.x - from.x, y: p.y - from.y }).hit.kind, 'sun');
    fireShot(g, 'sun', p, { sunId: s.id }, []);
    run(g, .65);
    assert.ok(s.collected);
    assert.equal(g.sun, START_SUN + SUN_VALUE);
  }
});

test('an empty bolt reaches a zombie behind steel, but a planting shot stops before it', () => {
  for (const loaded of [false, true]) {
    const g = game(240, 650);
    if (loaded) g.rover.cargo = 'wallnut';
    g.zombies.push({ id: g.nextId++, type: 'basic', col: 2, y: plantY(5), hp: 200, maxHp: 200,
      speed: 0, slowT: 0, eatingId: null, dieT: null, flashT: 0, wobble: 0 });
    const from = muzzlePoint(g.rover);
    const target = projectGround(plantX(2), plantY(5), 65);
    fireDirectionalCannon(g, target.x - from.x, target.y - from.y, []);
    run(g, .5);
    assert.equal(g.zombies[0].hp, loaded ? 200 : 150);
  }
});

test('a selected or carried plant restores the steel collision and planting rules', () => {
  for (const carried of [false, true]) {
    const g = game();
    if (carried) g.rover.cargo = 'sunflower';
    else g.rover.order = { type: 'sunflower', source: { x: 142, y: 1200 }, cell: null };
    const sight = traceFlight(g, { x: 1, y: 0 });
    assert.equal(sight.hit.wall, 'rail-left');
    assert.equal(sight.passesDivider, false);
    fireDirectionalCannon(g, 1, 0, []);
    run(g, .3);
    assert.ok(g.rover.plantingMark);
    assert.equal(g.plants.length, 0);
    assert.equal(g.sun, START_SUN);
  }
});

test('a shot fired without seeds keeps passing steel when a plant is selected during flight', () => {
  const g = game();
  const s = sun(g, 3), p = sunPoint(s);
  g.rover.y = p.y;
  fireShot(g, 'sun', p, { sunId: s.id }, []);
  requestSeed(g, 'sunflower', { x: 142, y: 1200 });
  run(g, .65);
  assert.ok(s.collected, 'impact detection must use the shot policy, not the new selection');
  assert.equal(g.sun, START_SUN + SUN_VALUE);
});

test('a planting shot does not gain penetration when selection is cancelled in flight', () => {
  const g = game();
  g.rover.order = { type: 'sunflower', source: { x: 142, y: 1200 }, cell: null };
  const s = sun(g, 3), p = sunPoint(s);
  g.rover.y = p.y;
  fireShot(g, 'sun', p, { sunId: s.id }, []);
  assert.equal(g.shots[0].terminal.wall, 'rail-left');
  requestSeed(g, null, { x: 0, y: 0 });
  run(g, .65);
  assert.equal(s.collected, false);
  assert.equal(g.sun, START_SUN);
  assert.equal(g.rover.plantingMark, null);
});