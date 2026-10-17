// Regie: schermen wisselen, startscherm, stickerboek, ouderscherm, en de beeld-lus.
import { ensureAudio, clockStalled } from './audio.js';
import { poll, startMic, setStatus, DEBUG, getCalib, resetCalib } from './mic.js';
import * as progress from './progress.js';
import * as ritme from './games/ritme.js';
import * as liedje from './games/liedje.js';
import { renderAlbum as drawAlbum, ownedCount, totalCount } from './album.js';

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'ritme', 'ritmeplay', 'liedje', 'album', 'ouder'];
let current = 'home';

// Oefenregel: eerst opwarmen (1 rondje Ritme-echo per dag), dan gaat het liedje open.
export const needsWarmup = () => progress.settings().rules && !progress.warmedUpToday();

function go(name) {
  if (name === 'liedje' && needsWarmup()) name = 'ritme';
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
liedje.init(go);

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
  const n = ownedCount();
  $('stickerCount').textContent = n ? `${n} van de ${totalCount()} stickers` : 'Nog leeg: verdien je eerste!';
  const lock = needsWarmup();
  const card = document.querySelector('.c-liedje');
  card.classList.toggle('locked', lock);
  card.querySelector('small').textContent = lock ? '🔒 Eerst opwarmen: 1 rondje Ritme-echo 🥁' : 'We Wish You a Merry Christmas';
  document.querySelector('.c-ritme small').textContent = lock ? '🔥 Begin hier met opwarmen!' : 'Doe het ritme na!';
}

// ===================== Stickerboek =====================
function renderAlbum() { drawAlbum($('album')); }

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
    <div class="setRow">Oefenregels (eerst opwarmen, "Met maat" via Ritme-echo):
      <button id="oRulesOn" class="${s.rules ? 'on' : ''}">Aan</button>
      <button id="oRulesOff" class="${!s.rules ? 'on' : ''}">Uit</button>
      <span class="small">Vandaag opgewarmd: ${progress.warmedUpToday() ? 'ja' : 'nee'}</span></div>
    <div class="setRow">Hoe streng op tijd:
      <button id="oTolR" class="${s.tolerance === 'ruim' ? 'on' : ''}">Ruim</button>
      <button id="oTolN" class="${s.tolerance === 'normaal' ? 'on' : ''}">Normaal</button></div>
    <div class="setRow">Microfoon-vertraging (gemeten in "Hartslag"): <b>${Math.round(getCalib() * 1000)} ms</b>
      <button id="oCal">Opnieuw meten</button></div>
    <div class="setRow"><button id="oReset" class="danger">Alle voortgang wissen</button></div>`;
  const upd = f => { const x = progress.settings(); f(x); progress.saveSettings(x); renderOuder(); };
  $('oTslow').onclick = () => upd(x => { x.ritmeTempo = Math.max(60, x.ritmeTempo - 10); });
  $('oTfast').onclick = () => upd(x => { x.ritmeTempo = Math.min(130, x.ritmeTempo + 10); });
  $('oRulesOn').onclick = () => upd(x => { x.rules = true; });
  $('oRulesOff').onclick = () => upd(x => { x.rules = false; });
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
let stallShown = false;
function step() {
  // Staat de geluidsklok stil tijdens het spelen (iOS)? Vraag om een tik: elke tik maakt het geluid weer los.
  const playing = (current === 'ritmeplay' && ['running', 'between'].includes(ritme._test.state)) ||
                  (current === 'liedje' && ['countin', 'playing'].includes(liedje._test.state));
  const stalled = playing && clockStalled();
  if (stalled && !stallShown) { setStatus('👆 Tik op het scherm om verder te gaan'); stallShown = true; }
  if (!stalled && stallShown) { setStatus(''); stallShown = false; }
  poll();
  if (current === 'ritmeplay') ritme.tick();
  if (current === 'liedje') liedje.tick();
}
(function frame() { requestAnimationFrame(frame); step(); })();

setStatus(DEBUG ? 'DEBUG: spatiebalk of scherm-toets = gespeelde noot' : '');
go('home');

// Voor tests
window.__kp = { go, step, ritme, liedje, progress };
