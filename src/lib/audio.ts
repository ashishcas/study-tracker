/**
 * Synthesizes sound notifications using the Web Audio API.
 * This runs completely on the client side with no external files or network requests.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Play a synthesized notification chime.
 * Handles autoplay restrictions gracefully (silent failure or logs).
 */
export function playChime(type: 'focusEnd' | 'breakEnd' | 'taskComplete'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (common in browsers until user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(err => {
      console.warn('AudioContext failed to resume:', err);
    });
  }

  try {
    const now = ctx.currentTime;

    if (type === 'focusEnd') {
      // Focus End: A warm, calming dual-tone (E5 & G#5 transitioning to A5)
      // Play a soothing marimba-like double-chime
      playTone(ctx, 659.25, now, 0.4, 'sine');      // E5
      playTone(ctx, 830.61, now + 0.05, 0.4, 'sine'); // G#5
      playTone(ctx, 880.00, now + 0.25, 0.6, 'sine'); // A5
    } else if (type === 'breakEnd') {
      // Break End: A cheerful ascending triplet (C5 -> E5 -> G5) to energize focus
      playTone(ctx, 523.25, now, 0.3, 'triangle');      // C5
      playTone(ctx, 659.25, now + 0.12, 0.3, 'triangle');  // E5
      playTone(ctx, 783.99, now + 0.24, 0.5, 'triangle');  // G5
    } else if (type === 'taskComplete') {
      // Task Complete: crisp celebratory chime
      playTone(ctx, 587.33, now, 0.18, 'triangle');       // D5
      playTone(ctx, 880.00, now + 0.08, 0.3, 'triangle'); // A5
    }
  } catch (error) {
    console.warn('Failed to play synthesized chime', error);
  }
}

/**
 * Helper to play a single synthesis tone with envelope (fades in and out to prevent clicks).
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  oscType: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = oscType;
  osc.frequency.value = frequency;

  // Simple adsr-like envelope to prevent clicks
  gainNode.gain.setValueAtTime(0, startTime);
  // Attack
  gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
  // Decay/Release
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}
