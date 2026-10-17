// Ritme-echo: ritme leren in kleine stapjes, op één toets (welke toets maakt niet uit).
// Volgorde volgt muziekdidactiek: eerst de tel voelen, dan nadoen (echo), dan het ritme van het liedje.
import { ensureAudio, ensureRunning, click, tone, stopScheduled, now } from '../audio.js';
import { onNote, startMic, getCalib, setCalib } from '../mic.js';
import { notes, PHRASES } from '../song.js';
import * as progress from '../progress.js';
import { celebrate } from '../celebrate.js';

const SYL = { 0.5: 'ti', 1: 'ta', 2: 'ta-a', 3: 'ta-a-a' };
function fromDurations(durs, pickup = false) {
  let b = pickup ? -1 : 0;
  return durs.map(d => { const e = { b, dur: d, label: SYL[d] }; b += d; return e; });
}
// Een zin uit het liedje; de opmaat valt op tel -1 (de "3" van de aftelmaat).
function phraseEvents(k) {
  const [a, z] = PHRASES[k];
  const base = notes[a].songBeat + 1;
  return notes.slice(a, z + 1).map(n => ({ b: n.songBeat - base, dur: n.beats, label: n.lyric, midi: n.midi }));
}

export const LEVELS = [
  { id: 'r1', name: 'Hartslag', icon: '💓', sticker: '⛄', type: 'along', calibrate: true,
    intro: 'Tik op elke tel mee, net als je hartje: boem, boem, boem!',
    events: fromDurations(Array(12).fill(1)) },
  { id: 'r2', name: 'Walsen', icon: '💃', sticker: '💃', type: 'along',
    intro: 'Een wals telt 1-2-3, 1-2-3. Speel alleen op de 1!',
    events: fromDurations(Array(6).fill(3)).map(e => ({ ...e, label: '1' })) },
  { id: 'r3', name: 'Olifant en muis', icon: '🐘', sticker: '🐘', type: 'echo', shuffle: true,
    intro: 'Ik speel iets voor, jij doet het na! Lang als een olifant, kort als een muis.',
    challenges: [[1, 1, 1], [2, 1], [1, 2], [3], [1, 1, 1, 2, 1], [2, 1, 1, 2]].map(d => fromDurations(d)) },
  { id: 'r4', name: 'Rennende muisjes', icon: '🐭', sticker: '🐭', type: 'echo', shuffle: true,
    intro: 'Twee snelle noten heten ti-ti. Net rennende muisjes!',
    challenges: [[.5, .5, 1, 1], [1, .5, .5, 1], [1, 1, .5, .5], [1, .5, .5, .5, .5], [.5, .5, .5, .5, 1]].map(d => fromDurations(d)) },
  { id: 'r5', name: 'Kangoeroesprong', icon: '🦘', sticker: '🦘', type: 'echo', shuffle: true,
    intro: 'Tel 1-2… en spring erin op 3! Zo begint ons liedje ook.',
    challenges: [[1, 1, 1, 1], [1, 2, 1], [1, 3], [1, 1, .5, .5, .5, .5], [1, 1, 1, 1, 3]].map(d => fromDurations(d, true)) },
  { id: 'r6', name: 'Liedje: begin', icon: '🎄', sticker: '🎄', type: 'echo', song: true,
    intro: 'Het ritme van ons liedje! Luister, en tik het na op één toets. Zing de woordjes mee!',
    challenges: [0, 1, 0, 1].map(phraseEvents) },
  { id: 'r7', name: 'Liedje: einde', icon: '🎅', sticker: '🎅', type: 'echo', song: true,
    intro: 'Nu de rest van het liedje. Zing maar mee!',
    challenges: [2, 3, 4].map(phraseEvents) },
  { id: 'r8', name: 'Het hele ritme', icon: '🌟', sticker: '🌟', type: 'along', song: true,
    intro: 'Tik het ritme van het hele liedje. De woordjes helpen je!',
    events: notes.map(n => ({ b: n.songBeat - 1, dur: n.beats, label: n.lyric, midi: n.midi })) },
];
const IDS = LEVELS.map(l => l.id);

