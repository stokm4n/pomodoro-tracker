import type { NotificationSound } from "../types";

let sharedAudioContext: AudioContext | null = null;
const peopleGoSoundUrl = new URL(
  "../assets/well-let-the-people-go.mp3",
  import.meta.url,
).href;
const peopleGoBuffers = new WeakMap<AudioContext, Promise<AudioBuffer>>();

interface SoundNote {
  frequency: number;
  start: number;
  duration: number;
  level: number;
  type: OscillatorType;
}

const soundPatterns: Record<Exclude<NotificationSound, "people_go">, SoundNote[]> = {
  classic: [
    { frequency: 660, start: 0, duration: 0.55, level: 0.46, type: "sine" },
    { frequency: 880, start: 0.58, duration: 0.58, level: 0.46, type: "sine" },
    { frequency: 1046.5, start: 1.2, duration: 0.72, level: 0.42, type: "sine" },
    { frequency: 1318.5, start: 1.96, duration: 0.92, level: 0.38, type: "sine" },
  ],
  soft: [
    { frequency: 523.25, start: 0, duration: 2.25, level: 0.34, type: "sine" },
    { frequency: 659.25, start: 0.22, duration: 2.45, level: 0.22, type: "sine" },
    { frequency: 783.99, start: 0.65, duration: 2.35, level: 0.14, type: "sine" },
  ],
  bell: [
    { frequency: 880, start: 0, duration: 2.4, level: 0.42, type: "sine" },
    { frequency: 1760, start: 0, duration: 1.8, level: 0.14, type: "sine" },
    { frequency: 1046.5, start: 0.95, duration: 2.55, level: 0.4, type: "sine" },
    { frequency: 2093, start: 0.95, duration: 1.9, level: 0.13, type: "sine" },
    { frequency: 1318.5, start: 2.05, duration: 2.15, level: 0.34, type: "sine" },
    { frequency: 2637, start: 2.05, duration: 1.55, level: 0.1, type: "sine" },
  ],
  digital: [
    { frequency: 740, start: 0, duration: 0.23, level: 0.34, type: "square" },
    { frequency: 980, start: 0.28, duration: 0.23, level: 0.34, type: "square" },
    { frequency: 740, start: 0.56, duration: 0.23, level: 0.34, type: "square" },
    { frequency: 980, start: 0.84, duration: 0.23, level: 0.34, type: "square" },
    { frequency: 740, start: 1.12, duration: 0.23, level: 0.34, type: "square" },
    { frequency: 1174.66, start: 1.4, duration: 0.48, level: 0.32, type: "square" },
  ],
};

export function getNotificationAudioContext() {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

export function playNotificationSound(
  context: AudioContext,
  sound: NotificationSound,
  volume: number,
) {
  const volumeFactor = Math.min(100, Math.max(0, volume)) / 100;
  if (volumeFactor === 0 || context.state === "closed") return Promise.resolve();

  return context.resume().then(() => {
    const boostedVolume = Math.min(1.25, volumeFactor * 1.6);

    if (sound === "people_go") {
      return getPeopleGoBuffer(context).then((buffer) => {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = Math.min(1, boostedVolume);
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
      });
    }

    const startAt = context.currentTime + 0.02;
    soundPatterns[sound].forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + note.start;
      const noteEnd = noteStart + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, note.level * boostedVolume),
        noteStart + 0.025,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    });
  });
}

function getPeopleGoBuffer(context: AudioContext) {
  const cached = peopleGoBuffers.get(context);
  if (cached) return cached;

  const loading = fetch(peopleGoSoundUrl)
    .then((response) => {
      if (!response.ok) throw new Error("notification sound could not be loaded");
      return response.arrayBuffer();
    })
    .then((audioData) => context.decodeAudioData(audioData));
  peopleGoBuffers.set(context, loading);
  return loading;
}
