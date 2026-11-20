import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CELL_H, CELL_W, COLS, DIVIDER_LEFT, DIVIDER_RIGHT, DIVIDER_W, MOD_PADS, MOD_PAD_X,
  PAD_CENTERS, PAD_H, PAD_ROWS, PAD_W, PLANT_MAP, PLANT_PADS, PLANT_PAD_X, START_SUN, SUN_VALUE, cellTop, columnLeft,
  plantX, plantY, type Game, type PlantType,
} from '../src/game/constants';
import { createGame, tick } from '../src/game/engine';
import { tryPlant } from '../src/game/planting';
import { FIELD_TILES, cellAtPoint, projectGround } from '../src/game/perspective';
import { modCooldown, modName } from '../src/game/mowerMods';
import {
  fireAtField, fireShot, plantingPoint, requestFenceCommand, requestPlanting, requestSeed,
  setPilotMode, updateServicePads,
} from '../src/game/rover';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += DT) tick(g, DT); };
function garden(x = 240, y = 650) {
  const g = createGame();
  g.status = 'playing';
  g.spawnT = g.skySunT = 10000;
  setPilotMode(g, true);
  Object.assign(g.rover, { x, y, heading: 0 });
  return g;
}
function zombie(g: Game, col: number, y = plantY(3)) {
  const z = {
    id: g.nextId++, type: 'basic' as const, col, y, hp: 200, maxHp: 200, speed: 0,
    slowT: 0, eatingId: null, dieT: null, flashT: 0, wobble: 0,
  };
  g.zombies.push(z);
  return z;
}
const plantPadRow = (type: PlantType) => PAD_ROWS[PLANT_PADS.findIndex((p) => p.type === type)];
const modPadRow = (type: PlantType) => PAD_ROWS[MOD_PADS.findIndex((p) => p.type === type)];

/** Два выстрела в боковой забор без выбранного растения выбирают растение (слева) или способность (справа). */
function waitForShots(g: Game) {
  for (let i = 0; i < 180 && (g.shots.length > 0 || g.rover.phase === 'to-fence'); i++) tick(g, DT);
}
function shootPadFenceTwice(g: Game, side: 'left' | 'right', row: number) {
  const id = `${side}-${row}`;
  assert.equal(requestFenceCommand(g, id, []), 'ok');
  waitForShots(g);
  assert.equal(requestFenceCommand(g, id, []), 'ok');
  waitForShots(g);
}

test('selection fields are full-width fields positioned closer to the house (rows 3..8)', () => {
  assert.equal(DIVIDER_W, 24);
  assert.equal(PAD_W, CELL_W);
  assert.equal(PAD_H, CELL_H);
  assert.equal(CELL_W, 96);
  assert.deepEqual(PAD_ROWS, [3, 4, 5, 6, 7, 8]);
  assert.equal(PLANT_PADS.length + MOD_PADS.length, 2 * (COLS + 2));
  for (const row of [0, 4, 8]) {
    const playable = projectGround(columnLeft(1) + CELL_W, cellTop(row)).x - projectGround(columnLeft(1), cellTop(row)).x;
    const selection = projectGround(PLANT_PAD_X + PAD_W / 2, cellTop(row)).x - projectGround(PLANT_PAD_X - PAD_W / 2, cellTop(row)).x;
    assert.ok(Math.abs(playable - selection) < 1e-6, `selection field ${selection} matches playable field ${playable}`);
    const gap = projectGround(columnLeft(2), cellTop(row)).x - projectGround(columnLeft(1) + CELL_W, cellTop(row)).x;
    const limiter = projectGround(DIVIDER_RIGHT, cellTop(row)).x - projectGround(DIVIDER_LEFT, cellTop(row)).x;
    assert.ok(Math.abs(gap - limiter) < 1e-6);
  }
});

test('plant fields sit left of the arena and mower modules right', () => {
  assert.equal(PLANT_PADS.length, 6);
  assert.equal(MOD_PADS.length, 6);
  assert.deepEqual(PAD_CENTERS, PLANT_PADS.map((pad) => pad.y));
  for (const pad of PLANT_PADS) {
    const point = projectGround(PLANT_PAD_X, pad.y);
    assert.ok(point.x < projectGround(columnLeft(0), pad.y).x, 'purchase pad is left of the lawn');
  }
  for (const pad of MOD_PADS) {
    const point = projectGround(MOD_PAD_X, pad.y);
    assert.ok(point.x > projectGround(columnLeft(3) + CELL_W, pad.y).x, 'module pad is right of the lawn');
    assert.ok(modName(pad.type).length > 5 && modCooldown(pad.type) >= 0);
  }
});

