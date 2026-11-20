// ============================================================
// Нижняя панель с семенами: карточки растений и лопата
// ============================================================

import { Shovel, Sun } from 'lucide-react';
import { Game, PLANTS, PlantType } from '../game/constants';
import { PlantSprite } from '../game/sprites';
import { cn } from '../utils/cn';

export function CardBar({
  game,
  selected,
  shovel,
  onSelect,
  onShovel,
}: {
  game: Game;
  selected: PlantType | null;
  shovel: boolean;
  onSelect: (t: PlantType | null, card: HTMLButtonElement) => void;
  onShovel: () => void;
}) {
  return (
    <div className="seed-tray flex items-stretch justify-center gap-2">
      <div className="seed-tray-heading" aria-hidden="true">
        <span>СЕМЕНА</span>
        <strong>Выбери растение</strong>
      </div>

      {PLANTS.map((def) => {
        const cd = game.cds[def.type];
        const cdRatio = cd / def.cooldown;
        const affordable = game.sun >= def.cost;
        const ready = cd <= 0 && affordable;
        const isSel = selected === def.type;
        return (
          <button
            key={def.type}
            data-seed={def.type}
            aria-label={`${def.name}: ${def.cost} солнца`}
            aria-pressed={isSel}
            onClick={(e) => onSelect(isSel ? null : def.type, e.currentTarget)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (game.auto) onSelect(def.type, e.currentTarget);
            }}
            className={cn(
              'group relative w-[82px] overflow-hidden rounded-xl border-2 transition-transform duration-100',
              isSel
                ? '-translate-y-1.5 border-[#a9f0ff] shadow-[0_0_0_3px_rgba(34,211,238,0.45),0_8px_16px_rgba(0,0,0,0.4)]'
                : 'border-[#52616b] shadow-[0_2px_0_rgba(0,0,0,0.3)]',
              ready ? 'bg-gradient-to-b from-[#4d6265] to-[#354547]' : 'bg-gradient-to-b from-[#3d4a4b] to-[#2b3435]',
              !isSel && ready && 'hover:-translate-y-1',
            )}
            title={`${def.name} — ${def.desc}`}
          >
            <div data-seed-art className={cn('h-[66px] p-1 pt-0.5', !ready && 'opacity-55 grayscale-[0.4]')}>
              <PlantSprite type={def.type} mini />
            </div>
            <div
              className={cn(
                'flex items-center justify-center gap-0.5 pb-1.5 font-display text-[16px] leading-none',
                affordable ? 'text-[#ffe9a8]' : 'text-[#ff9d8a]',
              )}
            >
              <Sun className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1} />
              {def.cost}
            </div>
            {cd > 0 && (
              <div
                className="absolute inset-x-0 bottom-0 bg-[#071114]/72 backdrop-blur-[1px]"
                style={{ height: `${cdRatio * 100}%` }}
              />
            )}
            {cd > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-lg text-white/90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  {Math.ceil(cd)}
                </span>
              </div>
            )}
          </button>
        );
      })}

      <button
        onClick={onShovel}
        aria-pressed={shovel}
        className={cn(
          'flex w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-transform',
          shovel
            ? '-translate-y-1.5 border-[#a9f0ff] bg-gradient-to-b from-[#b0432f] to-[#8a2f20] shadow-[0_0_0_3px_rgba(255,120,90,0.5)]'
            : 'border-[#52616b] bg-gradient-to-b from-[#4d6265] to-[#354547] hover:-translate-y-1',
        )}
        title="Лопата — убрать растение"
      >
        <Shovel className="h-7 w-7 text-[#ffe9c8]" />
        <span className="font-display text-[10px] uppercase tracking-wide text-[#ffe9a8]">Лопата</span>
      </button>
    </div>
  );
}
