// Tiny WebAudio synth - no audio assets needed.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Bright metallic clink for a coin landing. */
export function playCoinClink() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const partials = [2890, 4320, 5750];
  const master = ac.createGain();
  master.gain.setValueAtTime(0.16, t);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  master.connect(ac.destination);
  for (const [i, freq] of partials.entries()) {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * (1 + Math.random() * 0.01), t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5 / (i + 1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 - i * 0.05);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

/** Short pencil-scratch burst for crossing a day. */
export function playScratch() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const dur = 0.18;
  const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.sin((i / data.length) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, t);
  filter.frequency.linearRampToValueAtTime(900, t + dur);
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t);
}

/** Soft pop for UI confirmations. */
export function playPop() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** Rising chime for milestones (full jar, streaks). */
export function playChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  for (const [i, freq] of notes.entries()) {
    const start = t + i * 0.09;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  }
}
