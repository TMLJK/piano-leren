// Microfoon + toonherkenning. Geeft per aanslag één gebeurtenis: (midi, tijd) via onNote().
import { ensureAudio, getAC } from './audio.js';

export const DEBUG = new URLSearchParams(location.search).has('debug');
const BASE_LATENCY = 0.06;            // geschatte invoervertraging iPad (s)
const CALIB_KEY = 'kerstpiano.calib';

let analyser = null, micBuf = null, ready = false, nsdf = null;
const listeners = new Set();
const S = { hist: [], lastOnset: -1, collecting: false, onsetTime: 0, lastMidi: null, agree: 0, noise: 0.003 };

// Extra vertraging gemeten in Ritme-level "Hartslag" (s). Wordt van elke aanslag-tijd afgetrokken.
export function getCalib() { return +(localStorage.getItem(CALIB_KEY) || 0); }
export function setCalib(v) { localStorage.setItem(CALIB_KEY, String(Math.max(-0.2, Math.min(0.25, v)))); }
export function resetCalib() { localStorage.removeItem(CALIB_KEY); }

export function micReady() { return ready || DEBUG; }
export function onNote(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function emit(midi, t) { for (const cb of listeners) cb(midi, t); }

export function setStatus(s) { const e = document.getElementById('statusText'); if (e) e.textContent = s; }

export async function startMic() {
  ensureAudio();
  if (ready || DEBUG) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('⚠️ Deze browser geeft geen microfoon (open de pagina via https).');
    return false;
  }
  try {
    const ac = getAC();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    const mute = ac.createGain();
    mute.gain.value = 0;
    src.connect(analyser);
    analyser.connect(mute).connect(ac.destination);   // Safari verwerkt alleen "aangesloten" nodes
    micBuf = new Float32Array(analyser.fftSize);
    ready = true;
    setStatus('🎤 Ik luister mee');
    return true;
  } catch (e) {
    setStatus('⚠️ Geen toegang tot de microfoon: ik kan niet meeluisteren.');
    return false;
  }
}

// Genormaliseerde autocorrelatie (McLeod-methode). Geeft grondtoon + "helderheid".
export function detectPitch(buf, sr) {
  const n = buf.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / n);
  if (rms < 0.002) return { freq: 0, clarity: 0, rms };
  const minLag = Math.max(2, Math.floor(sr / 1200)), maxLag = Math.floor(sr / 80);
  const W = n - maxLag;
  if (!nsdf || nsdf.length < maxLag + 2) nsdf = new Float32Array(maxLag + 2);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0, m = 0;
    for (let j = 0; j < W; j++) { const a = buf[j], b = buf[j + tau]; acf += a * b; m += a * a + b * b; }
    nsdf[tau] = m > 0 ? 2 * acf / m : 0;
  }
  nsdf[maxLag + 1] = 0;
  const peaks = [];
  let i = minLag;
  while (i <= maxLag && nsdf[i] > 0) i++;
  while (i <= maxLag) {
    while (i <= maxLag && nsdf[i] <= 0) i++;
    let best = -1, bv = -1;
    while (i <= maxLag && nsdf[i] > 0) { if (nsdf[i] > bv) { bv = nsdf[i]; best = i; } i++; }
    if (best > 0 && i <= maxLag) peaks.push(best);
  }
  if (!peaks.length) return { freq: 0, clarity: 0, rms };
  let maxv = 0;
  for (const p of peaks) maxv = Math.max(maxv, nsdf[p]);
  const chosen = peaks.find(p => nsdf[p] >= 0.9 * maxv);
  const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? 0.5 * (a - c) / den : 0;
  return { freq: sr / (chosen + shift), clarity: b, rms };
}

// Eén aanslag = plotselinge stijging in volume + 2 frames dezelfde toon. Elke frame aanroepen.
export function poll() {
  if (!ready) return;
  const ac = getAC();
  analyser.getFloatTimeDomainData(micBuf);
  const r = detectPitch(micBuf, ac.sampleRate);
  const t = ac.currentTime;
  const lvl = document.getElementById('levelFill');
  if (lvl) lvl.style.width = Math.min(100, r.rms * 900) + '%';
  const h = S.hist;
  h.push(r.rms);
  if (h.length > 6) h.shift();
  const ref = h.length >= 4 ? h[h.length - 4] : 0;
  S.noise = r.rms < S.noise ? S.noise * 0.8 + r.rms * 0.2 : S.noise * 0.998 + r.rms * 0.002;
  const thr = Math.max(0.006, S.noise * 3);
  if (DEBUG) {
    const d = document.getElementById('debugInfo');
    if (d) d.textContent = `rms ${r.rms.toFixed(3)} thr ${thr.toFixed(3)} f ${r.freq.toFixed(0)} cl ${r.clarity.toFixed(2)}`;
  }
  if (r.rms > thr && r.rms > ref * 1.6 && t - S.lastOnset > 0.12) {
    S.lastOnset = t;
    S.collecting = true;
    S.onsetTime = t - (micBuf.length / ac.sampleRate) * 0.5 - BASE_LATENCY - getCalib();
    S.lastMidi = null;
    S.agree = 0;
  }
  if (!S.collecting) return;
  if (t - S.lastOnset > 0.25) { S.collecting = false; return; }
  if (r.freq > 0 && r.clarity > 0.8 && r.rms > thr * 0.7) {
    const m = Math.round(69 + 12 * Math.log2(r.freq / 440));
    if (m === S.lastMidi) S.agree++; else { S.lastMidi = m; S.agree = 1; }
    if (S.agree >= 2) { S.collecting = false; emit(m, S.onsetTime); }
  }
}

// Debug: spatiebalk = aanslag op F (handig om zonder keyboard te testen).
if (DEBUG) {
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); ensureAudio(); emit(65, getAC().currentTime); }
  });
}
