export const AUDIO_STORAGE_KEY = "cleansheet.game-audio";

let audioContext = null;

export function readAudioSettings(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_STORAGE_KEY) ?? "null");
    return {
      muted: Boolean(parsed?.muted),
      volume: clampVolume(parsed?.volume ?? 0.35),
    };
  } catch {
    return { muted: false, volume: 0.35 };
  }
}

export function writeAudioSettings(settings, storage = window.localStorage) {
  storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify({
    muted: Boolean(settings.muted),
    volume: clampVolume(settings.volume),
  }));
}

export function unlockAudio() {
  const context = getAudioContext();
  if (!context || context.state !== "suspended") return Promise.resolve();
  return context.resume().catch(() => {});
}

export function playGameSound(name, settings) {
  if (settings?.muted || clampVolume(settings?.volume ?? 0.35) === 0) return;
  const context = getAudioContext();
  if (!context || context.state !== "running") return;
  const volume = clampVolume(settings?.volume ?? 0.35);
  const sequence = SOUND_SEQUENCES[name] ?? SOUND_SEQUENCES.click;
  const start = context.currentTime + 0.01;
  sequence.forEach((tone, index) => scheduleTone(context, {
    ...tone,
    start: start + (tone.delay ?? index * 0.05),
    volume: (tone.volume ?? 0.08) * volume,
  }));
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function scheduleTone(context, tone) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = tone.duration ?? 0.07;
  oscillator.type = tone.type ?? "square";
  oscillator.frequency.setValueAtTime(tone.frequency, tone.start);
  if (tone.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, tone.start + duration);
  gain.gain.setValueAtTime(0.0001, tone.start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.volume), tone.start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, tone.start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(tone.start);
  oscillator.stop(tone.start + duration + 0.01);
}

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.35;
  return Math.min(1, Math.max(0, number));
}

