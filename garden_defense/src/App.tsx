// ============================================================
// Garden Defense Mini — главный компонент (вертикальная арена)
// Верх: карточки растений. Середина: газон, зомби идут сверху.
// Низ: дом, прогресс волн и кнопки управления.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Bot, FastForward, Flag, Gamepad2, Maximize, Minimize, MousePointer2, Pause, Play, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
import { createGame, tick, shovelAt } from './game/engine';
import { clearPilotInput, fireAtField, fireDirectionalCannon, fireShot, muzzlePoint, plantingPoint, requestFenceCommand, requestPlanting, requestSeed, requestSun, setPilotMode, type Point } from './game/rover';
import { pickFenceSection } from './game/fence';
import { cellAtPoint } from './game/perspective';
import { sunPoint, type SeedBox } from './game/cannon';
import {
  BOTTOM_BAR_H,
  Game,
  GameEvent,
  PLANT_MAP,
  PlantType,
  STAGE_H,
  STAGE_W,
  TOP_BAR_H,
  TOTAL_ZOMBIES,
  WAVES,
} from './game/constants';
import { sfx, setMuted } from './game/audio';
import { Board, type BorderTarget } from './components/Board';
import { CardBar } from './components/CardBar';
import { SmartMowerLayer } from './components/SmartMower';
import { CannonSight } from './components/CannonSight';
import { VirtualJoysticks } from './components/VirtualJoysticks';
import { MousePilotLayer } from './components/MousePilotLayer';
import { MenuScreen } from './components/MenuScreen';
import { LoseScreen, PauseScreen, ReadyOverlay, WaveBanner, WinScreen } from './components/Overlays';
import { cn } from './utils/cn';

interface Banner {
  text: string;
  final: boolean;
  key: number;
}

// ---------- Полноэкранный режим (с запасными вариантами) ----------

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const isNativeFsActive = () => {
  const d = document as FsDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
};

async function requestNativeFs(): Promise<boolean> {
  const el = document.documentElement as FsElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  try {
    // на Android — фиксируем портретную ориентацию (там, где поддерживается)
    const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> } | undefined;
    await orientation?.lock?.('portrait');
  } catch {
    /* блокировка ориентации не поддерживается — ничего страшного */
  }
  return true;
}

async function exitNativeFs() {
  const d = document as FsDocument;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* ignore */
  }
}

