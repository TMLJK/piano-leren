// Feest-scherm: titel, tekst, verdiende stickers, knoppen. Plus confetti.
import { applause, fanfare } from './audio.js';

export function confetti(n = 40) {
  const box = document.getElementById('confetti');
  const items = ['⭐', '❄️', '🎉', '✨', '🎄', '🔔'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = items[i % items.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * 0.8 + 's';
    s.style.fontSize = 18 + Math.random() * 22 + 'px';
    box.appendChild(s);
    setTimeout(() => s.remove(), 3500);
  }
}

// opts: { emoji, title, text, stickers:[{emoji,gold,surprise}], buttons:[{label, action, primary}], party:bool, extra: Node }
export function celebrate(opts) {
  const ov = document.getElementById('celebrate');
  document.getElementById('celEmoji').textContent = opts.emoji || '🎉';
  document.getElementById('celTitle').textContent = opts.title || '';
  document.getElementById('celText').textContent = opts.text || '';
  const extra = document.getElementById('celExtra');
  extra.innerHTML = '';
  if (opts.extra) extra.appendChild(opts.extra);
  const st = document.getElementById('celStickers');
  st.innerHTML = '';
  (opts.stickers || []).forEach(s => {
    const d = document.createElement('div');
    d.className = 'sticker' + (s.gold ? ' gold' : '') + ' pop-in';
    d.innerHTML = `<span>${s.emoji}</span><small>${s.surprise ? 'Verrassing!' : s.gold ? 'Goud!' : 'Nieuwe sticker'}</small>`;
    st.appendChild(d);
  });
  const bb = document.getElementById('celBtns');
  bb.innerHTML = '';
  (opts.buttons || [{ label: 'OK', primary: true }]).forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.primary) btn.className = 'primary';
    btn.addEventListener('click', () => { ov.hidden = true; b.action && b.action(); });
    bb.appendChild(btn);
  });
  ov.hidden = false;
  if (opts.party) { confetti(); fanfare(); setTimeout(() => applause(), 450); }
}
