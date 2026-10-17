// Stickerboek: pagina's per spel, met een schaduw van elke sticker die nog te verdienen is.
import * as progress from './progress.js';
import { LEVELS } from './games/ritme.js';

// Catalogus: alle stickers die er te verdienen zijn, per pagina.
export const PAGES = [
  { title: '🥁 Ritme-echo', slots: LEVELS.flatMap(L => [
      { id: L.id, emoji: L.sticker, label: L.name },
      { id: L.id + '-gold', emoji: L.sticker, gold: true, label: L.name + ' goud' }]) },
  { title: '🎹 Het liedje', slots: [
      { id: 'liedje-wait', emoji: '🎹', label: 'Wacht op mij' },
      { id: 'liedje-wait-gold', emoji: '🎹', gold: true, label: 'Wacht op mij goud' },
      { id: 'liedje-perfect-wait', emoji: '💎', label: 'Alles in één keer goed' },
      { id: 'liedje-tempo', emoji: '🎼', label: 'Met maat' },
      { id: 'liedje-tempo-gold', emoji: '🎼', gold: true, label: 'Met maat goud' },
      { id: 'liedje-perfect-tempo', emoji: '👑', label: 'Alles op tijd' }] },
  { title: '🎁 Verrassingen', slots: progress.SURPRISES.map(e => ({ id: 'surprise-' + e, emoji: e, label: 'Verrassing', surprise: true })) },
];
const TOTAL = PAGES.reduce((s, p) => s + p.slots.length, 0);

// Oude stickers (van vóór de catalogus) een plek geven.
progress.migrateStickers(s => {
  if (s.surprise) return 'surprise-' + s.emoji;
  const L = LEVELS.find(l => l.sticker === s.emoji);
  if (L) return L.id + (s.gold ? '-gold' : '');
  if (s.emoji === '🎹') return 'liedje-wait' + (s.gold ? '-gold' : '');
  if (s.emoji === '🎼') return 'liedje-tempo' + (s.gold ? '-gold' : '');
  return 'extra-' + s.emoji;
});

export function ownedCount() { return new Set(progress.stickers().map(s => s.id)).size; }
export function totalCount() { return TOTAL; }

export function renderAlbum(box) {
  box.innerHTML = '';
  PAGES.forEach(p => {
    const owned = p.slots.filter(s => progress.hasSticker(s.id)).length;
    const page = document.createElement('div');
    page.className = 'albumPage';
    page.innerHTML = `<h3>${p.title} <span class="count">${owned} van ${p.slots.length}</span></h3>`;
    const grid = document.createElement('div');
    grid.className = 'albumGrid';
    p.slots.forEach(s => {
      const has = progress.hasSticker(s.id);
      const d = document.createElement('div');
      d.className = 'sticker' + (s.gold ? ' gold' : '') + (has ? '' : ' shadow');
      d.innerHTML = `<span>${s.emoji}</span><small>${has ? s.label : ''}</small>`;
      grid.appendChild(d);
    });
    page.appendChild(grid);
    box.appendChild(page);
  });
}
