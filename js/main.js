// Regie: schermen wisselen, startscherm, stickerboek, ouderscherm, en de beeld-lus.
import { ensureAudio } from './audio.js';
import { poll, startMic, setStatus, DEBUG, getCalib, resetCalib } from './mic.js';
import * as progress from './progress.js';
import * as ritme from './games/ritme.js';
import * as liedje from './games/liedje.js';

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'ritme', 'ritmeplay', 'liedje', 'album', 'ouder'];
let current = 'home';

function go(name) {
  if (current === 'ritmeplay' && name !== 'ritmeplay') ritme.exit();
  if (current === 'liedje' && name !== 'liedje') liedje.exit();
  current = name;
  SCREENS.forEach(s => { $('scr-' + s).hidden = s !== name; });
  if (name === 'home') renderHome();
  if (name === 'ritme') ritme.renderPath();
  if (name === 'liedje') liedje.enter();
  if (name === 'album') renderAlbum();
  if (name === 'ouder') renderOuder();
  window.scrollTo(0, 0);
}
ritme.init(go);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) { ensureAudio(); go(t.dataset.go); }
});
// Safari geeft geluid soms pas vrij na een volledige klik/tik: ontgrendel bij elke gebruikersactie.
['pointerup', 'click', 'touchend', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => { ensureAudio(); }, { capture: true }));

// ===================== Startscherm =====================
function renderHome() {
  const w = $('week');
  w.innerHTML = '<span class="weekLabel">Deze week:</span>';
  progress.thisWeek().forEach(d => {
    const s = document.createElement('div');
    s.className = 'day' + (d.done ? ' done' : '') + (d.today ? ' today' : '');
    s.innerHTML = `<span>${d.done ? '❄️' : ''}</span><small>${d.label}</small>`;
    w.appendChild(s);
  });
  const n = progress.stickers().length;
  $('stickerCount').textContent = n ? `${n} sticker${n === 1 ? '' : 's'}` : 'Nog leeg: verdien je eerste!';
}

// ===================== Stickerboek =====================
function renderAlbum() {
  const box = $('album');
  box.innerHTML = '';
  const list = progress.stickers();
  list.forEach(s => {
    const d = document.createElement('div');
    d.className = 'sticker' + (s.gold ? ' gold' : '');
    d.innerHTML = `<span>${s.emoji}</span><small>${s.surprise ? 'verrassing' : s.gold ? 'goud' : ''}</small>`;
    box.appendChild(d);
  });
  for (let i = 0; i < Math.max(4, 12 - list.length); i++) {
    const d = document.createElement('div');
    d.className = 'sticker empty';
    d.innerHTML = '<span>?</span>';
    box.appendChild(d);
  }
}

// ===================== Ouderscherm =====================
function renderOuder() {
  const s = progress.settings();
  const lv = ritme.LEVELS.map(L => {
    const st = progress.levelStatus(L.id), gp = progress.goldProgress(L.id);
    return `<tr><td>${L.icon} ${L.name}</td><td>${{ open: '–', passed: 'gehaald', gold: 'goud' }[st]}</td><td>${gp.runs} goed op ${gp.days} dag(en)</td></tr>`;
  }).join('');
  const hist = progress.history().filter(h => h.id && h.id.startsWith('liedje')).slice(-12).reverse().map(h =>
    `<tr><td>${new Date(h.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${new Date(h.date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</td>
     <td>${h.mode === 'wait' ? 'Wacht op mij' : 'Met maat ' + h.tempo}</td><td>${h.pct}%${h.mode === 'wait' ? ' in één keer' : ' op tijd'}</td></tr>`).join('');
  $('ouder').innerHTML = `
    <p class="small">Hier staan de details. Je dochter ziet alleen sterren, stickers en de kerstboom.</p>
    <h3>Ritme-echo</h3>
    <table>${lv}</table>
    <h3>Het liedje (laatste keren)</h3>
    <table>${hist || '<tr><td>Nog niet gespeeld</td></tr>'}</table>
    <h3>Instellingen</h3>
    <div class="setRow">Tempo Ritme-echo:
      <button id="oTslow">−</button><b id="oTval">${s.ritmeTempo}</b><button id="oTfast">+</button>
      <span class="small">(advies 90–100; lager is voor kinderen níet makkelijker)</span></div>
    <div class="setRow">Hoe streng op tijd:
      <button id="oTolR" class="${s.tolerance === 'ruim' ? 'on' : ''}">Ruim</button>
      <button id="oTolN" class="${s.tolerance === 'normaal' ? 'on' : ''}">Normaal</button></div>
    <div class="setRow">Microfoon-vertraging (gemeten in "Hartslag"): <b>${Math.round(getCalib() * 1000)} ms</b>
      <button id="oCal">Opnieuw meten</button></div>
    <div class="setRow"><button id="oReset" class="danger">Alle voortgang wissen</button></div>`;
  const upd = f => { const x = progress.settings(); f(x); progress.saveSettings(x); renderOuder(); };
  $('oTslow').onclick = () => upd(x => { x.ritmeTempo = Math.max(60, x.ritmeTempo - 10); });
  $('oTfast').onclick = () => upd(x => { x.ritmeTempo = Math.min(130, x.ritmeTempo + 10); });
  $('oTolR').onclick = () => upd(x => { x.tolerance = 'ruim'; });
  $('oTolN').onclick = () => upd(x => { x.tolerance = 'normaal'; });
  $('oCal').onclick = () => { resetCalib(); renderOuder(); };
  $('oReset').onclick = () => { if (confirm('Echt alle sterren, stickers en levels wissen?')) { progress.resetAll(); renderOuder(); } };
}

// Ouderscherm achter een simpele rekensom, zodat het niet per ongeluk opengaat.
$('btnParent').addEventListener('click', () => {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  const ans = prompt(`Voor ouders: hoeveel is ${a} × ${b}?`);
  if (ans != null && +ans === a * b) go('ouder');
});

$('rpStart').addEventListener('click', () => ritme.onStartButton());
$('micBtn').addEventListener('click', async () => {
  if (await startMic()) setStatus('🎤 Speel een toets: ik laat zien welke ik hoor');
});

// ===================== Beeld-lus =====================
function step() {
  poll();
  if (current === 'ritmeplay') ritme.tick();
  if (current === 'liedje') liedje.tick();
}
(function frame() { requestAnimationFrame(frame); step(); })();

setStatus(DEBUG ? 'DEBUG: spatiebalk of scherm-toets = gespeelde noot' : '');
go('home');

// Voor tests
window.__kp = { go, step, ritme, liedje, progress };
