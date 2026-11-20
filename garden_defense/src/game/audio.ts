// ============================================================
// Крошечный синтезатор звуковых эффектов на WebAudio
// ============================================================

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 1,
  slideTo?: number,
  delay = 0,
) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 1, freq = 1200, q = 0.8, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() {
    tone(620, 0.09, 'square', 0.12, 240);
  },
  splat() {
    noise(0.08, 0.25, 900, 1);
    tone(300, 0.06, 'triangle', 0.12, 140);
  },
  chomp() {
    tone(190, 0.1, 'sawtooth', 0.1, 90);
    noise(0.06, 0.08, 500, 1);
  },
  gulp() {
    tone(320, 0.16, 'sine', 0.18, 70);
  },
  plant() {
    tone(220, 0.12, 'sine', 0.3, 130);
    noise(0.08, 0.12, 600, 1);
  },
  loaded() {
    tone(520, .08, 'triangle', .14, 680);
    tone(840, .12, 'sine', .11, 980, .07);
  },
  strikerLaser() {
    // Authentic Striker dual-synth laser drop from Neon Drift
    tone(980, 0.11, 'sawtooth', 0.22, 175);
    tone(125, 0.09, 'sine', 0.28, 38);
  },
  thruster() {
    noise(0.12, 0.14, 420, 1.2);
    tone(75, 0.12, 'sawtooth', 0.12, 50);
  },
  drift() {
    noise(0.14, 0.15, 800, 1.5);
  },
  sunborn() {
    tone(880, 0.18, 'sine', 0.12, 1320);
  },
  collect() {
    tone(1040, 0.1, 'sine', 0.2, 1560);
    tone(1560, 0.14, 'sine', 0.14, 2090, 0.07);
  },
  boom() {
    noise(0.7, 0.9, 2200, 0.4, 0, 90);
    tone(90, 0.5, 'sine', 0.7, 34);
  },
  mower() {
    tone(80, 0.7, 'sawtooth', 0.22, 340);
    noise(0.6, 0.12, 800, 1);
  },
  zdie() {
    tone(240, 0.25, 'triangle', 0.16, 60);
  },
  wave() {
    tone(160, 0.5, 'sawtooth', 0.16, 120);
    tone(107, 0.6, 'sawtooth', 0.14, 80, 0.12);
  },
  finalwave() {
    tone(130, 0.9, 'sawtooth', 0.2, 65);
    tone(196, 0.7, 'square', 0.08, 98, 0.05);
    noise(0.8, 0.1, 400, 1, 0.1);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, undefined, i * 0.13));
    tone(1318, 0.5, 'sine', 0.14, undefined, 0.55);
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.34, 'sawtooth', 0.14, f * 0.92, i * 0.22));
  },
  error() {
    tone(140, 0.12, 'square', 0.1, 110);
  },
  click() {
    tone(700, 0.05, 'sine', 0.1, 500);
  },
};
