import assert from 'node:assert/strict';
import test from 'node:test';
import { COLS, DIVIDER_LEFT, DIVIDER_RIGHT, DIVIDER_W, LAWN_BOTTOM, LAWN_RIGHT, LAWN_TOP, LAWN_X, ROWS, cellTop, plantX, plantY, type Game, type Zombie } from '../src/game/constants';
import { FIELD_TILES, cellCorners, projectGround } from '../src/game/perspective';
import { createGame, tick, tryPlant } from '../src/game/engine';

const enemy = (g: Game, col: number, y: number): Zombie => ({
  id: g.nextId++, col, y, type: 'basic', hp: 200, maxHp: 200, speed: 17,
  slowT: 0, eatingId: null, dieT: null, flashT: 0, wobble: 0,
});

test('four lanes, nine rows, no planting outside the lawn', () => {
  const g = createGame();
  assert.equal(COLS, 4);
  assert.equal(ROWS, 9);
  assert.equal(FIELD_TILES.length, 36);
  assert.deepEqual(g.mowers.map((m) => m.col), [0, 1, 2, 3]);
  assert.equal(tryPlant(g, 'sunflower', 0, 4), false);
  assert.equal(tryPlant(g, 'sunflower', 9, 0), false);
  assert.equal(tryPlant(g, 'sunflower', 0, -1), false);
  assert.equal(tryPlant(g, 'sunflower', 0, 1.5), false);
});

test('tiles share edges and grow in both dimensions toward the house', () => {
  assert.equal(DIVIDER_W, 24);
  for (let c = 0; c < COLS; c++) {
    let lastWidth = 0;
    let lastHeight = 0;
    for (let r = 0; r < ROWS; r++) {
      const [tl, tr, br, bl] = cellCorners(r, c);
      const width = tr.x - tl.x;
      const height = bl.y - tl.y;
      assert.ok(width > lastWidth && height > lastHeight);
      if (c < COLS - 1) {
        if (c === COLS / 2 - 1) {
          const gap = cellCorners(r, c + 1)[0].x - cellCorners(r, c)[1].x;
          const limiter = projectGround(DIVIDER_RIGHT, cellTop(r)).x - projectGround(DIVIDER_LEFT, cellTop(r)).x;
          assert.ok(Math.abs(gap - limiter) < 1e-6);
        } else {
          assert.deepEqual(tr, cellCorners(r, c + 1)[0]);
          assert.deepEqual(br, cellCorners(r, c + 1)[3]);
        }
      }
      const foot = projectGround(plantX(c), plantY(r));
      const t = (foot.y - tl.y) / height;
      assert.ok(t > 0 && t < 1);
      assert.ok(foot.x > tl.x + t * (bl.x - tl.x));
      assert.ok(foot.x < tr.x + t * (br.x - tr.x));
      lastWidth = width;
      lastHeight = height;
    }
  }
  const widthAt = (y: number) => projectGround(LAWN_RIGHT, y).x - projectGround(LAWN_X, y).x;
  assert.ok(Math.abs(widthAt(LAWN_TOP) / widthAt(LAWN_BOTTOM) - .57) < 1e-6);
});

test('perspective does not change lane targeting or mower collisions', () => {
  for (let col = 0; col < COLS; col++) {
    const g = createGame();
    g.status = 'playing';
    g.spawnT = 1000;
    assert.ok(tryPlant(g, 'peashooter', 8, col));
    g.zombies.push(enemy(g, col, cellTop(2)), enemy(g, (col + 1) % COLS, cellTop(2)));
    for (let n = 0; n < 60 * 23; n++) tick(g, 1 / 60);
    assert.equal(g.killed, 1);
    assert.equal(g.zombies[0].hp, 200);
    g.zombies.push(enemy(g, col, LAWN_BOTTOM));
    for (let n = 0; n < 60 * 3; n++) tick(g, 1 / 60);
    assert.equal(g.mowers[col].state, 'gone');
    assert.equal(g.mowers.filter((m) => m.state === 'idle').length, 3);
    g.zombies.push(enemy(g, col, LAWN_BOTTOM + 64));
    tick(g, 1 / 60);
    assert.equal(g.status, 'lost');
    assert.equal(g.loseCol, col);
  }
});