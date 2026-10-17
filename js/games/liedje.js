// Het liedje: Luister / Wacht op mij / Met maat. Vriendelijk: geen rode kruisjes, "Oeps, geeft niks!".
import { notes, LINES, STYLE, BEATS_PER_MEASURE, PICKUP_POS, TOTAL_BEATS, countLabel } from '../song.js';
import { ensureAudio, click, tone, stopScheduled, now, getAC } from '../audio.js';
import { onNote, startMic, micReady, setStatus, DEBUG, emit } from '../mic.js';
import { buildKeyboard } from '../keyboard.js';
import * as progress from '../progress.js';
import { celebrate } from '../celebrate.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const VB_W = 1000, VB_H = 180, GAP = 12, STAFF_TOP = 72, STAFF_BOT = STAFF_TOP + 4 * GAP;
const BUBBLE_Y = 24, LYRIC_Y = 168, MARK_Y = 150, STEM = 3.5 * GAP;
const yOf = step => STAFF_BOT - (step - 2) * GAP / 2;

function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// ===================== Bladmuziek =====================
const noteEls = [];
function buildSheet() {
  const sheet = $('sheet');
  LINES.forEach(([ma, mb], li) => {
    const wrap = document.createElement('div');
    wrap.className = 'lineWrap';
    const svg = el('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, preserveAspectRatio: 'xMidYMid meet' }, wrap);
    const hlLayer = el('g', {}, svg);
    for (let k = 0; k < 5; k++) el('line', { x1: 10, x2: VB_W - 10, y1: STAFF_TOP + k * GAP, y2: STAFF_TOP + k * GAP, class: 'staff' }, svg);
    el('line', { x1: 10, x2: 10, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
    el('text', { x: 14, y: STAFF_BOT + 10, class: 'clef' }, svg, '𝄞');
    el('text', { x: 62, y: yOf(6) + 10, class: 'keysig' }, svg, '♭');
    let headerW = 88;
    if (li === 0) {
      el('text', { x: 100, y: STAFF_TOP + 2 * GAP - 3, class: 'timesig' }, svg, '3');
      el('text', { x: 100, y: STAFF_BOT - 3, class: 'timesig' }, svg, '4');
      headerW = 120;
    }
    const ms = [];
    for (let m = ma; m <= mb; m++) ms.push(m);
    // Niet-lineaire spatiëring (zoals gegraveerd notenschrift), zodat bolletjes niet overlappen.
    const WEIGHT = { 0.5: 0.75, 1: 1, 2: 1.45, 3: 1.8 };
    const lineNotes = notes.filter(n => n.line === li);
    const mWeight = m => lineNotes.filter(n => n.measure === m).reduce((s, n) => s + WEIGHT[n.beats], 0);
    const PADL = 20, PADR = 12;
    const totalWeight = ms.reduce((s, m) => s + mWeight(m), 0);
    const unit = (VB_W - 10 - headerW - ms.length * (PADL + PADR)) / totalWeight;
    const mX = {};
    let x = headerW;
    ms.forEach(m => {
      mX[m] = x;
      x += PADL + mWeight(m) * unit + PADR;
      if (m === LINES[LINES.length - 1][1]) {
        el('line', { x1: x - 8, x2: x - 8, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
        el('line', { x1: x - 2, x2: x - 2, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar thick' }, svg);
      } else {
        el('line', { x1: x, x2: x, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
      }
    });
    const offset = {};
    lineNotes.forEach(n => {
      const o = offset[n.measure] || 0;
      n.x = mX[n.measure] + PADL + o + 8;
      n.y = yOf(n.step);
      n.w = WEIGHT[n.beats] * unit;
      offset[n.measure] = o + n.w;
    });
    const beamPartner = {};
    lineNotes.forEach((n, k) => {
      const nx = lineNotes[k + 1];
      if (n.beats === .5 && nx && nx.beats === .5 && nx.measure === n.measure &&
          Math.floor(n.inMeasure) === Math.floor(nx.inMeasure) && n.inMeasure % 1 === 0) {
        beamPartner[n.i] = nx.i; beamPartner[nx.i] = n.i;
        const beamY = Math.min(n.y, nx.y) - STEM;
        n.beamY = nx.beamY = beamY;
        el('rect', { x: n.x + 6.6, y: beamY - 2.5, width: nx.x - n.x + 1.6, height: 5, class: 'beam' }, svg);
      }
    });
    const topLayer = el('g', {}, svg);
    lineNotes.forEach(n => {
      const st = STYLE[n.pc];
      const vars = `--c:${st.c};--t:${st.t}`;
      const hl = el('rect', { x: n.x - 15, y: STAFF_TOP - 16, width: Math.max(n.w - 2, 28),
                              height: MARK_Y + 8 - (STAFF_TOP - 16), rx: 8, class: 'hl' }, hlLayer);
      const g = el('g', { class: 'note' + (n.beats >= 2 ? ' hollow' : ''), style: vars }, svg);
      for (let s = 0; s >= n.step; s -= 2) el('line', { x1: n.x - 12, x2: n.x + 12, y1: yOf(s), y2: yOf(s), class: 'ledger' }, g);
      for (let s = 8; s <= n.step; s += 2) el('line', { x1: n.x - 12, x2: n.x + 12, y1: yOf(s), y2: yOf(s), class: 'ledger' }, g);
      if (n.beats < 3) {
        if (beamPartner[n.i] != null) el('line', { x1: n.x + 6.6, x2: n.x + 6.6, y1: n.y - 1, y2: n.beamY, class: 'stem' }, g);
        else if (n.step < 6) el('line', { x1: n.x + 6.6, x2: n.x + 6.6, y1: n.y - 1, y2: n.y - STEM, class: 'stem' }, g);
        else el('line', { x1: n.x - 6.6, x2: n.x - 6.6, y1: n.y + 1, y2: n.y + STEM, class: 'stem' }, g);
      }
      el('ellipse', { cx: n.x, cy: n.y, rx: 7.6, ry: 5.6, transform: `rotate(-20 ${n.x} ${n.y})`, class: 'head' }, g);
      if (n.beats === 3) el('circle', { cx: n.x + 14, cy: n.y - ((n.step - 2) % 2 === 0 ? 3 : 0), r: 2.4, class: 'dotmark' }, g);
      el('text', { x: n.x, y: LYRIC_Y, class: 'lyric' }, svg, n.lyric);
      const mark = el('text', { x: n.x, y: MARK_Y, class: 'mark' }, svg, '');
      const bubbleWrap = el('g', { transform: `translate(${n.x} ${BUBBLE_Y})`, class: 'bubbleWrap', style: vars }, topLayer);
      const shaker = el('g', { class: 'shaker' }, bubbleWrap);
      const bubble = el('g', { class: 'bubble' }, shaker);
      el('circle', { r: 15 }, bubble);
      el('text', { 'font-size': st.label.length > 1 ? 11.5 : 18 }, bubble, st.label);
      noteEls[n.i] = { g, hl, bubbleWrap, shaker, mark, topLayer };
    });
    sheet.appendChild(wrap);
  });
}

// ===================== Spel-logica =====================
let kb = null, built = false, unsub = null;
let state = 'idle';            // idle | countin | playing | paused | done
let mode = 'wait', tempo = 90, hint = 1;
let cur = 0, firstTry = true, wrongPresses = 0, judged = [];
let t0 = 0, startBeat = 0, spb = 1, segFromBeat = 0, segFromIdx = 0, scheduledUpTo = 0;
let activeIdx = -1, shownLine = -1, lastCount = null, wakeLock = null, busy = false, lastOops = 0;

const EARLY = 0.25;
const lateTol = n => Math.min(0.45, Math.max(0.2, n.beats * spb * 0.75));
const beatTime = b => t0 + (b - startBeat) * spb;
const nowBeat = () => startBeat + (now() - t0) / spb;
const measureStartIdx = i => notes.findIndex(n => n.measure === notes[i].measure);

export function enter() {
  const s = progress.settings().liedje;
  mode = s.mode; tempo = s.tempo; hint = s.hint;
  if (!built) {
    buildSheet();
    kb = buildKeyboard($('keyboard'), onKeyTap);
    wireControls();
    built = true;
  }
  if (!unsub) unsub = onNote(onNoteHeard);
  reset();
  updateUI();
}
export function exit() {
  if (state === 'countin' || state === 'playing') pause();
  reset();
  if (unsub) { unsub(); unsub = null; }
}

function setLine(li) {
  if (li === shownLine) return;
  shownLine = li;
  $('sheet').style.transform = `translateY(${-li * 22}vh)`;
}
function setTarget(i) { kb.setTarget(i >= 0 && mode !== 'listen' ? notes[i].midi : null); }
function setActive(i) {
  if (i === activeIdx) return;
  if (activeIdx >= 0) {
    const e = noteEls[activeIdx];
    e.g.classList.remove('active'); e.hl.classList.remove('active'); e.bubbleWrap.classList.remove('active');
  }
  activeIdx = i;
  if (i >= 0) {
    const e = noteEls[i];
    e.g.classList.add('active'); e.hl.classList.add('active'); e.bubbleWrap.classList.add('active');
    e.topLayer.appendChild(e.bubbleWrap);
    setLine(notes[i].line);
  }
  setTarget(i);
}
// Alleen wat lukt krijgt een vinkje; gemiste noten blijven gewoon leeg.
function judge(i, kind) {
  judged[i] = kind;
  if (kind === 'ok') {
    noteEls[i].mark.setAttribute('class', 'mark ok');
    noteEls[i].mark.textContent = '✓';
  }
  noteEls[i].bubbleWrap.classList.add('done');
}
function clearMarks(from = 0) {
  for (let i = from; i < notes.length; i++) {
    judged[i] = null;
    noteEls[i].mark.textContent = '';
    noteEls[i].bubbleWrap.classList.remove('done');
  }
}
function oeps() {
  const t = performance.now();
  if (t - lastOops < 1500) return;
  lastOops = t;
  const o = $('oeps');
  o.textContent = ['Oeps, geeft niks! 😄', 'Hup, gewoon door! 🎶', 'Geeft niks, speel verder! 😊'][Math.floor(Math.random() * 3)];
  o.classList.remove('show'); void o.offsetWidth; o.classList.add('show');
}

function startSegment(fromIdx, withCountIn) {
  spb = 60 / tempo;
  segFromIdx = fromIdx;
  segFromBeat = notes[fromIdx].songBeat;
  const countLen = fromIdx === 0 ? 2 * BEATS_PER_MEASURE - (BEATS_PER_MEASURE - PICKUP_POS) : BEATS_PER_MEASURE;
  startBeat = withCountIn ? segFromBeat - countLen : segFromBeat;
  t0 = now() + 0.15;
  if (withCountIn) for (let b = startBeat; b < segFromBeat; b++) click(beatTime(b), countLabel(b) === 1);
  scheduledUpTo = segFromBeat;
  lastCount = null;
  state = withCountIn ? 'countin' : 'playing';
  setActive(fromIdx);
}
function showCount(b) {
  const k = Math.floor(b);
  if (k >= segFromBeat || k === lastCount || k < startBeat) return;
  lastCount = k;
  const cd = $('countdown');
  cd.textContent = countLabel(k);
  cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
}

export function tick() {
  if (!(state === 'countin' || state === 'playing')) return;
  const b = nowBeat();
  if (state === 'countin') {
    showCount(b);
    if (b >= segFromBeat) state = 'playing';
    if (mode === 'wait') return;
  }
  if (mode === 'wait') return;
  const horizon = b + 0.3 / spb;
  if (horizon > scheduledUpTo) {
    if (mode === 'listen') {
      for (const n of notes) if (n.songBeat >= scheduledUpTo && n.songBeat < horizon) tone(n.midi, beatTime(n.songBeat), n.beats * spb * 0.9);
    }
    for (let k = Math.ceil(scheduledUpTo); k < horizon && k < TOTAL_BEATS; k++) click(beatTime(k), countLabel(k) === 1, 0.35);
    scheduledUpTo = horizon;
  }
  if (state !== 'playing') return;
  let a = Math.max(activeIdx, segFromIdx);
  while (a + 1 < notes.length && notes[a + 1].songBeat <= b) a++;
  setActive(a);
  if (mode === 'tempo') {
    for (let i = segFromIdx; i < notes.length; i++) {
      const n = notes[i];
      if (n.songBeat > b) break;
      if (!judged[i] && (b - n.songBeat) * spb > lateTol(n) + 0.25) judge(i, 'miss');
    }
  }
  if (b >= TOTAL_BEATS + 0.3) finish();
}

function onNoteHeard(midi, tHeard) {
  const pc = ((midi % 12) + 12) % 12;
  const st = STYLE[pc];
  $('heard').textContent = 'Ik hoor: ' + (st ? st.label : '?');
  const playingLike = state === 'playing' || state === 'countin';
  if (!playingLike || mode === 'listen') { kb.flash(pc, 'plain'); return; }
  if (mode === 'wait') {
    if (state !== 'playing') return;
    const n = notes[cur];
    if (pc === n.pc) {
      kb.flash(pc, 'ok', n.midi);
      judge(cur, 'ok');
      if (!firstTry) judged[cur] = 'retry';
      cur++;
      firstTry = true;
      if (cur >= notes.length) finish(); else setActive(cur);
    } else {
      firstTry = false;
      wrongPresses++;
      kb.flash(pc, 'oops');
      const s = noteEls[cur].shaker;
      s.classList.remove('shake'); void s.getBoundingClientRect(); s.classList.add('shake');
    }
    return;
  }
  const b = startBeat + (tHeard - t0) / spb;
  let best = -1, bestD = Infinity;
  for (let i = segFromIdx; i < notes.length; i++) {
    const n = notes[i];
    const dt = (b - n.songBeat) * spb;
    if (dt < -EARLY) break;
    if (judged[i] || dt > lateTol(n)) continue;
    if (n.pc === pc && Math.abs(dt) < bestD) { best = i; bestD = Math.abs(dt); }
  }
  if (best >= 0) { judge(best, 'ok'); kb.flash(pc, 'ok', notes[best].midi); }
  else { wrongPresses++; kb.flash(pc, 'oops'); oeps(); }
}

function onKeyTap(midi) {
  ensureAudio();
  if (DEBUG) { emit(midi, now()); return; }
  kb.flash(midi % 12, 'plain', midi);
  if ((state === 'playing' || state === 'countin') && mode !== 'listen') {
    setStatus('🎹 Speel op je eigen keyboard, ik luister mee!');
    return;
  }
  const ac = getAC();
  const play = () => tone(midi, ac.currentTime + 0.02, 0.4);
  if (ac.state === 'running') play(); else ac.resume().then(play);
}

async function keepAwake() { try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseAwake() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

async function begin() {
  if (mode !== 'listen') await startMic();
  keepAwake();
  cur = 0; firstTry = true; wrongPresses = 0;
  clearMarks();
  setActive(-1);
  startSegment(0, true);
}
function pause() {
  stopScheduled();
  if (mode !== 'wait') {
    const from = measureStartIdx(Math.max(activeIdx, 0));
    clearMarks(from);
    setActive(from);
  }
  state = 'paused';
  $('countdown').classList.remove('pop');
}
function resume() {
  keepAwake();
  if (mode === 'wait') {
    if (cur === 0 && !judged[0]) { startSegment(0, true); return; }
    state = 'playing';
    setActive(cur);
  } else {
    startSegment(activeIdx, true);
  }
}
function reset() {
  stopScheduled();
  releaseAwake();
  state = 'idle';
  cur = 0;
  if (built) { clearMarks(); setActive(-1); }
  shownLine = -1;
  if (built) setLine(0);
  $('countdown').classList.remove('pop');
  $('heard').textContent = '';
}

// ===================== Einde: kerstboom vol ballen =====================
function treeSvg(balls, total) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'tree');
  el('polygon', { points: '100,10 30,170 170,170', fill: '#2E7D32' }, svg);
  el('rect', { x: 88, y: 170, width: 24, height: 22, fill: '#6D4C41' }, svg);
  el('text', { x: 100, y: 20, 'text-anchor': 'middle', 'font-size': 26 }, svg, '⭐');
  const colors = ['#E53935', '#FDD835', '#00ACC1', '#F48FB1', '#7E57C2', '#EF6C00', '#fff'];
  // vaste plekken binnen de driehoek (rij voor rij)
  // vaste plekken binnen de driehoek, rij voor rij (63 plekken past ruim voor 52 noten)
  const spots = [];
  for (let y = 36; y <= 162 && spots.length < total; y += 10) {
    const half = (y - 10) * 70 / 160 - 6;
    const nInRow = Math.max(1, Math.floor((half * 2) / 12));
    for (let k = 0; k < nInRow && spots.length < total; k++) spots.push([100 - half + (k + 0.5) * (half * 2 / nInRow), y]);
  }
  spots.slice(0, balls).forEach(([x, y], k) => el('circle', { cx: x, cy: y, r: 4.5, fill: colors[k % colors.length], stroke: '#0003' }, svg));
  return svg;
}

function finish() {
  state = 'done';
  stopScheduled();
  releaseAwake();
  setActive(-1);
  updateUI();
  if (mode === 'listen') return;
  if (mode === 'tempo' && !micReady()) return;
  const total = notes.length;
  const ok = judged.filter(j => j === 'ok' || j === 'retry').length;
  const firstOk = judged.filter(j => j === 'ok').length;
  const pct = Math.round(100 * (mode === 'wait' ? firstOk : ok) / total);
  const id = mode === 'wait' ? 'liedje-wait' : 'liedje-tempo';
  const good = mode === 'wait' ? true : pct >= 80;
  const out = progress.recordRun(id, good, { sticker: mode === 'wait' ? '🎹' : '🎼', log: { mode, tempo, hint, pct, wrong: wrongPresses } });
  celebrate({
    emoji: '🎄', party: true,
    title: mode === 'wait' ? 'Het hele liedje gespeeld!' : ok >= total * 0.8 ? 'Wat een mooi concert!' : 'Wat heb jij mooi gespeeld!',
    text: `Je hebt ${ok} kerstballen in de boom gehangen!`,
    extra: treeSvg(ok, total), stickers: out.stickers,
    buttons: [{ label: 'OK', primary: true }],
  });
}

// ===================== Knoppen =====================
function updateUI() {
  const L = {
    idle: ['START', true, 'STOP', false], countin: ['…', false, 'STOP', true], playing: ['…', false, 'STOP', true],
    paused: ['VERDER', true, 'RESET', true], done: ['NOG EEN KEER', true, 'RESET', true],
  }[state];
  const bs = $('btnStart'), bt = $('btnStop');
  bs.textContent = L[0]; bs.disabled = !L[1] || busy;
  bt.textContent = L[2]; bt.disabled = !L[3];
  const locked = state === 'countin' || state === 'playing';
  document.querySelectorAll('#modeGroup button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.disabled = locked; });
  document.querySelectorAll('#hintGroup button').forEach(b => b.classList.toggle('on', +b.dataset.hint === hint));
  $('slower').disabled = locked || tempo <= 50;
  $('faster').disabled = locked || tempo >= 140;
  $('tempoVal').textContent = `${tempo} ♩/min`;
  const scr = $('scr-liedje');
  scr.classList.remove('hint1', 'hint2', 'hint3');
  scr.classList.add('hint' + hint);
  const s = progress.settings();
  s.liedje = { mode, tempo, hint };
  progress.saveSettings(s);
}

function wireControls() {
  $('btnStart').addEventListener('click', async () => {
    ensureAudio();
    if (busy) return;
    busy = true; updateUI();
    try {
      if (state === 'idle') await begin();
      else if (state === 'paused') resume();
      else if (state === 'done') { reset(); await begin(); }
    } finally { busy = false; updateUI(); }
  });
  $('btnStop').addEventListener('click', () => {
    if (state === 'countin' || state === 'playing') pause();
    else if (state === 'paused' || state === 'done') reset();
    updateUI();
  });
  document.querySelectorAll('#modeGroup button').forEach(b => b.addEventListener('click', () => {
    if (mode !== b.dataset.mode) { mode = b.dataset.mode; if (state !== 'idle') reset(); }
    updateUI();
  }));
  document.querySelectorAll('#hintGroup button').forEach(b => b.addEventListener('click', () => {
    hint = +b.dataset.hint; setTarget(activeIdx); updateUI();
  }));
  $('slower').addEventListener('click', () => { tempo = Math.max(50, tempo - 10); updateUI(); });
  $('faster').addEventListener('click', () => { tempo = Math.min(140, tempo + 10); updateUI(); });
}

// Voor tests
export const _test = { get state() { return state; }, get judged() { return judged; }, get cur() { return cur; },
  get t0() { return t0; }, get spb() { return spb; }, get startBeat() { return startBeat; } };