const $ = id => document.getElementById(id);

let go = () => {};
export function init(goFn) { go = goFn; }

// ===================== Levelpad =====================
// Welk Ritme-level opent "Met maat" bij het liedje.
export const UNLOCK_TEMPO = 'r5';
export const tempoUnlocked = () => !progress.settings().rules || ['passed', 'gold'].includes(progress.levelStatus(UNLOCK_TEMPO));

export function renderPath() {
  const box = $('levelPath');
  box.innerHTML = '';
  // Doel-balk bovenaan: opwarmen, of waar ze naartoe werkt.
  const ban = $('warmBanner');
  const rules = progress.settings().rules;
  if (rules && !progress.warmedUpToday()) ban.innerHTML = '🔥 <b>Opwarmen!</b> Speel één rondje, dan gaat 🎹 het liedje open 🔑';
  else if (!tempoUnlocked()) ban.innerHTML = '🎯 <b>Doel:</b> haal 🦘 Kangoeroesprong, dan mag je het liedje 🎵 <b>Met maat</b> spelen!';
  else ban.innerHTML = '';
  ban.hidden = !ban.innerHTML;
  LEVELS.forEach((L, i) => {
    const st = progress.levelStatus(L.id);
    const open = progress.isUnlocked(IDS, i);
    const gp = progress.goldProgress(L.id);
    const b = document.createElement('button');
    b.className = `lvl ${open ? st : 'locked'}`;
    const badge = !open ? '🔒' : st === 'gold' ? '🥇' : st === 'passed' ? '⭐' : '';
    const dots = open && st !== 'gold' && gp.runs > 0
      ? `<span class="golddots">${'●'.repeat(Math.min(gp.runs, gp.needRuns))}${'○'.repeat(Math.max(0, gp.needRuns - gp.runs))}</span>` : '';
    b.innerHTML = `<span class="lvlIcon">${L.icon}</span><b>${i + 1}. ${L.name}</b><span class="badge">${badge}</span>${dots}`;
    if (open) b.addEventListener('click', () => { go('ritmeplay'); enterLevel(L.id); });
    box.appendChild(b);
  });
}

// ===================== Spelen =====================
let level = null, queue = [], results = [], state = 'idle', ch = null, unsub = null;

export function enterLevel(id) {
  level = LEVELS.find(l => l.id === id);
  state = 'idle';
  $('rpTitle').textContent = `${level.icon} ${level.name}`;
  $('rpBuddy').textContent = level.icon;
  $('rpMsg').textContent = level.intro;
  $('rpHint').textContent = 'Speel op één toets naar keuze, bijvoorbeeld de groene F.';
  $('rpStars').textContent = '';
  $('rpStart').textContent = 'START';
  $('rpStart').className = 'big start';
  drawRhythm(level.type === 'echo' ? level.challenges[0] : level.events);
  if (!unsub) unsub = onNote(heard);
}

export function exit() {
  stopRound();
  if (unsub) { unsub(); unsub = null; }
}

function stopRound() {
  stopScheduled();
  state = 'idle';
  ch = null;
  $('rpCount').classList.remove('pop');
  $('rpStart').textContent = 'START';
  $('rpStart').className = 'big start';
}

export async function onStartButton() {
  ensureAudio();
  if (state === 'starting') return;                      // al bezig met starten (dubbele tik)
  if (state !== 'idle') { stopRound(); $('rpMsg').textContent = 'Gestopt. Druk op START om opnieuw te beginnen.'; return; }
  state = 'starting';
  $('rpMsg').textContent = '🎤 Even de microfoon aanzetten…';
  await startMic();
  const running = await ensureRunning();
  if (state !== 'starting') return;                     // intussen weggegaan of gestopt
  if (!running) {
    state = 'idle';
    $('rpMsg').textContent = '👆 Tik nog een keer op START';
    return;
  }
  results = [];
  if (level.type === 'echo') {
    let list = level.challenges.map((ev, k) => ({ ev, k }));
    if (level.shuffle) list = list.sort(() => Math.random() - 0.5).slice(0, 4);
    queue = list.map(c => ({ ...c, retry: false }));
  } else {
    queue = [{ ev: level.events, k: 0, retry: false }];
  }
  $('rpStars').textContent = '';
  $('rpStart').textContent = 'STOP';
  $('rpStart').className = 'big stop';
  nextChallenge(0.3);
}

