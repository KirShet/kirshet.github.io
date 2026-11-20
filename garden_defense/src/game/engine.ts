// ============================================================
// Игровой движок (вертикальная арена): чистая симуляция.
// Зомби движутся сверху вниз по дорожке (col), растения стоят
// в клетках (row, col), горох летит вверх, косилки едут вверх.
// ============================================================

import {
  BLOCK_OFFSET,
  CELL_H,
  CHERRY_DAMAGE,
  COLS,
  EAT_DPS,
  FIRE_INTERVAL,
  FIRST_ZOMBIE_AT,
  Game,
  GameEvent,
  LAWN_BOTTOM,
  LAWN_RIGHT,
  LAWN_TOP,
  LAWN_X,
  MOWER_Y,
  PEA_DAMAGE,
  PEA_HEIGHT,
  PEA_SPEED,
  Pea,
  Plant,
  PLANT_MAP,
  PlantType,
  SKY_SUN_EVERY,
  SKY_SUN_FIRST,
  SLOW_DURATION,
  SLOW_FACTOR,
  START_SUN,
  SUN_LIFE,
  SUN_VALUE,
  SUNFLOWER_EVERY,
  WAVES,
  Zombie,
  ZOMBIES,
  ZombieType,
  cellTop,
  plantX,
  plantY,
  rand,
  rowCenterY,
} from './constants';
import { advanceRover, advanceShots, createRover, TRANSFER_TIME } from './rover';
import { updateMowerMods } from './mowerMods';
export { plantAt, tryPlant } from './planting';

export function createGame(): Game {
  const cds = {} as Record<PlantType, number>;
  (Object.keys(PLANT_MAP) as PlantType[]).forEach((t) => (cds[t] = 0));
  return {
    status: 'ready',
    time: 0,
    readyT: 2.6,
    sun: START_SUN,
    plants: [],
    zombies: [],
    peas: [],
    suns: [],
    mowers: Array.from({ length: COLS }, (_, col) => ({ col, y: MOWER_Y, state: 'idle' as const })),
    rover: createRover(),
    shots: [],
    auto: false,
    fxs: [],
    cds,
    wave: -1,
    waveQueue: [],
    spawnT: FIRST_ZOMBIE_AT,
    breakT: 0,
    killed: 0,
    spawned: 0,
    skySunT: SKY_SUN_FIRST,
    shakeT: 0,
    nextId: 1,
    loseCol: -1,
  };
}

function spawnZombie(g: Game, type: ZombieType) {
  const col = Math.floor(Math.random() * COLS);
  const def = ZOMBIES[type];
  g.zombies.push({
    id: g.nextId++,
    type,
    col,
    y: LAWN_TOP - rand(60, 110), // появляется за верхней панелью
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * rand(0.9, 1.12),
    slowT: 0,
    eatingId: null,
    dieT: null,
    flashT: 0,
    wobble: Math.random() * 10,
  });
  g.spawned++;
}

function startWave(g: Game, idx: number, events: GameEvent[]) {
  g.wave = idx;
  const w = WAVES[idx];
  g.waveQueue = [...w.zombies];
  const [a, b] = w.interval;
  g.spawnT = rand(a * 0.5, b * 0.5);
  events.push({ type: idx === WAVES.length - 1 ? 'finalwave' : 'wave' });
}

function pushSun(g: Game, x: number, y: number, ty: number, vy: number, grav: number) {
  g.suns.push({
    id: g.nextId++,
    x,
    y,
    ty,
    vy,
    grav,
    landed: false,
    reserved: false,
    life: SUN_LIFE,
    collected: false,
    collectT: 0,
    fx: 0,
    fy: 0,
  });
}

export function shovelAt(g: Game, row: number, col: number): boolean {
  const i = g.plants.findIndex((p) => p.row === row && p.col === col);
  if (i < 0) return false;
  const p = g.plants[i];
  g.fxs.push({ id: g.nextId++, kind: 'poof', x: plantX(col), y: plantY(row), elevation: 30, t: 0, ttl: 0.4 });
  g.plants.splice(i, 1);
  g.zombies.forEach((z) => {
    if (z.eatingId === p.id) z.eatingId = null;
  });
  return true;
}

// ---------- Главный тик ----------