test('driving over a pad does NOT buy a plant or install a module', () => {
  const g = garden();
  const leftAt = projectGround(PLANT_PAD_X, PLANT_PADS[0].y);
  Object.assign(g.rover, { x: leftAt.x - 22, y: leftAt.y, lastX: leftAt.x - 22, lastY: leftAt.y });
  updateServicePads(g, []);
  g.rover.x = leftAt.x;
  updateServicePads(g, []);
  assert.equal(g.rover.cargo, null, 'driving over left pad does not buy');
  assert.equal(g.sun, START_SUN);

  const rightAt = projectGround(MOD_PAD_X, MOD_PADS[0].y);
  Object.assign(g.rover, { x: rightAt.x - 22, y: rightAt.y, lastX: rightAt.x - 22, lastY: rightAt.y });
  updateServicePads(g, []);
  g.rover.x = rightAt.x;
  updateServicePads(g, []);
  assert.equal(g.rover.mod, null, 'driving over right pad does not install');
});

test('shooting the left fence twice without a selected plant buys and loads the plant', () => {
  const g = garden();
  const row = plantPadRow('peashooter');
  assert.equal(requestFenceCommand(g, `left-${row}`, []), 'ok');
  run(g, 0.8);
  assert.deepEqual(g.rover.padMark, { side: 'plant', row, type: 'peashooter' });
  assert.equal(g.rover.cargo, null, 'first shot only marks 1/2');
  assert.equal(g.sun, START_SUN);

  assert.equal(requestFenceCommand(g, `left-${row}`, []), 'ok');
  run(g, 0.8);
  assert.equal(g.rover.padMark, null);
  assert.equal(g.sun, START_SUN - PLANT_MAP.peashooter.cost);
  assert.equal(g.rover.cargo, 'peashooter');
  assert.equal(g.rover.prepaidType, 'peashooter');
  assert.ok(g.cds.peashooter > 0);
});

test('missing funds or a cooling seed block the two-shot purchase', () => {
  const poor = garden();
  poor.sun = PLANT_MAP.sunflower.cost - 1;
  const row = plantPadRow('sunflower');
  shootPadFenceTwice(poor, 'left', row);
  assert.equal(poor.rover.cargo, null);
  assert.equal(poor.rover.padMark, null);

  const cooling = garden();
  cooling.cds.sunflower = 4;
  shootPadFenceTwice(cooling, 'left', row);
  assert.equal(cooling.rover.cargo, null);
  assert.equal(cooling.rover.padMark, null);
});

test('cancelling a prepaid seed returns the sun and its cooldown', () => {
  const g = garden();
  shootPadFenceTwice(g, 'left', plantPadRow('wallnut'));
  assert.equal(g.sun, START_SUN - PLANT_MAP.wallnut.cost);
  assert.equal(requestSeed(g, null, { x: 0, y: 0 }), 'ok');
  assert.equal(g.sun, START_SUN);
  assert.equal(g.cds.wallnut, 0);
  assert.equal(g.rover.prepaidType, null);
});

test('a bought plant is planted once with two fence shots and charged only on selection', () => {
  const manual = garden();
  shootPadFenceTwice(manual, 'left', plantPadRow('sunflower'));
  assert.equal(manual.sun, START_SUN - PLANT_MAP.sunflower.cost);
  assert.equal(manual.rover.cargo, 'sunflower');

  assert.equal(requestFenceCommand(manual, 'left-7', []), 'ok');
  assert.equal(requestFenceCommand(manual, 'left-7', []), 'ok');
  run(manual, 5);
  assert.equal(manual.plants.length, 1);
  assert.equal(manual.sun, START_SUN - PLANT_MAP.sunflower.cost);

  const auto = garden();
  shootPadFenceTwice(auto, 'left', plantPadRow('peashooter'));
  setPilotMode(auto, false); // the bought plant survives the switch
  assert.equal(requestPlanting(auto, 7, 1), 'ok');
  run(auto, 6);
  assert.equal(auto.plants.length, 1);
  assert.equal(auto.sun, START_SUN - PLANT_MAP.peashooter.cost);
});

test('a field behind the divider is reachable by shot only when no plant is selected', () => {
  const g = garden();
  const target = plantingPoint({ row: 5, col: 3 });
  assert.ok(fireAtField(g, target, []));
  assert.equal(g.shots[0].passesDivider, true);
  assert.ok(g.shots[0].to.x > projectGround(DIVIDER_RIGHT, target.y).x, 'crossed the limiter');
  run(g, .7);
  assert.equal(g.plants.length, 0);

  g.rover.cargo = 'sunflower';
  assert.ok(fireAtField(g, target, []));
  assert.equal(g.shots[0].passesDivider, false);
  assert.ok(g.shots[0].terminal.wall?.startsWith('rail'), 'planting shot stops at the limiter');
});


test('clicking any cell places the selected plant there, even through the divider', () => {
  for (const cell of [{ row: 4, col: 3 }, { row: 0, col: 0 }, { row: 8, col: 2 }]) {
    const g = garden();
    requestSeed(g, 'sunflower', { x: 142, y: 1200 });
    for (let i = 0; i < 600 && !g.rover.cargo; i++) tick(g, DT);
    assert.equal(g.rover.cargo, 'sunflower');
    const target = plantingPoint(cell);
    assert.ok(fireShot(g, 'cell', target, { cell }, []));
    assert.equal(g.shots[0].passesDivider, true, 'placement shot pierces the limiter');
    assert.equal(g.shots[0].to.x, target.x);
    assert.equal(g.shots[0].to.y, target.y);
    waitForShots(g);
    assert.deepEqual(g.rover.plantingMark, { ...cell, type: 'sunflower' });
    assert.equal(g.plants.length, 0);
    assert.ok(fireShot(g, 'cell', target, { cell }, []));
    waitForShots(g);
    assert.equal(g.plants.length, 1);
    assert.deepEqual([g.plants[0].row, g.plants[0].col], [cell.row, cell.col]);
    assert.equal(g.sun, START_SUN - PLANT_MAP.sunflower.cost);
    assert.equal(g.rover.plantingMark, null);
  }
});