const tolerance = () => progress.settings().tolerance === 'normaal' ? { early: 0.12, late: 0.15 } : { early: 0.15, late: 0.2 };
const ceilBar = x => Math.ceil(x / 3) * 3;

function nextChallenge(delay) {
  const c = queue.shift();
  if (!c) return finishRound();
  const spb = 60 / progress.settings().ritmeTempo;
  const ev = c.ev;
  const firstB = Math.min(...ev.map(e => e.b));
  const lastEnd = Math.max(...ev.map(e => e.b + e.dur));
  const t0 = now() + delay;
  const pickup = firstB < 0;
  let L0 = null, P0;
  const counts = [];                      // aftel-getallen {t, label}
  if (level.type === 'echo') {
    L0 = t0 + 3 * spb;
    P0 = L0 + (ceilBar(lastEnd) + 3) * spb;
    for (let k = 0; k < 3; k++) counts.push({ t: L0 + (k - 3) * spb, label: k + 1, mine: false });
    for (let k = 0; k < 3; k++) counts.push({ t: P0 + (k - 3) * spb, label: k + 1, mine: true });
  } else {
    P0 = t0 + (pickup ? 6 : 3) * spb;
    for (let k = pickup ? -6 : -3; k < 0; k++) counts.push({ t: P0 + k * spb, label: ((k % 3) + 3) % 3 + 1, mine: true });
  }
  if (pickup) counts.forEach(cn => { if (Math.abs(cn.t - (P0 - spb)) < 1e-6 || (L0 && Math.abs(cn.t - (L0 - spb)) < 1e-6)) cn.label = '3 🦘'; });

  // metronoom: elke tel van begin tot eind, accent op de 1
  const startT = L0 != null ? L0 - 3 * spb : P0 - (pickup ? 6 : 3) * spb;
  const endT = P0 + ceilBar(lastEnd) * spb;
  for (let t = startT, k = 0; t < endT - 1e-6; t += spb, k++) click(t, k % 3 === 0, 0.5);
  // voorspelen (echo): melodie bij liedjes, anders een vrolijke F
  if (L0 != null) ev.forEach(e => tone(e.midi || 65, L0 + e.b * spb, e.dur * spb * 0.85));

  const { early, late } = tolerance();
  const calibrating = level.calibrate;
  ch = {
    c, ev, spb, L0, P0, counts, shown: -1,
    exp: ev.map(e => P0 + e.b * spb),
    hit: ev.map(() => null),               // afwijking in s per verwachte noot, of null
    extra: 0, extraInLong: 0,              // tikken waar geen nootje hoort (en hoeveel tijdens een lange noot)
    early: calibrating ? 0.35 : early, late: calibrating ? 0.35 : late,
    listenFrom: P0 + firstB * spb - (calibrating ? 0.35 : early),
    end: P0 + lastEnd * spb + late + 0.15,
    origin: startT, lastBeat: -1,
  };
  state = 'running';
  drawRhythm(ev);
  $('rpMsg').textContent = L0 != null ? '👂 Luister…' : 'Klaar? Tel mee…';
}

