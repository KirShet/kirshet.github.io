import { CHERRY_DELAY, COLS, PLANT_MAP, ROWS, SUNFLOWER_FIRST, type Game, type PlantType } from './constants';

export const isCell = (row: number, col: number) =>
  Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < ROWS && col >= 0 && col < COLS;

export const plantAt = (g: Game, row: number, col: number) => g.plants.find((p) => p.row === row && p.col === col);

// The delivery is one transaction: validate the cell, pay, and start its cooldown.
// A plant already bought on the divider is prepaid: only the cell needs validation.
export function tryPlant(g: Game, type: PlantType, row: number, col: number, prepaid = false): boolean {
  const def = PLANT_MAP[type];
  if (!isCell(row, col) || (g.status !== 'ready' && g.status !== 'playing')) return false;
  if (plantAt(g, row, col)) return false;
  if (!prepaid) {
    if (g.sun < def.cost || g.cds[type] > 0) return false;
    g.sun -= def.cost;
    g.cds[type] = def.cooldown;
  }
  g.plants.push({
    id: g.nextId++, type, row, col, hp: def.hp, maxHp: def.hp,
    fireT: .8, burstLeft: 0, burstT: 0, sunT: SUNFLOWER_FIRST,
    armT: type === 'cherrybomb' ? CHERRY_DELAY : 0, flashT: 0, bornT: 0,
  });
  return true;
}