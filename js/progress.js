// Voortgang: levels (gehaald / goud), stickers, oefendagen en geschiedenis voor het ouderscherm.
// Regels (zie onderzoek): 1 goede ronde = gehaald → volgende level open.
// Goud = 3 goede rondes, waarvan op minstens 2 verschillende dagen. Een mislukte ronde kost nooit iets.

const KEY = 'kerstpiano.progress.v1';
const GOLD_RUNS = 3, GOLD_DAYS = 2, SURPRISE_CHANCE = 0.2;
export const SURPRISES = ['🦌', '🍪', '🧦', '🔔', '🎁', '🐧', '❄️', '🍭', '🦉', '🕯️', '🧸', '🌈'];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}
let P = load() || { levels: {}, stickers: [], days: [], history: [] };
function save() { localStorage.setItem(KEY, JSON.stringify(P)); }

export function levelData(id) {
  return P.levels[id] || (P.levels[id] = { passed: false, gold: false, goodDays: [], goodRuns: 0, runs: 0 });
}
export function levelStatus(id) {
  const L = P.levels[id];
  if (!L) return 'open';
  return L.gold ? 'gold' : L.passed ? 'passed' : 'open';
}
// Level i is open als het vorige gehaald is.
export function isUnlocked(ids, i) { return i === 0 || ['passed', 'gold'].includes(levelStatus(ids[i - 1])); }

// Registreer een gespeelde ronde. Geeft terug wat er te vieren valt.
export function recordRun(id, good, detail = {}) {
  const L = levelData(id);
  const d = today();
  L.runs++;
  const out = { newlyPassed: false, newlyGold: false, stickers: [] };
  if (good) {
    L.goodRuns++;
    if (!L.goodDays.includes(d)) L.goodDays.push(d);
    if (!L.passed) { L.passed = true; out.newlyPassed = true; }
    if (!L.gold && L.goodRuns >= GOLD_RUNS && L.goodDays.length >= GOLD_DAYS) { L.gold = true; out.newlyGold = true; }
  }
  if (!P.days.includes(d)) P.days.push(d);
  if (detail.sticker && out.newlyPassed) out.stickers.push(addSticker(detail.sticker, false));
  if (detail.sticker && out.newlyGold) out.stickers.push(addSticker(detail.sticker, true));
  // Af en toe een onverwacht cadeautje — juist niet aangekondigd.
  if (Math.random() < SURPRISE_CHANCE) out.stickers.push(addSticker(SURPRISES[Math.floor(Math.random() * SURPRISES.length)], false, true));
  P.history.push({ date: new Date().toISOString(), id, good, ...detail.log });
  if (P.history.length > 1000) P.history = P.history.slice(-1000);
  save();
  return out;
}

function addSticker(emoji, gold, surprise = false) {
  const s = { emoji, gold, surprise, date: today() };
  P.stickers.push(s);
  return s;
}

export function goldProgress(id) {
  const L = P.levels[id];
  if (!L) return { runs: 0, days: 0, needRuns: GOLD_RUNS, needDays: GOLD_DAYS };
  return { runs: L.goodRuns, days: L.goodDays.length, needRuns: GOLD_RUNS, needDays: GOLD_DAYS };
}
export function stickers() { return P.stickers; }
export function history() { return P.history; }
export function practiceDays() { return P.days; }

// Maandag t/m zondag van deze week, met wel/niet geoefend.
export function thisWeek() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;            // maandag = 0
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    return { key, label: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'][i], done: P.days.includes(key), today: key === today() };
  });
}

export function resetAll() { P = { levels: {}, stickers: [], days: [], history: [] }; save(); }

// Instellingen (ouderscherm)
const SKEY = 'kerstpiano.settings.v2';
const DEFAULTS = { ritmeTempo: 90, tolerance: 'ruim', liedje: { mode: 'wait', tempo: 90, hint: 1 } };
export function settings() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SKEY)) || {}) }; } catch (e) { return { ...DEFAULTS }; }
}
export function saveSettings(s) { localStorage.setItem(SKEY, JSON.stringify(s)); }