function heard(midi, t) {
  if (state !== 'running' || !ch || t < ch.listenFrom || t > ch.end) return;
  // dichtstbijzijnde nog niet geraakte noot binnen het venster
  let best = -1, bd = Infinity;
  ch.exp.forEach((e, i) => {
    if (ch.hit[i] != null) return;
    const d = t - e;
    if (d >= -ch.early && d <= ch.late && Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
  });
  if (best >= 0) { ch.hit[best] = t - ch.exp[best]; markHit(best); }
  else {                                              // tik waar geen nootje hoort
    const beat = (t - ch.P0) / ch.spb;
    ch.extra++;
    if (ch.ev.some(e => e.dur >= 2 && beat > e.b && beat < e.b + e.dur)) ch.extraInLong++;
    puff(beat);
  }
}

// Extra tik: wolkje in de balk. Blijft staan tot de volgende beurt, zodat ze ziet wáár het was.
function puff(beat) {
  const svg = $('rpRhythm').firstChild;
  if (!svg) return;
  el('text', { x: beatToX(beat), y: 24, class: 'puff' }, svg, '💨');
}

// Eén eerlijke regel + hooguit één tip: het belangrijkste verbeterpunt eerst.
function feedbackText({ good, hits, n, extra, extraInLong, bias, tooMany }) {
  const taps = hits + extra;
  const biasTip = bias === 'early' ? 'Je was steeds een beetje te vroeg 🐇 Wacht op de tik!'
                : bias === 'late' ? 'Je was steeds een beetje te laat 🐢 Iets eerder tikken!' : '';
  if (good) {
    const base = hits === n ? `Raak! Alle ${n} nootjes ⭐` : `Raak! ${hits} van de ${n} nootjes ⭐`;
    return { text: base, tip: biasTip ? 'Tip: ' + biasTip.charAt(0).toLowerCase() + biasTip.slice(1) : '' };
  }
  if (tooMany) {
    const head = taps > n ? `Je tikte ${taps} keer, maar er waren ${n} nootjes. ${taps - n} te veel 💨`
                          : `${extra} tikjes vielen op een plek zonder nootje 💨`;
    const tip = extraInLong * 2 >= extra ? 'Bij een lange noot 🐘 tik je één keer en dan wacht je.'
                                         : 'Alleen tikken als er een nootje komt!';
    return { text: head, tip };
  }
  const missed = n - hits;
  if (biasTip) return { text: `Je miste er ${missed}.`, tip: biasTip };
  return { text: `Je miste er ${missed}.`, tip: 'Kijk welke nootjes nog geen ⭐ hebben.' };
}

export function tick() {
  if (state !== 'running' || !ch) return;
  const t = now();
  // aftellen
  for (let i = ch.shown + 1; i < ch.counts.length && ch.counts[i].t <= t; i++) {
    ch.shown = i;
    const el = $('rpCount');
    el.textContent = ch.counts[i].label;
    el.classList.toggle('mine', ch.counts[i].mine);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (ch.counts[i].mine && ch.L0 != null && i === 3) $('rpMsg').textContent = '🎹 Jij!';
    if (ch.counts[i].mine && ch.L0 == null && i === 0) $('rpMsg').textContent = '🎹 Speel mee!';
  }
  // maatje tikken: buddy springt op elke tel
  const beat = Math.floor((t - ch.origin) / ch.spb + 1e-6);
  if (beat !== ch.lastBeat && t >= ch.origin) {
    ch.lastBeat = beat;
    const bd = $('rpBuddy');
    bd.classList.remove('hop'); void bd.offsetWidth; bd.classList.add('hop');
  }
  // huidige noot oplichten (tijdens voorspelen én tijdens haar beurt)
  let cur = -1;
  const inListen = ch.L0 != null && t < ch.P0 - 3 * ch.spb;
  const o = inListen ? ch.L0 : ch.P0;
  ch.ev.forEach((e, i) => { if (t >= o + e.b * ch.spb && t < o + (e.b + e.dur) * ch.spb) cur = i; });
  setNow(cur, inListen);
  scrollRhythm(((t - o) / ch.spb));
  if (t > ch.end) evaluate();
}

function evaluate() {
  const c = ch.c;
  let hits = ch.hit.filter(h => h != null).length;
  const n = ch.ev.length;
  let med = null;
  if (level.calibrate) {
    const ds = ch.hit.filter(h => h != null).sort((a, b) => a - b);
    if (ds.length >= 6) {
      med = ds[Math.floor(ds.length / 2)];
      const { early, late } = tolerance();
      hits = ds.filter(d => d - med >= -early && d - med <= late).length;
    }
  }
  // Raak = genoeg nootjes op tijd én niet te veel extra tikken (anders werkt "heel snel tikken" altijd).
  const allowedExtra = Math.max(1, Math.floor(n * 0.25));
  const tooMany = ch.extra > allowedExtra;
  const good = hits / n >= 0.75 && !tooMany;
  // Microfoonvertraging alleen bijstellen op een nette ronde, niet op wild getik.
  if (good && med != null && Math.abs(med) > 0.02) setCalib(getCalib() + med);
  // Systematisch te vroeg/laat? (niet in Hartslag: daar meten we juist de vertraging)
  let bias = '';
  const ds = ch.hit.filter(h => h != null).sort((a, b) => a - b);
  if (!level.calibrate && ds.length >= 3) {
    const m = ds[Math.floor(ds.length / 2)];
    bias = m < -0.08 ? 'early' : m > 0.11 ? 'late' : '';
  }
  const fb = feedbackText({ good, hits: ch.hit.filter(h => h != null).length, n, extra: ch.extra, extraInLong: ch.extraInLong, bias, tooMany });
  ch = null;
  state = 'between';
  const prev = results.find(r => r.k === c.k);
  if (prev) prev.good = prev.good || good; else results.push({ k: c.k, good });
  if (good) $('rpStars').textContent += '⭐';
  else if (!c.retry && level.type === 'echo') { queue.push({ ...c, retry: true }); fb.tip += ' Hij komt zo nog een keer.'; }
  $('rpMsg').innerHTML = `${fb.text}${fb.tip ? `<div class="tip">${fb.tip}</div>` : ''}`;
  setTimeout(() => { if (state === 'between') nextChallenge(0.2); }, fb.tip ? 3200 : 1800);
}

function finishRound() {
  stopRound();
  const good = results.filter(r => r.good).length;
  const need = Math.max(1, Math.round(results.length * 0.7));
  const passed = good >= need;
  const out = progress.recordRun(level.id, passed, { sticker: level.sticker, log: { goodCount: good, total: results.length } });
  // Een heel rondje (goed of niet) telt als opwarmen: dan gaat vandaag het liedje open.
  const justWarmed = progress.settings().rules && progress.markWarmup();
  const idx = LEVELS.indexOf(level);
  const next = LEVELS[idx + 1];
  const btns = [{ label: 'Nog een keer', action: () => onStartButton() }];
  if (justWarmed) btns.push({ label: '🔑 Naar het liedje!', primary: true, action: () => go('liedje') });
  if (passed && next) btns.push({ label: `Volgende: ${next.icon}`, primary: !justWarmed, action: () => enterLevel(next.id) });
  btns.push({ label: 'Naar de levels', action: () => go('ritme') });
  const extras = [];
  if (justWarmed) extras.push('🔑 Opgewarmd! Het liedje is open.');
  if (out.newlyPassed && level.id === UNLOCK_TEMPO) extras.push('🎵 Nieuw: je mag het liedje nu "Met maat" spelen!');
  const extra = extras.length ? Object.assign(document.createElement('div'), { className: 'unlockNote', innerHTML: extras.join('<br>') }) : null;
  if (passed) {
    celebrate({
      emoji: out.newlyGold ? '🥇' : level.icon, party: true,
      title: out.newlyGold ? 'GOUD! Wat ben jij goed!' : out.newlyPassed ? 'Level gehaald!' : 'Weer gelukt!',
      text: out.newlyGold ? 'Je kunt dit nu echt. Op naar het volgende avontuur!'
          : progress.levelStatus(level.id) === 'gold' ? 'Je bent een ritme-kampioen!' : 'Speel hem nog eens op een andere dag voor goud 🥇',
      extra, stickers: out.stickers, buttons: btns,
    });
  } else {
    celebrate({
      emoji: '💪', title: 'Nog niet gehaald',
      text: `${good} van de ${results.length} beurten goed. Je hebt er ${need} nodig. Nog een rondje?`,
      extra, stickers: out.stickers, buttons: btns,
    });
  }
}

// ===================== Ritme tekenen =====================
const NS = 'http://www.w3.org/2000/svg';
// Breedte per noot (niet-lineair, zoals bladmuziek): korte noten relatief meer ruimte voor de woordjes.
const WIDTH = { 0.5: 54, 1: 74, 2: 104, 3: 128 };
const BAR_GAP = 16;
let rhythmEls = [], stripW = 0, xs = [], curEv = [];
function el(tag, a, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, a[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function drawRhythm(ev) {
  const box = $('rpRhythm');
  box.innerHTML = '';
  curEv = ev;
  xs = [];
  let x = 30;
  const bars = [];
  ev.forEach((e, i) => {
    if (i > 0 && e.b % 3 === 0) { bars.push(x + BAR_GAP / 2 - 14); x += BAR_GAP; }
    xs.push(x);
    x += WIDTH[e.dur];
  });
  stripW = x + 20;
  const svg = el('svg', { width: stripW, height: 120, viewBox: `0 0 ${stripW} 120`, class: 'rstrip' }, box);
  bars.forEach(bx => el('line', { x1: bx, x2: bx, y1: 30, y2: 78, class: 'rbar' }, svg));
  rhythmEls = ev.map((e, i) => {
    const g = el('g', { class: 'rnote' }, svg);
    const cx = xs[i], cy = 66;
    const hollow = e.dur >= 2;
    const beamed = e.dur === .5 && ((ev[i + 1] && ev[i + 1].dur === .5 && e.b % 1 === 0) || (ev[i - 1] && ev[i - 1].dur === .5 && e.b % 1 !== 0));
    el('line', { x1: cx + 8, x2: cx + 8, y1: cy - 2, y2: cy - 42, class: 'rstem' }, g);
    if (e.dur === .5 && e.b % 1 === 0 && beamed) el('rect', { x: cx + 7, y: cy - 45, width: xs[i + 1] - cx + 2, height: 6, class: 'rbeam' }, svg);
    if (e.dur === .5 && !beamed) el('path', { d: `M${cx + 8} ${cy - 42} q 10 8 8 20`, class: 'rflag' }, g);
    el('ellipse', { cx, cy, rx: 9.5, ry: 7, transform: `rotate(-20 ${cx} ${cy})`, class: 'rhead' + (hollow ? ' hollow' : '') }, g);
    if (e.dur === 3) el('circle', { cx: cx + 17, cy, r: 3, class: 'rdot' }, g);
    el('text', { x: cx, y: 104, class: 'rlabel' }, g, e.label);
    const star = el('text', { x: cx, y: 22, class: 'rstar' }, g, '⭐');
    return { g, star };
  });
  box.scrollLeft = 0;
  scrollRhythm(ev[0].b);
}

// tel → x-positie in de balk
function beatToX(beat) {
  const ev = curEv;
  if (!ev.length) return 0;
  if (beat <= ev[0].b) return xs[0];
  for (let i = 0; i < ev.length; i++) {
    if (beat < ev[i].b + ev[i].dur) return xs[i] + (beat - ev[i].b) / ev[i].dur * WIDTH[ev[i].dur];
  }
  return xs[xs.length - 1] + WIDTH[ev[ev.length - 1].dur];
}

function setNow(i, listening) {
  rhythmEls.forEach((r, k) => {
    r.g.classList.toggle('now', k === i);
    r.g.classList.toggle('listening', k === i && listening);
  });
}
function markHit(i) { const r = rhythmEls[i]; if (r) { r.g.classList.add('hit'); } }

// Lange stukken (het hele liedje) schuiven mee zodat de huidige tel in beeld blijft.
function scrollRhythm(beat) {
  const box = $('rpRhythm');
  const svg = box.firstChild;
  if (!svg) return;
  const w = box.clientWidth;
  if (stripW <= w) { svg.style.transform = `translateX(${(w - stripW) / 2}px)`; return; }
  const target = beatToX(beat) - w * 0.3;
  const off = Math.max(0, Math.min(stripW - w, target));
  svg.style.transform = `translateX(${-off}px)`;
}

// Voor tests
export const _test = { get ch() { return ch; }, get state() { return state; } };