export function tick(g: Game, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (g.status === 'won' || g.status === 'lost' || g.status === 'menu') return events;

  g.time += dt;
  if (g.shakeT > 0) g.shakeT -= dt;

  if (g.status === 'ready') {
    g.readyT -= dt;
    if (g.readyT <= 0) g.status = 'playing';
  }

  // кулдауны карточек
  (Object.keys(g.cds) as PlantType[]).forEach((t) => {
    if (g.cds[t] > 0) g.cds[t] = Math.max(0, g.cds[t] - dt);
  });

  // ---------- солнце с неба (падает сверху) ----------
  if (g.status === 'playing') {
    g.skySunT -= dt;
    if (g.skySunT <= 0) {
      g.skySunT = SKY_SUN_EVERY * rand(0.85, 1.15);
      pushSun(g, rand(LAWN_X + 50, LAWN_RIGHT - 50), -50, rand(LAWN_TOP + 80, LAWN_BOTTOM - 120), 60, 0);
      events.push({ type: 'sunborn' });
    }
  }

  // ---------- волны ----------
  if (g.status === 'playing') {
    if (g.wave < 0) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) startWave(g, 0, events);
    } else if (g.waveQueue.length > 0) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        spawnZombie(g, g.waveQueue.shift()!);
        const [a, b] = WAVES[g.wave].interval;
        g.spawnT = rand(a, b);
      }
    } else if (g.zombies.every((z) => z.dieT !== null)) {
      // волна зачищена
      if (g.wave >= WAVES.length - 1) {
        g.status = 'won';
        events.push({ type: 'win' });
      } else {
        // короткая пауза между волнами
        if (g.breakT <= 0) g.breakT = 6;
        g.breakT -= dt;
        if (g.breakT <= 0) {
          g.breakT = 0;
          startWave(g, g.wave + 1, events);
        }
      }
    }
  }

  // ---------- растения ----------
  for (let i = g.plants.length - 1; i >= 0; i--) {
    const p = g.plants[i];
    p.bornT += dt;
    if (p.flashT > 0) p.flashT -= dt;

    if (p.type === 'sunflower') {
      p.sunT -= dt;
      if (p.sunT <= 0) {
        p.sunT = SUNFLOWER_EVERY;
        // солнце подпрыгивает от подсолнуха и падает обратно
        pushSun(g, plantX(p.col) + rand(-14, 14), plantY(p.row) - 70, plantY(p.row) - 16 + rand(-6, 6), -170, 420);
        events.push({ type: 'sunborn' });
      }
    }

    if (p.type === 'peashooter' || p.type === 'snowpea' || p.type === 'repeater') {
      const py = plantY(p.row);
      // стреляем, если в дорожке есть зомби выше растения
      const target = g.zombies.some((z) => z.dieT === null && z.col === p.col && z.y < py + 10);
      if (p.burstLeft > 0) {
        p.burstT -= dt;
        if (p.burstT <= 0) {
          p.burstLeft--;
          p.burstT = 0.19;
          firePea(g, p, events);
        }
      }
      p.fireT -= dt;
      if (target && p.fireT <= 0) {
        p.fireT = FIRE_INTERVAL;
        firePea(g, p, events);
        if (p.type === 'repeater') {
          p.burstLeft = 1;
          p.burstT = 0.19;
        }
      }
    }

    if (p.type === 'cherrybomb') {
      p.armT -= dt;
      if (p.armT <= 0) {
        // взрыв 3×3 вокруг клетки
        const cx = plantX(p.col);
        const cy = rowCenterY(p.row);
        g.fxs.push({ id: g.nextId++, kind: 'boom', x: cx, y: cy, t: 0, ttl: 0.55 });
        g.shakeT = 0.45;
        events.push({ type: 'boom', x: cx, y: cy });
        g.zombies.forEach((z) => {
          if (z.dieT !== null) return;
          const inCols = Math.abs(z.col - p.col) <= 1;
          const inRows = Math.abs(z.y - cy) <= CELL_H * 1.6;
          if (inCols && inRows) hurtZombie(g, z, CHERRY_DAMAGE, events);
        });
        g.plants.splice(i, 1);
        continue;
      }
    }
  }

  // ---------- горох (летит вверх) ----------
  for (let i = g.peas.length - 1; i >= 0; i--) {
    const pea = g.peas[i];
    const previousY = pea.y;
    pea.y -= PEA_SPEED * dt;
    if (pea.y < -30) {
      g.peas.splice(i, 1);
      continue;
    }
    // попадание в ближайшего снизу зомби в своей дорожке
    let hit: Zombie | null = null;
    for (const z of g.zombies) {
      if (z.dieT !== null || z.col !== pea.col) continue;
      if (pea.y <= z.y + 10 && previousY >= z.y - 30) {
        if (!hit || z.y > hit.y) hit = z;
      }
    }
    if (hit) {
      hurtZombie(g, hit, PEA_DAMAGE, events);
      if (pea.ice) hit.slowT = SLOW_DURATION;
      g.fxs.push({
        id: g.nextId++,
        kind: pea.ice ? 'icesplat' : 'splat',
        x: plantX(pea.col),
        y: pea.y,
        elevation: PEA_HEIGHT,
        t: 0,
        ttl: 0.25,
      });
      events.push({ type: 'splat' });
      g.peas.splice(i, 1);
    }
  }

  // ---------- зомби (идут сверху вниз) ----------
  for (let i = g.zombies.length - 1; i >= 0; i--) {
    const z = g.zombies[i];
    z.wobble += dt;
    if (z.flashT > 0) z.flashT -= dt;
    if (z.slowT > 0) z.slowT -= dt;

    if (z.dieT !== null) {
      z.dieT += dt;
      if (z.dieT > 0.9) g.zombies.splice(i, 1);
      continue;
    }

    // растение, которое зомби сейчас грызёт (в его дорожке)
    let target: Plant | undefined;
    for (const p of g.plants) {
      if (p.col !== z.col) continue;
      const top = cellTop(p.row);
      if (z.y >= top + BLOCK_OFFSET && z.y <= top + CELL_H + 30) {
        target = p;
        break;
      }
    }

    if (target) {
      z.eatingId = target.id;
      target.hp -= EAT_DPS * dt;
      target.flashT = 0.08;
      if (Math.random() < dt * 2.4) events.push({ type: 'chomp' });
      if (target.hp <= 0) {
        const idx = g.plants.findIndex((p) => p.id === target!.id);
        if (idx >= 0) {
          g.fxs.push({
            id: g.nextId++,
            kind: 'poof',
            x: plantX(target.col),
            y: plantY(target.row),
            elevation: 30,
            t: 0,
            ttl: 0.4,
          });
          g.plants.splice(idx, 1);
          events.push({ type: 'gulp' });
        }
        z.eatingId = null;
      }
    } else {
      z.eatingId = null;
      const sp = z.speed * (z.slowT > 0 ? SLOW_FACTOR : 1);
      z.y += sp * dt;
    }

    // у дома: срабатывает косилка, либо поражение
    const mower = g.mowers[z.col];
    if (z.y > LAWN_BOTTOM - 12) {
      if (mower && mower.state === 'idle') {
        mower.state = 'run';
        events.push({ type: 'mower' });
      } else if ((!mower || mower.state === 'gone') && z.y > LAWN_BOTTOM + 60) {
        g.status = 'lost';
        g.loseCol = z.col;
        events.push({ type: 'lose' });
        return events;
      }
    }
  }

  // ---------- газонокосилки (едут вверх по дорожке) ----------
  for (const m of g.mowers) {
    if (m.state !== 'run') continue;
    m.y -= 620 * dt;
    g.zombies.forEach((z) => {
      if (z.col === m.col && z.dieT === null && Math.abs(z.y - (m.y - 10)) < 56) {
        hurtZombie(g, z, 100000, events);
      }
    });
    if (m.y < -120) m.state = 'gone';
  }

  // ---------- солнышки ----------
  for (let i = g.suns.length - 1; i >= 0; i--) {
    const s = g.suns[i];
    if (s.collected) {
      s.collectT += dt;
      if (s.collectT >= TRANSFER_TIME) {
        if (!s.paidOnHit) {
          g.sun += SUN_VALUE;
          events.push({ type: 'collect' });
        }
        g.suns.splice(i, 1);
      }
      continue;
    }
    if (!s.landed) {
      s.vy += (s.grav + (s.reserved ? 520 : 0)) * dt;
      s.y += s.vy * dt;
      if (s.vy > 0 && s.y >= s.ty) {
        s.y = s.ty;
        s.vy = 0;
        s.grav = 0;
        s.landed = true;
      }
    } else if (!s.reserved) {
      s.life -= dt;
      if (s.life <= 0) g.suns.splice(i, 1);
    }
  }

  // ---------- эффекты ----------
  for (let i = g.fxs.length - 1; i >= 0; i--) {
    const fx = g.fxs[i];
    fx.t += dt;
    if (fx.t >= fx.ttl) g.fxs.splice(i, 1);
  }

  advanceShots(g, dt, events);
  advanceRover(g, dt, events);
  updateMowerMods(g, dt, events, hurtZombie);
  return events;
}

function firePea(g: Game, p: Plant, events: GameEvent[]) {
  const pea: Pea = {
    id: g.nextId++,
    col: p.col,
    y: plantY(p.row),
    ice: p.type === 'snowpea',
  };
  g.peas.push(pea);
  events.push({ type: 'shoot' });
}

function hurtZombie(g: Game, z: Zombie, dmg: number, events: GameEvent[]) {
  if (z.dieT !== null) return;
  z.hp -= dmg;
  z.flashT = 0.09;
  if (z.hp <= 0) {
    z.dieT = 0;
    z.eatingId = null;
    g.killed++;
    events.push({ type: 'zdie' });
  }
}
