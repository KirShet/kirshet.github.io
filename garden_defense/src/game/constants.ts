// ============================================================
// Gardendless Mini — константы и типы (вертикальная арена)
// Зомби приходят сверху, дом находится внизу.
// ============================================================

import type { Shot, SmartMower } from './rover';

export const STAGE_W = 720;
export const STAGE_H = 1280;

export const TOP_BAR_H = 124;   // панель карточек сверху
export const BOTTOM_BAR_H = 138; // нижняя панель с растениями

// Сетка: COLS дорожек (слева направо) × ROWS клеток вдоль дорожки (сверху вниз).
// Слева и справа от арены лежат такие же настоящие поля, но зомби по ним не ходят.
export const COLS = 4;
export const ROWS = 9;
export const FIELD_W = 600;
export const FIELD_COUNT = COLS + 2;
export const DIVIDER_W = 24;
export const CELL_W = (FIELD_W - DIVIDER_W) / FIELD_COUNT;
export const CELL_H = 100;
export const PAD_W = CELL_W;
export const PAD_H = CELL_H;
export const LAWN_W = FIELD_W;
export const LAWN_H = ROWS * CELL_H;           // 900
export const LAWN_X = (STAGE_W - LAWN_W) / 2;  // 60
export const LAWN_RIGHT = LAWN_X + LAWN_W;     // 660
export const LAWN_TOP = TOP_BAR_H + 8;         // 132
export const LAWN_BOTTOM = LAWN_TOP + LAWN_H;  // 1032
export const MOWER_Y = LAWN_BOTTOM + 14;
export const BLOCK_OFFSET = 34; // зомби упирается в растение на этом расстоянии от верха клетки

// ---------- Растения ----------

export type PlantType =
  | 'sunflower'
  | 'peashooter'
  | 'wallnut'
  | 'snowpea'
  | 'repeater'
  | 'cherrybomb';

export interface PlantDef {
  type: PlantType;
  name: string;
  desc: string;
  cost: number;
  cooldown: number; // секунды перезарядки карточки
  hp: number;
}

export const PLANTS: PlantDef[] = [
  { type: 'sunflower',  name: 'Подсолнух',     desc: 'Даёт солнышки',     cost: 50,  cooldown: 5,  hp: 300 },
  { type: 'peashooter', name: 'Горохострел',   desc: 'Стреляет горохом',  cost: 100, cooldown: 5,  hp: 300 },
  { type: 'wallnut',    name: 'Орех',          desc: 'Крепкая стена',     cost: 50,  cooldown: 18, hp: 4000 },
  { type: 'snowpea',    name: 'Ледяной горох', desc: 'Замедляет зомби',   cost: 175, cooldown: 5,  hp: 300 },
  { type: 'repeater',   name: 'Двойной горох', desc: 'Стреляет дважды',   cost: 200, cooldown: 5,  hp: 300 },
  { type: 'cherrybomb', name: 'Вишня-бомба',   desc: 'Взрыв 3×3',         cost: 150, cooldown: 25, hp: 300 },
];

export const PLANT_MAP = Object.fromEntries(PLANTS.map((p) => [p.type, p])) as Record<PlantType, PlantDef>;

// Слева от арены — поля покупки растений, справа — поля модулей газонокосилки.
export interface ServicePad { type: PlantType; y: number }
export const PLANT_PAD_X = LAWN_X + CELL_W / 2;
export const MOD_PAD_X = LAWN_RIGHT - CELL_W / 2;
// Bottom six rows: right next to the house and the mower's starting bay.
export const PAD_ROWS = [3, 4, 5, 6, 7, 8];
export const PAD_CENTERS = PAD_ROWS.map((row) => LAWN_TOP + row * CELL_H + CELL_H / 2);
export const PLANT_PADS: ServicePad[] = PLANTS.map((plant, i) => ({ type: plant.type, y: PAD_CENTERS[i] }));
export const MOD_PADS: ServicePad[] = PLANTS.map((plant, i) => ({ type: plant.type, y: PAD_CENTERS[i] }));
export interface MowerMod { type: PlantType; cd: number }
export const MOD_COPY: Record<PlantType, string> = {
  sunflower: 'Солнечный генератор',
  peashooter: 'Гороховая пушка',
  wallnut: 'Бронекорпус',
  snowpea: 'Ледяной модуль',
  repeater: 'Двойная пушка',
  cherrybomb: 'Взрывной модуль',
};
export const MOD_HINT: Record<PlantType, string> = {
  sunflower: 'каждые 12 с добавляет 25 солнца',
  peashooter: 'стреляет по ближайшему зомби каждые 1.3 с',
  wallnut: 'таранит зомби, отбрасывая их назад',
  snowpea: 'ледяные выстрелы замедляют зомби',
  repeater: 'быстрый двойной выстрел по зомби',
  cherrybomb: 'каждые 8.5 с взрывается вокруг косилки',
};

// ---------- Зомби ----------

export type ZombieType = 'basic' | 'cone' | 'bucket';

export interface ZombieDef {
  hp: number;
  speed: number; // px / s
  name: string;
}

export const ZOMBIES: Record<ZombieType, ZombieDef> = {
  basic:  { hp: 200,  speed: 17, name: 'Зомби' },
  cone:   { hp: 640,  speed: 17, name: 'Зомби с конусом' },
  bucket: { hp: 1350, speed: 16, name: 'Зомби с ведром' },
};

// ---------- Волны (один уровень) ----------

export interface WaveDef {
  zombies: ZombieType[];
  interval: [number, number]; // пауза между спавнами внутри волны
  flag: boolean;              // «флаговая» волна
  banner?: string;
}

