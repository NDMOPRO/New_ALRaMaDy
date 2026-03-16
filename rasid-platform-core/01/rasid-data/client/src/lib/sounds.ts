/* RASID Sound Effects System
   Subtle audio feedback for UI interactions using Web Audio API
   - No external audio files needed — all sounds are synthesized
   - Respects user preference (muted by default, can be enabled)
   - Lightweight and performant */

let audioContext: AudioContext | null = null;
let soundEnabled = false;

// Initialize AudioContext on first user interaction
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

// Storage key for sound preference
const SOUND_KEY = 'rasid_sound_enabled';

export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_KEY);
    soundEnabled = stored === 'true';
  } catch {
    soundEnabled = false;
  }
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  try {
    localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {}
}

export function toggleSound(): boolean {
  const newState = !isSoundEnabled();
  setSoundEnabled(newState);
  if (newState) playSound('toggle');
  return newState;
}

// ===== Sound Generators =====

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume = 0.04) {
  frequencies.forEach(f => playTone(f, duration, type, volume));
}

// ===== Named Sound Effects =====

export type SoundEffect = 
  | 'click'        // Button click — soft tap
  | 'hover'        // Hover over interactive element — very subtle
  | 'toggle'       // Toggle switch — two-tone
  | 'success'      // Success action — pleasant ascending
  | 'error'        // Error — soft descending
  | 'notification' // New notification — gentle chime
  | 'open'         // Panel/modal open — soft whoosh up
  | 'close'        // Panel/modal close — soft whoosh down
  | 'send'         // Message sent — quick swoosh
  | 'search'       // Search opened — soft ping
  | 'drop'         // Drag & drop — soft thud
  | 'delete';      // Delete action — soft crumple

export function playSound(effect: SoundEffect) {
  if (!isSoundEnabled()) return;
  
  switch (effect) {
    case 'click':
      playTone(800, 0.06, 'sine', 0.05);
      break;
      
    case 'hover':
      playTone(1200, 0.03, 'sine', 0.02);
      break;
      
    case 'toggle':
      playTone(600, 0.08, 'sine', 0.05);
      setTimeout(() => playTone(900, 0.08, 'sine', 0.05), 60);
      break;
      
    case 'success':
      playTone(523, 0.12, 'sine', 0.06); // C5
      setTimeout(() => playTone(659, 0.12, 'sine', 0.06), 80); // E5
      setTimeout(() => playTone(784, 0.18, 'sine', 0.06), 160); // G5
      break;
      
    case 'error':
      playTone(400, 0.15, 'triangle', 0.06);
      setTimeout(() => playTone(300, 0.2, 'triangle', 0.05), 100);
      break;
      
    case 'notification':
      playChord([523, 659], 0.15, 'sine', 0.04); // C+E
      setTimeout(() => playChord([659, 784], 0.2, 'sine', 0.04), 120); // E+G
      break;
      
    case 'open':
      playTone(400, 0.1, 'sine', 0.04);
      setTimeout(() => playTone(600, 0.1, 'sine', 0.04), 40);
      setTimeout(() => playTone(800, 0.12, 'sine', 0.03), 80);
      break;
      
    case 'close':
      playTone(800, 0.08, 'sine', 0.04);
      setTimeout(() => playTone(600, 0.08, 'sine', 0.03), 40);
      setTimeout(() => playTone(400, 0.1, 'sine', 0.02), 80);
      break;
      
    case 'send':
      playTone(600, 0.06, 'sine', 0.05);
      setTimeout(() => playTone(900, 0.08, 'sine', 0.04), 40);
      setTimeout(() => playTone(1200, 0.06, 'sine', 0.03), 70);
      break;
      
    case 'search':
      playTone(1000, 0.1, 'sine', 0.04);
      setTimeout(() => playTone(1200, 0.08, 'sine', 0.03), 60);
      break;
      
    case 'drop':
      playTone(200, 0.15, 'triangle', 0.06);
      setTimeout(() => playTone(300, 0.1, 'sine', 0.04), 50);
      break;
      
    case 'delete':
      playTone(500, 0.08, 'sawtooth', 0.03);
      setTimeout(() => playTone(350, 0.12, 'sawtooth', 0.02), 60);
      break;
  }
}

// ===== React Hook =====
export function useSound() {
  return {
    play: playSound,
    enabled: isSoundEnabled(),
    toggle: toggleSound,
    setEnabled: setSoundEnabled,
  };
}
