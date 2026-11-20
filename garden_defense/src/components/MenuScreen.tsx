import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight, Flag, Maximize, Minimize, Play, Shield, Sprout, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { COLS, PLANTS, PLANT_MAP, WAVES, ZOMBIES, type PlantType, type ZombieType } from '../game/constants';
import { PlantSprite, ZombieSprite } from '../game/sprites';

type GuideTab = 'rules' | 'plants' | 'zombies';
const enemyTypes: ZombieType[] = ['basic', 'cone', 'bucket'];
const descriptions: Record<PlantType, string> = {
  sunflower: 'Выращивает солнышки каждые 14 секунд. Посади у дома, чтобы накопить солнце для защиты.',
  peashooter: 'Стреляет горошинами вверх по своей дорожке. Поставь за орехом, чтобы стрелять из укрытия.',
  wallnut: 'Останавливает зомби и прикрывает растения за собой. Трещины показывают, сколько сил осталось у ореха.',
  snowpea: 'Ледяные горошины вдвое замедляют зомби на 5 секунд. Другие растения успевают сделать больше выстрелов.',
  repeater: 'Выпускает сразу две горошины за залп. Особенно полезен против зомби в конусах и вёдрах.',
  cherrybomb: 'Взрывается вскоре после посадки и поражает зомби на участке вокруг себя размером 3 × 3 клетки.',
};