test('a cell click onto an occupied or cooling target errors without planting', () => {
  const g = garden();
  requestSeed(g, 'sunflower', { x: 142, y: 1200 });
  for (let i = 0; i < 600 && !g.rover.cargo; i++) tick(g, DT);
  const cell = { row: 5, col: 2 };
  tryPlant(g, 'wallnut', cell.row, cell.col);
  const events: string[] = [];
  fireShot(g, 'cell', plantingPoint(cell), { cell }, events as never);
  waitForShots(g);
  assert.equal(g.plants.length, 1, 'no second plant on an occupied cell');
  assert.equal(g.rover.plantingMark, null);
});

test('every projected tile resolves back to its cell from a click point', () => {
  for (const tile of FIELD_TILES) {
    const center = projectGround(plantX(tile.col), plantY(tile.row));
    assert.deepEqual(cellAtPoint(center), { row: tile.row, col: tile.col });
  }
  assert.equal(cellAtPoint({ x: 360, y: 600 }), null, 'the limiter itself is not a cell');
  assert.equal(cellAtPoint({ x: 20, y: 600 }), null, 'off-lawn clicks are not cells');
});

test('shooting a right fence twice without a plant installs one module; shooting another replaces it', () => {
  const g = garden(480, 650);
  const sunRow = modPadRow('sunflower');
  assert.equal(requestFenceCommand(g, `right-${sunRow}`, []), 'ok');
  run(g, 0.8);
  assert.deepEqual(g.rover.padMark, { side: 'mod', row: sunRow, type: 'sunflower' });
  assert.equal(g.rover.mod, null, 'first shot only marks 1/2');

  assert.equal(requestFenceCommand(g, `right-${sunRow}`, []), 'ok');
  run(g, 0.8);
  assert.equal(g.rover.padMark, null);
  assert.equal(g.rover.mod?.type, 'sunflower');

  const snowRow = modPadRow('snowpea');
  shootPadFenceTwice(g, 'right', snowRow);
  assert.equal(g.rover.mod?.type, 'snowpea', 'a new field replaces the ability');
  assert.ok(g.rover.mod!.cd > 0);
});

test('the sunflower module pays out while driving, exactly on its schedule', () => {
  const g = garden(480, 650);
  shootPadFenceTwice(g, 'right', modPadRow('sunflower'));
  const paid = g.sun;
  run(g, .5);
  assert.equal(g.sun, paid, 'first payout waits for the module');
  run(g, 12);
  assert.equal(g.sun, paid + SUN_VALUE);
  const mod = g.rover.mod!;
  assert.ok(mod.cd > 0 && mod.cd <= modCooldown('sunflower'));
});

test('shooting modules hit and control zombies around the mower', () => {
  const shooter = garden(480, 650);
  shootPadFenceTwice(shooter, 'right', modPadRow('peashooter'));
  const first = zombie(shooter, 1, plantY(4));
  run(shooter, 1.6);
  assert.ok(first.hp < 200, 'peashooter module damaged the nearest zombie');

  const icy = garden(480, 650);
  shootPadFenceTwice(icy, 'right', modPadRow('snowpea'));
  const frozen = zombie(icy, 2, plantY(4));
  run(icy, 2.2);
  assert.ok(frozen.hp < 200 && frozen.slowT > 0, 'snowpea module slowed its target');

  const armor = garden(480, 650);
  shootPadFenceTwice(armor, 'right', modPadRow('wallnut'));
  const pushed = zombie(armor, 1, plantY(5));
  const contact = projectGround(plantX(1), plantY(5), 65);
  Object.assign(armor.rover, { x: contact.x, y: contact.y, lastX: contact.x, lastY: contact.y });
  const yBefore = pushed.y;
  run(armor, 1.2);
  assert.ok(pushed.hp < 200 && pushed.y < yBefore, 'wallnut module rammed the zombie back');

  const blast = garden(480, 650);
  shootPadFenceTwice(blast, 'right', modPadRow('cherrybomb'));
  const victim = zombie(blast, 1, plantY(5));
  const blastContact = projectGround(plantX(1), plantY(5), 65);
  Object.assign(blast.rover, { x: blastContact.x, y: blastContact.y, lastX: blastContact.x, lastY: blastContact.y });
  run(blast, 1.1);
  assert.ok(victim.hp <= 0 && victim.dieT !== null, 'cherrybomb module destroyed the nearby zombie');
  assert.equal(blast.killed, 1);
});