// ---------- Главный компонент ----------

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [initialGame] = useState(createGame);
  const gameRef = useRef<Game>(initialGame);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [shovel, setShovel] = useState(false);
  const [controlMode, setControlMode] = useState<'controller' | 'mouse'>(() => {
    if (typeof window === 'undefined') return 'controller';
    return window.matchMedia('(pointer: coarse)').matches ? 'controller' : 'mouse';
  });
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [fast, setFast] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [endTime, setEndTime] = useState(0);
  const [scale, setScale] = useState(1);
  const [nativeFs, setNativeFs] = useState(false);
  const [fakeFs, setFakeFs] = useState(false);
  const [notice, setNotice] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fastRef = useRef(false);
  const pausedRef = useRef(false);
  fastRef.current = fast;
  pausedRef.current = paused;
  const fsOn = nativeFs || fakeFs;

  // ---------- масштабирование сцены под экран ----------
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / STAGE_W, r.height / STAGE_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- синхронизация полного экрана (в т.ч. выход по Esc) ----------
  useEffect(() => {
    const sync = () => setNativeFs(isNativeFsActive());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (nativeFs) {
      await exitNativeFs();
      return;
    }
    if (fakeFs) {
      setFakeFs(false);
      return;
    }
    const ok = await requestNativeFs();
    // iOS Safari не разрешает полный экран для страниц — эмулируем на весь вьюпорт
    if (!ok) {
      setFakeFs(true);
      setNotice('Игра занимает весь доступный экран. На iPhone для запуска без панелей добавьте игру на экран «Домой».');
    }
  }, [nativeFs, fakeFs]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // ---------- обработка событий движка (звуки, баннеры) ----------
  const handleEvents = useCallback((events: GameEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'shoot': sfx.shoot(); break;
        case 'laser': sfx.strikerLaser(); break;
        case 'splat': sfx.splat(); break;
        case 'chomp': sfx.chomp(); break;
        case 'gulp': sfx.gulp(); break;
        case 'plant': sfx.plant(); break;
        case 'loaded': sfx.loaded(); break;
        case 'marked': sfx.click(); break;
        case 'sunborn': sfx.sunborn(); break;
        case 'collect': sfx.collect(); break;
        case 'boom': sfx.boom(); break;
        case 'mower': sfx.mower(); break;
        case 'zdie': sfx.zdie(); break;
        case 'wave': {
          sfx.wave();
          const g = gameRef.current;
          const w = WAVES[g.wave];
          if (w?.banner) setBanner({ text: w.banner, final: false, key: g.wave });
          break;
        }
        case 'finalwave': {
          sfx.finalwave();
          const w = WAVES[WAVES.length - 1];
          setBanner({ text: w.banner ?? 'ФИНАЛЬНАЯ ВОЛНА!', final: true, key: 999 });
          break;
        }
        case 'win': sfx.win(); setEndTime(gameRef.current.time); break;
        case 'lose': sfx.lose(); break;
        case 'shovel': sfx.click(); break;
        case 'error': sfx.error(); break;
      }
    }
  }, []);

  const fireManual = useCallback((dir?: Point) => {
    const game = gameRef.current;
    if (pausedRef.current || !game.auto || !['ready', 'playing'].includes(game.status)) return;
    const allEvents: GameEvent[] = [];
    let dx = dir?.x;
    let dy = dir?.y;
    if (dx === undefined || dy === undefined || (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001)) {
      if (game.rover.manualAim && (Math.abs(game.rover.manualAim.x) > 0.05 || Math.abs(game.rover.manualAim.y) > 0.05)) {
        dx = game.rover.manualAim.x;
        dy = game.rover.manualAim.y;
      } else {
        const rad = (game.rover.heading - 90) * Math.PI / 180;
        dx = Math.cos(rad);
        dy = Math.sin(rad);
      }
    }
    if (fireDirectionalCannon(game, dx, dy, allEvents)) {
      if (allEvents.length) handleEvents(allEvents);
      force();
    }
  }, [handleEvents]);

  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (screen !== 'game') return;

    const updateMovement = () => {
      const keys = pressedKeysRef.current;
      const game = gameRef.current;
      let mx = 0;
      let my = 0;
      game.rover.thrustHeld.key = keys.has('KeyW');
      if (keys.has('KeyS')) my += 1;
      if (keys.has('KeyA')) mx -= 1;
      if (keys.has('KeyD')) mx += 1;
      const len = Math.hypot(mx, my);
      game.rover.manualMove = len > 0 ? { x: mx / len, y: my / len } : { x: 0, y: 0 };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ['ready', 'playing'].includes(gameRef.current.status)) {
        if (e.repeat) return;
        setPaused((p) => !p);
        return;
      }
      if (pausedRef.current || !gameRef.current.auto || !['ready', 'playing'].includes(gameRef.current.status)) return;
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) return;
      e.preventDefault();
      if (['KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        gameRef.current.rover.cursorPoint = null;
        gameRef.current.rover.manualAim = null;
      }
      if (e.repeat && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        return;
      }

      pressedKeysRef.current.add(e.code);
      updateMovement();

      // Keyboard arrow keys shoot in that direction when in manual pilot
      if (gameRef.current.auto && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        let ax = 0;
        let ay = 0;
        if (e.code === 'ArrowUp') ay -= 1;
        if (e.code === 'ArrowDown') ay += 1;
        if (e.code === 'ArrowLeft') ax -= 1;
        if (e.code === 'ArrowRight') ax += 1;
        gameRef.current.rover.cursorPoint = null;
        gameRef.current.rover.manualAim = { x: ax, y: ay };
        fireManual({ x: ax, y: ay });
        return;
      }

      // Space fires in current direction
      if (gameRef.current.auto && e.code === 'Space') {
        e.preventDefault();
        fireManual();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pressedKeysRef.current.delete(e.code)) updateMovement();
    };

    const resetInput = () => {
      pressedKeysRef.current.clear();
      clearPilotInput(gameRef.current.rover);
    };
    const onHide = () => {
      if (document.hidden) setPaused(true);
      resetInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', resetInput);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', resetInput);
      document.removeEventListener('visibilitychange', onHide);
      resetInput();
    };
  }, [screen, fireManual]);

  // ---------- игровой цикл ----------
  useEffect(() => {
    if (screen !== 'game') return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      if (pausedRef.current || gameRef.current.status === 'won' || gameRef.current.status === 'lost') return;
      if (fastRef.current) dt *= 2;
      acc += dt;
      const allEvents: GameEvent[] = [];
      let guard = 0;
      while (acc >= STEP && guard++ < 12) {
        acc -= STEP;
        allEvents.push(...tick(gameRef.current, STEP));
      }
      if (allEvents.length) handleEvents(allEvents);
      force();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, handleEvents]);

  // авто-скрытие баннера
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 3100);
    return () => clearTimeout(t);
  }, [banner]);

  const startGame = useCallback(() => {
    gameRef.current = createGame();
    pressedKeysRef.current.clear();
    setShovel(false);
    setPaused(false);
    setFast(false);
    setBanner(null);
    setNotice('');
    setScreen('game');
    sfx.click();
    force();
  }, []);

  const g = gameRef.current;
  const selected = g.rover.order?.type ?? g.rover.cargo;

  useEffect(() => {
    if (paused || screen !== 'game' || !['ready', 'playing'].includes(g.status)) {
      pressedKeysRef.current.clear();
      clearPilotInput(g.rover);
    }
  }, [paused, screen, g, g.status]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (screen !== 'game' || !stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = (v: number) => (v - bounds.left) * STAGE_W / bounds.width;
      const y = (v: number) => (v - bounds.top) * STAGE_H / bounds.height;
      g.rover.seedBoxes = Array.from(stage.querySelectorAll<HTMLButtonElement>('[data-seed]'), (button): SeedBox => {
        const b = button.getBoundingClientRect();
        return { type: button.dataset.seed as PlantType, minX: x(b.left), maxX: x(b.right), minY: y(b.top), maxY: y(b.bottom),
          centerX: x(b.left + b.width / 2), centerY: y(b.top + b.height / 2) };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    stage.querySelectorAll('[data-seed]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [screen, g, selected, scale]);

  const sendShot = (kind: Parameters<typeof fireShot>[1], target: Point, payload: Parameters<typeof fireShot>[3]) => {
    const events: GameEvent[] = [];
    if (fireShot(g, kind, target, payload, events)) handleEvents(events);
    force();
  };

  const showCommandError = (reason: ReturnType<typeof requestSeed>, type: PlantType | null) => {
    const messages = {
      busy: 'М-01 занята. Дождись завершения текущей задачи.',
      funds: type ? `Для посадки нужно ${PLANT_MAP[type].cost} солнца` : 'Недостаточно солнца',
      cooldown: type ? `Перезарядка: ${Math.ceil(g.cds[type])} с` : 'Растение перезаряжается',
      occupied: 'Клетка занята. Выберите свободную клетку.',
      invalid: 'Сначала выберите растение на нижней панели.',
      ok: '',
    };
    setNotice(messages[reason]);
    sfx.error();
  };

  const onSeedClick = (type: PlantType | null, button: HTMLButtonElement) => {
    if (paused || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const art = (button.querySelector('[data-seed-art]') ?? button).getBoundingClientRect();
    const source = {
      x: (art.left + art.width / 2 - bounds.left) * STAGE_W / bounds.width,
      y: (art.top + art.height / 2 - bounds.top) * STAGE_H / bounds.height,
    };
    if (g.auto && type) {
      if (g.cds[type] > 0 || g.sun < PLANT_MAP[type].cost) {
        showCommandError(g.cds[type] > 0 ? 'cooldown' : 'funds', type);
        return;
      }
      sendShot('seed', source, { type, source });
      setShovel(false);
      setNotice('');
      return;
    }
    const result = requestSeed(g, type, source);
    if (result !== 'ok') { showCommandError(result, type); return; }
    setShovel(false);
    setNotice('');
    sfx.click();
    force();
  };

  // ---------- действия игрока ----------
  const onCellClick = (row: number, col: number) => {
    const game = gameRef.current;
    if (paused || (game.status !== 'playing' && game.status !== 'ready')) return;
    if (shovel) {
      if (shovelAt(game, row, col)) handleEvents([{ type: 'shovel' }]);
      setShovel(false);
      force();
      return;
    }
    if (!selected) {
      // Without a selected plant the cannon ignores the inter-season wall.
      if (game.auto) {
        const events: GameEvent[] = [];
        if (fireAtField(game, plantingPoint({ row, col }), events)) {
          handleEvents(events);
          force();
        }
      }
      return;
    }
    if (game.auto) {
      sendShot('cell', plantingPoint({ row, col }), { cell: { row, col } });
      return;
    }
    const result = requestPlanting(game, row, col);
    if (result !== 'ok') { showCommandError(result, selected); return; }
    setNotice('');
    sfx.click();
    force();
  };

  const onSunClick = (id: number) => {
    if (paused || !['ready', 'playing'].includes(gameRef.current.status)) return;
    const game = gameRef.current;
    const sun = game.suns.find((s) => s.id === id);
    if (!sun || sun.collected || (!game.auto && sun.reserved)) return;
    if (game.auto) {
      sendShot('sun', sunPoint(sun), { sunId: id });
    } else {
      requestSun(game, id);
    }
    sfx.click();
    force();
  };

  const onBorderShot = (target: BorderTarget) => {
    const game = gameRef.current;
    if (paused || !game.auto || (game.status !== 'playing' && game.status !== 'ready')) return;
    sendShot('border', target, { cell: { row: target.row, col: target.col } });
  };

  const onFenceCommand = (section: string) => {
    const game = gameRef.current;
    if (pausedRef.current) return;
    const events: GameEvent[] = [];
    const result = requestFenceCommand(game, section, events);
    if (result !== 'ok') { showCommandError(result, selected); return; }
    handleEvents(events);
    setNotice('');
    force();
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!g.auto || paused || controlMode !== 'mouse' || !stageRef.current || e.pointerType === 'touch') return;
    const rect = stageRef.current.getBoundingClientRect();
    const stageX = (e.clientX - rect.left) * STAGE_W / rect.width;
    const stageY = (e.clientY - rect.top) * STAGE_H / rect.height;
    aimMouseAt({ x: stageX, y: stageY });
  };

  const aimMouseAt = (point: Point) => {
    point = pickFenceSection(point)?.target ?? point;
    const from = muzzlePoint(g.rover);
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      g.rover.cursorPoint = { ...point };
      g.rover.manualAim = { x: dx / len, y: dy / len };
      force();
    }
  };

  const thrustMouseAt = (point: Point | null) => {
    if (!point) {
      gameRef.current.rover.thrustHeld.mouse = false;
      force();
      return;
    }
    if (pausedRef.current || !g.auto || controlMode !== 'mouse' || !['ready', 'playing'].includes(g.status)) return;
    g.rover.thrustHeld.mouse = true;
    aimMouseAt(point);
    force();
  };

  const fireMouseAt = (point: Point) => {
    const section = pickFenceSection(point);
    if (section) { onFenceCommand(section.id); return; }
    const game = gameRef.current;
    // With a plant on board, clicking a field places it there — even through the limiter.
    if (game.auto && (game.rover.order?.type || game.rover.cargo)) {
      const cell = cellAtPoint(point);
      if (cell) {
        sendShot('cell', plantingPoint(cell), { cell });
        return;
      }
    }
    // A click on the lawn lands the bolt on that field, crossing the limiter when empty.
    const events: GameEvent[] = [];
    if (fireAtField(game, point, events)) {
      handleEvents(events);
      force();
    }
  };

  const toggleControlMode = () => {
    const next = controlMode === 'controller' ? 'mouse' : 'controller';
    pressedKeysRef.current.clear();
    clearPilotInput(g.rover);
    setControlMode(next);
    setNotice(next === 'mouse'
      ? 'Мышь: W или ЛКМ - одинаковая тяга к курсору; ПКМ - выстрел.'
      : 'Контроллер: левый джойстик — движение, правый — прицел и огонь.');
    sfx.click();
    force();
  };

  const toggleAuto = () => {
    const game = gameRef.current;
    if (!['ready', 'playing'].includes(game.status)) return;
    setPilotMode(game, !game.auto);
    pressedKeysRef.current.clear();
    setShovel(false);
    setNotice('');
    sfx.click();
    force();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const progress = Math.min(1, g.killed / TOTAL_ZOMBIES);
  const inGame = g.status === 'playing' || g.status === 'ready';
  const waveLabel = g.wave >= 0 ? `Волна ${Math.min(g.wave + 1, WAVES.length)}/${WAVES.length}` : 'Подготовка';

  const controls = [
    {
      icon: paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />,
      onClick: () => setPaused((p) => !p),
      title: paused ? 'Продолжить' : 'Пауза',
      active: false,
    },
    {
      icon: <Bot className="h-4 w-4" />,
      onClick: toggleAuto,
      title: g.auto
        ? 'Ручной пилот активен (нажмите для автопилота)'
        : 'Переключить на ручной пилот',
      active: g.auto,
    },
    {
      icon: controlMode === 'controller'
        ? <Gamepad2 className="h-4 w-4" />
        : <MousePointer2 className="h-4 w-4" />,
      onClick: toggleControlMode,
      title: controlMode === 'controller'
        ? 'Контроллер: экранные джойстики. Переключить на мышь'
        : 'Мышь: W / ЛКМ - тяга, ПКМ - выстрел. Переключить на контроллер',
      active: g.auto,
    },
    {
      icon: <FastForward className="h-4 w-4" />,
      onClick: () => setFast((f) => !f),
      title: 'Ускорение ×2',
      active: fast,
    },
    {
      icon: muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />,
      onClick: toggleMute,
      title: 'Звук',
      active: false,
    },
    {
      icon: fsOn ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />,
      onClick: () => void toggleFullscreen(),
      title: 'Полный экран',
      active: fsOn,
    },
    {
      icon: <RotateCcw className="h-4 w-4" />,
      onClick: startGame,
      title: 'Заново',
      active: false,
    },
  ];

  return (
    <div
      ref={wrapRef}
      className={cn(
        'flex h-dvh w-screen items-center justify-center overflow-hidden bg-[#0d1f10]',
        fsOn ? 'fixed inset-0 z-[9999]' : 'relative',
      )}
    >
      {screen === 'menu' && <MenuScreen onPlay={startGame} onFullscreen={() => void toggleFullscreen()}
        fsOn={fsOn} muted={muted} onSound={toggleMute} />}
      {screen === 'game' && <div className="play-scenery" aria-hidden="true" />}
      {notice && <div className="viewport-notice" role="status">{notice}</div>}

      {/* масштабируемая сцена 720×1280 */}
      {screen === 'game' && <div
        ref={stageRef}
        onPointerMove={onStagePointerMove}
        className="game-stage relative shrink-0 overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, '--hud-bottom': `${BOTTOM_BAR_H}px` } as React.CSSProperties}
      >
          <div className="gameplay-layers absolute inset-0" inert={paused || !inGame}
            aria-hidden={paused || !inGame || undefined} data-paused={paused}>
            <Board game={g} selected={selected} shovel={shovel} auto={g.auto} onCellClick={onCellClick} onSunClick={onSunClick} onBorderShot={onBorderShot} onFenceCommand={onFenceCommand} />

            {/* ---- верхняя панель: солнце, прогресс и все настройки ---- */}
            <div
              className="arena-hud arena-hud-top absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b-2 px-3"
              style={{ height: TOP_BAR_H }}
            >
              <div id="sun-counter" className="hud-sun" title="Запас солнца">
                <Sun className="h-7 w-7 text-[#ffd54a]" fill="#ffd54a" strokeWidth={1.5} />
                <span>{g.sun}</span>
              </div>

              <div className="hud-wave min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-display text-[13px] uppercase tracking-wide text-[#ffe9a8]">{waveLabel}</span>
                  <span className="font-display text-[12px] text-[#c8d69a]">Зомби {g.killed}/{TOTAL_ZOMBIES}</span>
                </div>
                <div className="relative h-2.5 rounded-full border border-[#2a1a0a] bg-black/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8dd444] to-[#5da824] transition-[width] duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                  {WAVES.map((w, i) => {
                    if (!w.flag) return null;
                    const before = WAVES.slice(0, i).reduce((s, x) => s + x.zombies.length, 0);
                    const pos = (before / TOTAL_ZOMBIES) * 100;
                    return (
                      <Flag
                        key={i}
                        className={cn('absolute -top-2 h-3.5 w-3.5', g.killed >= before ? 'text-red-400' : 'text-white/40')}
                        style={{ left: `calc(${pos}% - 4px)` }}
                        fill="currentColor"
                      />
                    );
                  })}
                  <div
                    className="absolute -top-1 h-4.5 w-4.5 rounded-full border-2 border-[#2c2418] bg-[#9fbf8a] transition-[left] duration-300"
                    style={{ left: `calc(${progress * 100}% - 9px)` }}
                  />
                </div>
              </div>

              <div className="hud-settings flex shrink-0 gap-1.5">
                {controls.map((b, i) => (
                  <button
                    key={i}
                    onClick={b.onClick}
                    title={b.title}
                    aria-label={b.title}
                    className={cn(
                      'arena-control flex items-center justify-center rounded-lg border-2 border-[#5d6a77] text-[#ffe9c8] shadow-[0_2px_0_rgba(0,0,0,0.3)] transition-transform active:translate-y-0.5',
                      b.active ? 'bg-[#247b8a]' : 'bg-gradient-to-b from-[#53696b] to-[#354547]',
                    )}
                  >
                    {b.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- нижняя панель: семена для посадки ---- */}
            <div
              className="arena-hud arena-hud-bottom absolute inset-x-0 bottom-0 z-40 flex items-center justify-center border-t-2 px-3"
              style={{ height: BOTTOM_BAR_H }}
            >
              <CardBar
                game={g}
                selected={selected}
                shovel={shovel}
                onSelect={onSeedClick}
                onShovel={() => {
                  if (paused || !inGame) return;
                  const result = requestSeed(g, null, { x: 0, y: 0 });
                  if (result !== 'ok') { showCommandError(result, selected); return; }
                  setShovel((s) => !s);
                  setNotice('');
                  sfx.click();
                }}
              />
            </div>

            <SmartMowerLayer game={g} />
            {g.auto && <CannonSight game={g} />}
            {g.auto && inGame && !paused && controlMode === 'controller' && (
              <VirtualJoysticks
                onMove={(vec) => {
                  g.rover.manualMove = vec;
                }}
                onAim={(vec) => {
                  g.rover.cursorPoint = null;
                  g.rover.manualAim = vec;
                }}
                onFire={(dir) => {
                  fireManual(dir);
                }}
                disabled={paused}
              />
            )}
            {g.auto && inGame && !paused && controlMode === 'mouse' && (
              <MousePilotLayer
                onThrust={thrustMouseAt}
                onFire={fireMouseAt}
                disabled={paused}
              />
            )}
          </div>
            {g.status === 'ready' && !g.rover.order && <ReadyOverlay t={g.readyT} />}
            {banner && inGame && <WaveBanner text={banner.text} final={banner.final} />}
            {paused && inGame && <PauseScreen onResume={() => setPaused(false)} onMenu={() => setScreen('menu')} />}
            {g.status === 'won' && (
              <WinScreen timeSec={endTime} onRestart={startGame} onMenu={() => setScreen('menu')} />
            )}
            {g.status === 'lost' && <LoseScreen onRestart={startGame} onMenu={() => setScreen('menu')} />}
      </div>}
    </div>
  );
}
