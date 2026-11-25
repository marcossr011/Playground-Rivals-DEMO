let ctx: AudioContext | null = null;
let enabled = true;

function context(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

type ToneOptions = { freq: number; duration?: number; type?: OscillatorType; gain?: number; delay?: number };

function tone({ freq, duration = 0.1, type = 'sine', gain = 0.05, delay = 0 }: ToneOptions): void {
  const audio = context();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const node = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  node.gain.setValueAtTime(0.0001, start);
  node.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  node.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(node).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

export const sfx = {
  tap: () => tone({ freq: 440, duration: 0.05, type: 'triangle', gain: 0.035 }),
  select: () => tone({ freq: 660, duration: 0.06, type: 'triangle', gain: 0.04 }),
  match: () => {
    tone({ freq: 660, duration: 0.1, type: 'sine', gain: 0.05 });
    tone({ freq: 990, duration: 0.16, type: 'sine', gain: 0.045, delay: 0.08 });
  },
  error: () => {
    tone({ freq: 180, duration: 0.16, type: 'sawtooth', gain: 0.035 });
    tone({ freq: 140, duration: 0.18, type: 'sawtooth', gain: 0.03, delay: 0.12 });
  },
  tick: () => tone({ freq: 880, duration: 0.035, type: 'square', gain: 0.025 }),
  win: () => {
    [523, 659, 784, 1047].forEach((freq, index) => tone({ freq, duration: 0.22, type: 'triangle', gain: 0.05, delay: index * 0.1 }));
  },
  lose: () => {
    [330, 262, 196].forEach((freq, index) => tone({ freq, duration: 0.28, type: 'sine', gain: 0.04, delay: index * 0.14 }));
  },
  alarm: () => {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 880, duration: 0.18, type: 'square', gain: 0.05, delay: i * 0.28 });
    }
  }
};

export function vibrate(pattern: number | number[]): void {
  if (!hapticsEnabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

let hapticsEnabled = true;

export function setHapticsEnabled(value: boolean): void {
  hapticsEnabled = value;
}
