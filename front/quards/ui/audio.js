// Oscillator-based SFX. No files, no libraries. The AudioContext starts muted
// until the first user gesture (browser autoplay policy).
let ctx = null;

export function armAudio() {
  const unlock = () => {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch { /* audio is a nice-to-have */ }
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function tone(freq, dur, type = 'square', vol = 0.05, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const blip = () => tone(520, 0.06, 'square', 0.045);
export const tick = (delay = 0) => tone(320, 0.04, 'triangle', 0.028, delay);
export const runChord = () => [392, 523, 659, 880].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.035, i * 0.05));

export function collapseSweep() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(660, t0);
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.35);
  gain.gain.setValueAtTime(0.05, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}