const SOUND_SEQUENCES = {
  click: [{ frequency: 220, endFrequency: 180, duration: 0.045, volume: 0.07 }],
  clipbit: [
    { frequency: 680, endFrequency: 420, duration: 0.055, type: "square", volume: 0.065 },
    { frequency: 940, delay: 0.045, duration: 0.045, type: "square", volume: 0.05 },
    { frequency: 310, delay: 0.09, duration: 0.075, type: "sawtooth", volume: 0.04 },
  ],
  clipbitBreak: [
    { frequency: 760, endFrequency: 170, duration: 0.24, type: "sawtooth", volume: 0.07 },
    { frequency: 120, delay: 0.18, duration: 0.13, type: "square", volume: 0.06 },
    { frequency: 82, delay: 0.3, duration: 0.25, type: "sawtooth", volume: 0.055 },
  ],
  clipbitHit: [
    { frequency: 170, endFrequency: 95, duration: 0.08, type: "square", volume: 0.065 },
    { frequency: 620, delay: 0.07, duration: 0.07, type: "sawtooth", volume: 0.045 },
    { frequency: 130, delay: 0.13, duration: 0.12, type: "square", volume: 0.05 },
  ],
  paperPickup: [
    { frequency: 260, endFrequency: 360, duration: 0.045, type: "square", volume: 0.04 },
  ],
  paperDrop: [
    { frequency: 180, endFrequency: 130, duration: 0.055, type: "square", volume: 0.035 },
  ],
  paperThrow: [
    { frequency: 330, endFrequency: 720, duration: 0.11, type: "sawtooth", volume: 0.035 },
  ],
  paperBounce: [
    { frequency: 145, endFrequency: 105, duration: 0.045, type: "square", volume: 0.028 },
  ],
  paperTrash: [
    { frequency: 410, endFrequency: 120, duration: 0.16, type: "sawtooth", volume: 0.05 },
    { frequency: 95, delay: 0.14, duration: 0.1, type: "square", volume: 0.04 },
  ],
  paperRestore: [
    { frequency: 220, duration: 0.05, type: "square", volume: 0.035 },
    { frequency: 330, delay: 0.05, duration: 0.05, type: "square", volume: 0.04 },
    { frequency: 440, delay: 0.1, duration: 0.08, type: "square", volume: 0.045 },
  ],
  floppyPickup: [
    { frequency: 210, endFrequency: 290, duration: 0.045, type: "square", volume: 0.035 },
  ],
  floppyDrop: [
    { frequency: 185, endFrequency: 135, duration: 0.06, type: "square", volume: 0.035 },
  ],
  floppyInsert: [
    { frequency: 120, endFrequency: 82, duration: 0.08, type: "square", volume: 0.05 },
    { frequency: 520, delay: 0.09, duration: 0.045, type: "square", volume: 0.045 },
  ],
  floppyEject: [
    { frequency: 520, endFrequency: 180, duration: 0.09, type: "square", volume: 0.045 },
    { frequency: 105, delay: 0.08, duration: 0.12, type: "sawtooth", volume: 0.04 },
  ],
  bootTrash: [
    { frequency: 640, endFrequency: 95, duration: 0.3, type: "sawtooth", volume: 0.065 },
    { frequency: 115, delay: 0.12, duration: 0.1, type: "square", volume: 0.055 },
    { frequency: 780, delay: 0.24, duration: 0.06, type: "square", volume: 0.05 },
    { frequency: 82, delay: 0.31, duration: 0.2, type: "sawtooth", volume: 0.055 },
  ],
  driveReject: [
    { frequency: 180, endFrequency: 95, duration: 0.09, type: "square", volume: 0.055 },
    { frequency: 720, endFrequency: 260, delay: 0.08, duration: 0.13, type: "sawtooth", volume: 0.05 },
  ],
  machineBoot: [
    { frequency: 82, endFrequency: 145, duration: 0.42, type: "sawtooth", volume: 0.035 },
    { frequency: 310, delay: 0.32, duration: 0.06, type: "square", volume: 0.04 },
    { frequency: 465, delay: 0.41, duration: 0.06, type: "square", volume: 0.045 },
    { frequency: 620, delay: 0.5, duration: 0.11, type: "square", volume: 0.045 },
  ],
  machinePower: [
    { frequency: 190, endFrequency: 410, duration: 0.08, type: "sawtooth", volume: 0.035 },
    { frequency: 680, delay: 0.07, duration: 0.045, type: "square", volume: 0.04 },
  ],
  open: [
    { frequency: 220, duration: 0.05 },
    { frequency: 330, delay: 0.045, duration: 0.06 },
  ],
  scan: [
    { frequency: 140, endFrequency: 520, duration: 0.34, type: "sawtooth", volume: 0.045 },
    { frequency: 760, delay: 0.36, duration: 0.05, volume: 0.06 },
  ],
  scanClean: [
    { frequency: 420, duration: 0.055, type: "square", volume: 0.04 },
    { frequency: 620, delay: 0.055, duration: 0.07, type: "square", volume: 0.045 },
    { frequency: 840, delay: 0.12, duration: 0.11, type: "square", volume: 0.05 },
  ],
  repair: [
    { frequency: 240, endFrequency: 420, duration: 0.055, type: "square", volume: 0.045 },
    { frequency: 560, delay: 0.055, duration: 0.065, type: "square", volume: 0.045 },
  ],
  formula: [
    { frequency: 260, duration: 0.05, type: "square", volume: 0.04 },
    { frequency: 390, delay: 0.05, duration: 0.05, type: "square", volume: 0.04 },
    { frequency: 585, delay: 0.1, duration: 0.09, type: "square", volume: 0.05 },
  ],
  deleteData: [
    { frequency: 520, endFrequency: 160, duration: 0.18, type: "sawtooth", volume: 0.045 },
    { frequency: 105, delay: 0.15, duration: 0.09, type: "square", volume: 0.04 },
  ],
  undo: [
    { frequency: 520, endFrequency: 240, duration: 0.12, type: "square", volume: 0.04 },
    { frequency: 190, delay: 0.1, duration: 0.07, type: "square", volume: 0.035 },
  ],
  redo: [
    { frequency: 240, endFrequency: 520, duration: 0.12, type: "square", volume: 0.04 },
    { frequency: 650, delay: 0.1, duration: 0.07, type: "square", volume: 0.04 },
  ],
  error: [
    { frequency: 150, duration: 0.12, type: "sawtooth" },
    { frequency: 105, delay: 0.1, duration: 0.16, type: "sawtooth" },
  ],
  objective: [
    { frequency: 440, duration: 0.07 },
    { frequency: 660, delay: 0.07, duration: 0.1 },
  ],
  combo: [
    { frequency: 392, duration: 0.06 },
    { frequency: 523, delay: 0.06, duration: 0.06 },
    { frequency: 784, delay: 0.12, duration: 0.13 },
  ],
  achievement: [
    { frequency: 523, duration: 0.08 },
    { frequency: 659, delay: 0.08, duration: 0.08 },
    { frequency: 784, delay: 0.16, duration: 0.16 },
  ],
  victory: [
    { frequency: 392, duration: 0.09 },
    { frequency: 523, delay: 0.09, duration: 0.09 },
    { frequency: 659, delay: 0.18, duration: 0.09 },
    { frequency: 784, delay: 0.27, duration: 0.26 },
  ],
};