function GardenMark() {
  return <svg viewBox="0 0 44 44" aria-hidden="true" className="garden-mark">
    <path d="M22 2 39 9v16c-1 8-9 13-17 17C14 38 6 33 5 25V9Z" fill="#accf63" stroke="#e0f2a5" strokeWidth="1.6" />
    <path d="M22 7 34.5 12v12c0 5.5-5.6 10.2-12.5 14-6.9-3.8-12.5-8.5-12.5-14V12Z" fill="#203c2a" />
    <path d="M21 30c1-8 4-12 10-16 0 9-4 14-10 12M21 27c-7 0-9-4-9-9 7 0 11 4 9 9" fill="#bdde74" />
    <path d="m20 32 5-12" stroke="#d1ed90" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

function Guide({ initialTab, initialPlant, onClose }: {
  initialTab: GuideTab; initialPlant: PlantType; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(initialTab);
  const [unit, setUnit] = useState(initialPlant);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const def = PLANT_MAP[unit];
  return <dialog ref={dialog} className="field-guide" aria-labelledby="guide-heading"
    onCancel={(e) => { e.preventDefault(); onClose(); }}
    onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
    <div className="guide-inner">
      <div className="guide-heading-row"><span className="guide-kicker"><Sprout size={15} /> САДОВЫЙ АЛЬМАНАХ</span>
        <button className="guide-close" onClick={onClose} aria-label="Закрыть справочник"><X size={19} /></button>
      </div>
      <h2 id="guide-heading">Полевой справочник</h2>
      <div className="guide-tabs" aria-label="Разделы справочника">
        {(['rules', 'plants', 'zombies'] as const).map((t, i) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{['Правила', 'Растения', 'Зомби'][i]}</button>
        ))}
      </div>
      {tab === 'rules' && <div className="guide-rules">
        <div><span><Sun /></span><section><h3>Собирай солнце</h3><p>Попадание лазером сразу даёт 25 солнца. Без пушки нажми на солнышко, и М-01 подъедет за ним.</p></section></div>
        <div><span><Sprout /></span><section><h3>Отправляй косилку на посадку</h3><p>Нажми на карточку: М-01 заберёт растение на борт. Укажи свободную клетку, и косилка отвезёт туда растение. Клетку можно выбрать ещё во время погрузки.</p></section></div>
        <div><span><Shield /></span><section><h3>Защити четыре дорожки</h3><p>Слева две снежные дорожки, справа две осенние. Выдержи все {WAVES.length} волн зомби. У каждой дорожки своя косилка.</p></section></div>
        <div><span><BookOpen /></span><section><h3>Управляй у забора</h3><p>W и удержание ЛКМ дают одинаковую тягу. ПКМ стреляет. Без выбранного растения лазер проходит сквозь широкий межсезонный разделитель; с растением останавливается у него. Для посадки нужны два попадания в одну секцию внешнего забора.</p></section></div>
        <div><span><Shield /></span><section><h3>Поля у кромки</h3><p>По обе стороны внизу лежат обычные поля без зомби. Стрельни 2 раза в забор у такого поля без выбранного растения: слева купишь растение на борт, справа активируешь способность М-01 (работает только одна способность за раз).</p></section></div>
      </div>}
      {tab === 'plants' && <div className="guide-plants">
        <div className="guide-seeds">{PLANTS.map((p) => <button key={p.type} aria-label={p.name} title={p.name}
          aria-pressed={unit === p.type} onClick={() => setUnit(p.type)}><PlantSprite type={p.type} mini /></button>)}</div>
        <div className="plant-profile"><div className="profile-art"><PlantSprite type={unit} /></div>
          <div><span className="guide-kicker">РАСТЕНИЕ {String(PLANTS.indexOf(def) + 1).padStart(2, '0')}</span><h3>{def.name}</h3><p>{descriptions[unit]}</p></div>
        </div>
        <div className="profile-facts"><span><Sun size={16} /> {def.cost} солнца</span><span>{def.cooldown} с перезарядки</span></div>
      </div>}
      {tab === 'zombies' && <div className="guide-enemies">{enemyTypes.map((type, i) => <div key={type}>
        <span><ZombieSprite type={type} eating={false} dying={false} slowed={false} /></span>
        <section><h3>{ZOMBIES[type].name}</h3><p>{['Обычный гость сада. Его легко остановить горохом.', 'Дорожный конус защищает от первых попаданий.', 'Самый крепкий противник. Замедли его ледяным горохом.'][i]}</p></section>
      </div>)}</div>}
      <button className="guide-done" onClick={onClose}>Вернуться в меню <ChevronRight size={17} /></button>
    </div>
  </dialog>;
}

export function MenuScreen({ onPlay, onFullscreen, fsOn, muted, onSound }: {
  onPlay: () => void; onFullscreen: () => void; fsOn: boolean; muted: boolean; onSound: () => void;
}) {
  const [guide, setGuide] = useState<{ tab: GuideTab; plant: PlantType } | null>(null);
  return <main className="garden-menu">
    <img className="menu-scenery" src="/images/gardener-keyart.jpg" alt="" fetchPriority="high" draggable={false} />
    <div className="menu-shade" />
    <header className="menu-header">
      <div className="mini-brand"><GardenMark /><div><strong>GARDEN DEFENSE</strong><span>MINI EDITION</span></div></div>
      <nav className="menu-tools" aria-label="Настройки игры">
        <button className="help-trigger" onClick={() => setGuide({ tab: 'rules', plant: 'sunflower' })}><BookOpen size={17} /> Как играть</button>
        <button className="sound-trigger" onClick={onSound} aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          aria-pressed={!muted} title={muted ? 'Включить звук' : 'Выключить звук'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </nav>
    </header>

    <section className="menu-main" aria-labelledby="game-title">
      <div className="menu-copy">
        <div className="menu-eyebrow"><i /> ТАКТИЧЕСКАЯ МИНИ-ИГРА</div>
        <h1 className="game-wordmark" id="game-title" aria-label="Garden Defense">
          <span className="word-garden">GARDEN<svg viewBox="0 0 48 40" className="wordmark-leaves" aria-hidden="true">
            <path d="M9 35C-1 23 1 12 3 8c14 4 21 14 14 26" fill="#8ac543" stroke="#263b21" strokeWidth="3" />
            <path d="M15 34C14 13 26 3 44 2c-1 19-11 32-29 32Z" fill="#b2df61" stroke="#263b21" strokeWidth="3.5" />
            <path d="m14 37 21-25" fill="none" stroke="#567d30" strokeWidth="3" strokeLinecap="round" />
          </svg></span>
          <span className="word-defense">DEFENSE</span>
        </h1>
        <p className="menu-description">Управляй умной косилкой, собирай солнце<br className="desktop-break" /> и защити свой сад от нашествия зомби.</p>
        <div className="menu-actions">
          <button className="play-action" onClick={onPlay}><Play size={22} fill="currentColor" strokeWidth={1.5} /> Играть</button>
          <button className="fullscreen-action" onClick={onFullscreen} aria-pressed={fsOn}>
            {fsOn ? <Minimize size={18} /> : <Maximize size={18} />}{fsOn ? 'Свернуть' : 'На весь экран'}
          </button>
        </div>
      </div>
    </section>

    <footer className="menu-footer">
      <div className="loadout"><div className="loadout-label"><span className="footer-eyebrow">ПЕРЕД БОЕМ</span><strong>Твой отряд</strong></div>
        <div className="loadout-units" aria-label="Ваш набор растений">{PLANTS.map((p) => (
          <button key={p.type} title={p.name} aria-label={`Справочник: ${p.name}`}
            onClick={() => setGuide({ tab: 'plants', plant: p.type })}><PlantSprite type={p.type} mini /><span className="seed-hint"><ArrowUpRight size={10} /></span></button>
        ))}</div>
      </div>
      <div className="level-caption"><span className="level-symbol"><Flag size={23} /></span>
        <div><span className="footer-eyebrow">УРОВЕНЬ 01 <b> / </b> {COLS} ДОРОЖКИ</span><strong>Сад двух сезонов</strong></div>
      </div>
    </footer>
    {guide && <Guide initialTab={guide.tab} initialPlant={guide.plant} onClose={() => setGuide(null)} />}
  </main>;
}