export const WAVES: WaveDef[] = [
  { zombies: ['basic', 'basic'], interval: [7, 9], flag: false },
  { zombies: ['basic', 'basic', 'basic'], interval: [6, 8], flag: false },
  { zombies: ['basic', 'cone', 'basic'], interval: [5, 7], flag: true, banner: 'Волна зомби приближается!' },
  { zombies: ['basic', 'cone', 'basic', 'cone', 'basic'], interval: [4, 6], flag: false },
  { zombies: ['cone', 'basic', 'bucket', 'basic', 'cone'], interval: [4, 6], flag: true, banner: 'Волна зомби приближается!' },
  {
    zombies: ['basic', 'cone', 'basic', 'bucket', 'cone', 'basic', 'bucket', 'cone', 'basic'],
    interval: [2.5, 4],
    flag: true,
    banner: 'ОГРОМНАЯ ВОЛНА ЗОМБИ ПРИБЛИЖАЕТСЯ!',
  },
];

export const TOTAL_ZOMBIES = WAVES.reduce((s, w) => s + w.zombies.length, 0);

// ---------- Экономика солнца ----------

export const START_SUN = 125;
export const SUN_VALUE = 25;
export const SKY_SUN_FIRST = 6;
export const SKY_SUN_EVERY = 9.5;
export const SUN_LIFE = 8;
export const SUNFLOWER_FIRST = 5;
export const SUNFLOWER_EVERY = 14;

// ---------- Баланс боя ----------

export const PEA_DAMAGE = 20;
export const PEA_SPEED = 430;
export const PEA_HEIGHT = 84;
export const FIRE_INTERVAL = 1.45;
export const SLOW_FACTOR = 0.5;
export const SLOW_DURATION = 5;
export const EAT_DPS = 70;
export const CHERRY_DELAY = 1.1;
export const CHERRY_DAMAGE = 1800;
export const FIRST_ZOMBIE_AT = 13;

// ---------- Сущности ----------

export interface Plant {
  id: number;
  type: PlantType;
  row: number;        // индекс клетки вдоль дорожки (0 — верх)
  col: number;        // дорожка (0 — левая)
  hp: number;
  maxHp: number;
  fireT: number;      // до следующего выстрела
  burstLeft: number;  // залп (двойной горох)
  burstT: number;
  sunT: number;       // таймер производства солнца
  armT: number;       // взвод вишни
  flashT: number;     // вспышка при уроне
  bornT: number;      // анимация посадки
}

export interface Zombie {
  id: number;
  type: ZombieType;
  col: number;          // дорожка
  y: number;            // положение переднего края (движется вниз)
  hp: number;
  maxHp: number;
  speed: number;
  slowT: number;
  eatingId: number | null;
  dieT: number | null;  // таймер анимации смерти
  flashT: number;
  wobble: number;
}

export interface Pea {
  id: number;
  col: number;
  y: number;   // летит вверх
  ice: boolean;
}

export interface SunDrop {
  id: number;
  x: number;
  y: number;
  ty: number;        // где приземлится
  vy: number;
  grav: number;      // гравитация (для солнц от подсолнуха)
  landed: boolean;
  reserved: boolean;
  life: number;
  collected: boolean;
  paidOnHit?: boolean;
  collectT: number;
  fx: number;        // позиция косилки на сцене в момент передачи солнца
  fy: number;
}

export interface Mower {
  col: number;
  y: number;
  state: 'idle' | 'run' | 'gone';
}

export interface Fx {
  id: number;
  kind: 'boom' | 'splat' | 'poof' | 'icesplat' | 'leaf' | 'dust' | 'spark' | 'laserhit';
  x: number;
  y: number;
  elevation?: number;
  stageSpace?: boolean;
  t: number;
  ttl: number;
}

export type GameStatus = 'menu' | 'ready' | 'playing' | 'won' | 'lost';

export interface Game {
  status: GameStatus;
  time: number;
  readyT: number;
  sun: number;
  plants: Plant[];
  zombies: Zombie[];
  peas: Pea[];
  suns: SunDrop[];
  mowers: Mower[];
  rover: SmartMower;
  shots: Shot[];
  auto: boolean;
  fxs: Fx[];
  cds: Record<PlantType, number>;
  wave: number;
  waveQueue: ZombieType[];
  spawnT: number;
  breakT: number;
  killed: number;
  spawned: number;
  skySunT: number;
  shakeT: number;
  nextId: number;
  loseCol: number;
}

export type GameEventType =
  | 'shoot'
  | 'laser'
  | 'splat'
  | 'chomp'
  | 'plant'
  | 'loaded'
  | 'marked'
  | 'sunborn'
  | 'collect'
  | 'boom'
  | 'mower'
  | 'zdie'
  | 'wave'
  | 'finalwave'
  | 'win'
  | 'lose'
  | 'shovel'
  | 'error'
  | 'gulp';

export interface GameEvent {
  type: GameEventType;
  x?: number;
  y?: number;
}

// ---------- Геометрия ----------

/** Левая граница клетки в симуляционных координатах */
export const DIVIDER_LEFT = LAWN_X + CELL_W * (COLS / 2 + 1);
export const DIVIDER_RIGHT = DIVIDER_LEFT + DIVIDER_W;
export const columnLeft = (col: number) =>
  col < COLS / 2 ? LAWN_X + CELL_W + col * CELL_W : DIVIDER_RIGHT + (col - COLS / 2) * CELL_W;
/** X-центр клетки */
export const plantX = (col: number) => columnLeft(col) + CELL_W / 2;
/** Верх клетки */
export const cellTop = (row: number) => LAWN_TOP + row * CELL_H;
/** Основание растения (низ клетки) */
export const plantY = (row: number) => cellTop(row) + CELL_H - 12;
/** Центр клетки по Y */
export const rowCenterY = (row: number) => cellTop(row) + CELL_H / 2;

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
