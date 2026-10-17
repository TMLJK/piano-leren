// Geluid: metronoom-tik, pianotoon, applaus, feestgeluidje. Alles via Web Audio, zonder bestanden.

let ac = null, noiseBuf = null;
const scheduled = [];   // geplande geluiden, zodat STOP ze kan afbreken

export function getAC() { return ac; }
export function now() { return ac ? ac.currentTime : 0; }

export function ensureAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function track(src, end) { scheduled.push({ src, end }); }
export function stopScheduled() {
  const t = now();
  for (const s of scheduled) if (s.end > t) { try { s.src.stop(); } catch (e) {} }
  scheduled.length = 0;
}

// Tik zonder toonhoogte (ruis), zodat de toonherkenning hem niet als noot oppikt.
export function click(time, accent, vol = 1) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = accent ? 2000 : 3500;
  const g = ac.createGain();
  g.gain.setValueAtTime((accent ? 0.9 : 0.55) * vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  src.connect(hp).connect(g).connect(ac.destination);
  src.start(time);
  src.stop(time + 0.05);
  track(src, time + 0.05);
}

export function tone(midi, time, dur, vol = 0.22) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur + 0.25);
  g.connect(ac.destination);
  [[f, 'triangle', 1], [f * 2, 'sine', 0.25]].forEach(([fr, type, amp]) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = fr;
    const og = ac.createGain();
    og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(time);
    o.stop(time + dur + 0.3);
    track(o, time + dur + 0.3);
  });
}

// Applaus: veel korte, gefilterde ruis-klapjes. Alleen gebruiken als er niet geluisterd wordt.
export function applause(dur = 2.2) {
  ensureAudio();
  const t0 = ac.currentTime + 0.05;
  const n = Math.floor(dur * 45);
  for (let i = 0; i < n; i++) {
    const t = t0 + Math.random() * dur;
    const fade = 1 - (t - t0) / dur;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 1800;
    bp.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25 * fade * (0.5 + Math.random() * 0.5), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.05);
  }
}

// Vrolijk riedeltje (C-E-G-C omhoog).
export function fanfare() {
  ensureAudio();
  const t = ac.currentTime + 0.05;
  [72, 76, 79, 84].forEach((m, i) => tone(m, t + i * 0.11, i === 3 ? 0.5 : 0.12, 0.18));
}
