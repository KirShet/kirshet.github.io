import { Flag, Home, Play, RotateCcw, Trophy } from 'lucide-react';
import { ZombieSprite } from '../game/sprites';

// ---------- Отсчёт перед началом ----------

export function ReadyOverlay({ t }: { t: number }) {
  const label = t > 1.8 ? 'НА СТАРТ…' : t > 0.9 ? 'ВНИМАНИЕ…' : 'САЖАЙ!';
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div
        key={label}
        className="anim-ready font-display text-7xl text-[#ffe9a8]"
        style={{ textShadow: '0 4px 0 #7a4a16, 0 10px 30px rgba(0,0,0,0.6)' }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------- Баннер волны ----------

export function WaveBanner({ text, final }: { text: string; final: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
      <div
        className="anim-banner flex items-center gap-4 rounded-2xl border-4 px-8 py-5"
        style={{
          background: final ? 'linear-gradient(180deg,#8a1f1f,#5d1212)' : 'linear-gradient(180deg,#6b4a22,#4a3014)',
          borderColor: final ? '#ffb0a0' : '#d8b45a',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <Flag className={final ? 'h-9 w-9 text-[#ffb0a0]' : 'h-7 w-7 text-[#ffe9a8]'} />
        <span
          className={`font-display text-center ${final ? 'text-3xl text-[#ffd9d2]' : 'text-2xl text-[#ffe9a8]'}`}
          style={{ textShadow: '0 3px 0 rgba(0,0,0,0.45)' }}
        >
          {text}
        </span>
        <Flag className={final ? 'h-9 w-9 -scale-x-100 text-[#ffb0a0]' : 'h-7 w-7 -scale-x-100 text-[#ffe9a8]'} />
      </div>
    </div>
  );
}

// ---------- Победа ----------

export function WinScreen({ onRestart, onMenu, timeSec }: { onRestart: () => void; onMenu: () => void; timeSec: number }) {
  const mm = Math.floor(timeSec / 60);
  const ss = Math.floor(timeSec % 60).toString().padStart(2, '0');
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-[3px]">
      <div className="anim-float-up flex flex-col items-center rounded-3xl border-4 border-[#d8b45a] bg-gradient-to-b from-[#3d5a1e] to-[#243812] px-12 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <Trophy className="mb-3 h-16 w-16 text-[#ffd54a]" fill="#ffd54a" />
        <h2
          className="font-display text-4xl text-[#ffe9a8]"
          style={{ textShadow: '0 3px 0 #7a4a16, 0 8px 24px rgba(0,0,0,0.6)' }}
        >
          УРОВЕНЬ ПРОЙДЕН!
        </h2>
        <p className="mt-3 font-body text-lg font-bold text-[#d8f3b0]">Сад спасён · время: {mm}:{ss}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <button
            onClick={onRestart}
            className="flex items-center gap-2 rounded-xl border-b-4 border-[#3f7a16] bg-gradient-to-b from-[#8dd444] to-[#5da824] px-7 py-3 font-display text-xl text-white transition-transform hover:scale-105 active:translate-y-0.5"
          >
            <RotateCcw className="h-5 w-5" /> ЕЩЁ РАЗ
          </button>
          <button
            onClick={onMenu}
            className="flex items-center gap-2 rounded-xl border-b-4 border-[#6b4a22] bg-gradient-to-b from-[#9b713d] to-[#7d5628] px-7 py-3 font-display text-xl text-[#ffe9c8] transition-transform hover:scale-105 active:translate-y-0.5"
          >
            <Home className="h-5 w-5" /> МЕНЮ
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Поражение ----------

export function LoseScreen({ onRestart, onMenu }: { onRestart: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2a0808]/70 px-6 backdrop-blur-[3px]">
      <div className="anim-float-up flex flex-col items-center rounded-3xl border-4 border-[#a05050] bg-gradient-to-b from-[#4a1a1a] to-[#2a0e0e] px-12 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="mb-2 h-28 w-24 opacity-90">
          <ZombieSprite type="basic" eating dying={false} slowed={false} />
        </div>
        <h2
          className="font-display text-4xl text-[#ffb0a0]"
          style={{ textShadow: '0 3px 0 #5d1212, 0 8px 24px rgba(0,0,0,0.6)' }}
        >
          ЗОМБИ ПРОРВАЛИСЬ!
        </h2>
        <p className="mt-3 text-center font-body text-lg font-bold text-[#e8c8c0]">
          Они добрались до дома… попробуйте другую тактику
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <button
            onClick={onRestart}
            className="flex items-center gap-2 rounded-xl border-b-4 border-[#3f7a16] bg-gradient-to-b from-[#8dd444] to-[#5da824] px-7 py-3 font-display text-xl text-white transition-transform hover:scale-105 active:translate-y-0.5"
          >
            <RotateCcw className="h-5 w-5" /> ЗАНОВО
          </button>
          <button
            onClick={onMenu}
            className="flex items-center gap-2 rounded-xl border-b-4 border-[#6b4a22] bg-gradient-to-b from-[#9b713d] to-[#7d5628] px-7 py-3 font-display text-xl text-[#ffe9c8] transition-transform hover:scale-105 active:translate-y-0.5"
          >
            <Home className="h-5 w-5" /> МЕНЮ
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Пауза ----------

export function PauseScreen({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#11281d]/80 backdrop-blur-[3px]"
      role="dialog" aria-modal="true" aria-labelledby="pause-title"
    >
      <div className="text-center">
        <h2 id="pause-title" className="font-display text-6xl text-[#fff3bd]" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          ПАУЗА
        </h2>
        <button className="pause-resume" autoFocus onClick={onResume}><Play size={22} fill="currentColor" /> Продолжить</button>
        <button className="pause-menu" onClick={onMenu}><Home size={18} /> Выйти в меню</button>
      </div>
    </div>
  );
}
