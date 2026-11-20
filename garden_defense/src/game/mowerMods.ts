// ============================================================
// Модуль газонокосилки: поле справа от арены даёт М-01
// способность растения. Одновременно работает один модуль.
// ============================================================

import {
  MOD_COPY, MOD_HINT, SUN_VALUE, plantX,
  type Game, type GameEvent, type PlantType, type Zombie,
} from './constants';
import { projectGround } from './perspective';
import { fireBolt, muzzlePoint, type Point } from './rover';

type DamageFn = (g: Game, z: Zombie, damage: number, events: GameEvent[]) => void;

const COOLDOWN: Record<PlantType, number> = {
  sunflower: 12, peashooter: 1.3, wallnut: 0, snowpea: 1.8, repeater: .72, cherrybomb: 8.5,
};

export const modName = (type: PlantType) => `${MOD_COPY[type]} — ${MOD_HINT[type]}`;
export const modCooldown = (type: PlantType) => COOLDOWN[type];

/** Ставит модуль на косилку. Одновременно работает только один. */
export function acquireMod(g: Game, type: PlantType): boolean {
  const r = g.rover;
  if (r.mod?.type === type) {
    r.mod.cd = Math.min(r.mod.cd, .25);
    return false;
  }
  r.mod = { type, cd: .65 };
  return true;
}

function nearestZombie(g: Game, origin: Point, range: number) {
  let best: { zombie: Zombie; point: Point } | null = null;
  let distance = range;
  for (const z of g.zombies) {
    if (z.dieT !== null) continue;
    const point = projectGround(plantX(z.col), z.y, 65);
    const d = Math.hypot(point.x - origin.x, point.y - origin.y);
    if (d < distance) {
      distance = d;
      best = { zombie: z, point };
    }
  }
  return best;
}

function boltAt(g: Game, events: GameEvent[], damage: number, slow = false, spread = 0) {
  const target = nearestZombie(g, muzzlePoint(g.rover, true), 380);
  if (target) fireBolt(g, target.zombie.id, damage, slow, spread, events);
}

/** Автоматическая способность установленного модуля. */
export function updateMowerMods(g: Game, dt: number, events: GameEvent[], damage: DamageFn) {
  const r = g.rover;
  const mod = r.mod;
  if (!g.auto || !mod) return;
  if (mod.cd > 0) mod.cd = Math.max(0, mod.cd - dt);

  if (mod.type === 'wallnut') {
    // Бронекорпус работает постоянно: М-01 отбрасывает зомби назад.
    for (const z of g.zombies) {
      if (z.dieT !== null) continue;
      const point = projectGround(plantX(z.col), z.y, 65);
      if (Math.hypot(point.x - r.x, point.y - r.y) > 54) continue;
      damage(g, z, 95 * dt, events);
      z.y = Math.max(0, z.y - 30 * dt);
    }
    return;
  }

  if (mod.cd > 0) return;
  mod.cd = COOLDOWN[mod.type];
  if (mod.type === 'sunflower') {
    g.sun += SUN_VALUE;
    r.feedback = { kind: 'sun', at: { x: r.x, y: r.y - 36 }, age: 0 };
    events.push({ type: 'collect' });
  } else if (mod.type === 'peashooter') {
    boltAt(g, events, 22);
  } else if (mod.type === 'snowpea') {
    boltAt(g, events, 18, true);
  } else if (mod.type === 'repeater') {
    boltAt(g, events, 20, false, -7);
    boltAt(g, events, 20, false, 7);
  } else if (mod.type === 'cherrybomb') {
    g.fxs.push({ id: g.nextId++, kind: 'boom', x: r.x, y: r.y, stageSpace: true, t: 0, ttl: .55 });
    g.shakeT = .35;
    events.push({ type: 'boom' });
    for (const z of g.zombies) {
      if (z.dieT !== null) continue;
      const point = projectGround(plantX(z.col), z.y, 65);
      if (Math.hypot(point.x - r.x, point.y - r.y) > 165) continue;
      damage(g, z, 720, events);
    }
  }
}
