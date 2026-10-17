// Toetsenbord op het scherm: middelste C t/m de C erboven, met gekleurde stippen (zoals de stickers).
import { STYLE } from './song.js';

const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
const BLACK = [[61, 0], [63, 1], [66, 3], [68, 4], [70, 5]];   // [midi, na witte toets index]

export function buildKeyboard(container, onTap) {
  const keys = {};
  const mk = (midi, cls) => {
    const k = document.createElement('div');
    k.className = 'key ' + cls;
    const st = STYLE[midi % 12];
    if (st && !(cls === 'black' && midi % 12 !== 10)) {
      k.style.setProperty('--c', st.c);
      k.style.setProperty('--t', st.t);
      const d = document.createElement('div');
      d.className = 'dot';
      d.textContent = st.label;
      k.appendChild(d);
    }
    k.addEventListener('pointerdown', e => { e.preventDefault(); onTap && onTap(midi); });
    keys[midi] = k;
    return k;
  };
  WHITE.forEach(m => container.appendChild(mk(m, 'white')));
  BLACK.forEach(([m, after]) => {
    const k = mk(m, 'black');
    k.style.left = `calc(${((after + 1) / WHITE.length) * 100}% - 3.8%)`;
    container.appendChild(k);
  });

  let target = null;
  const keyFor = (pc, prefer) => (prefer != null && prefer % 12 === pc) ? keys[prefer] : keys[60 + pc];
  return {
    setTarget(midi) {
      if (target) target.classList.remove('target');
      target = midi != null ? keys[midi] : null;
      if (target) target.classList.add('target');
    },
    // kind: ok | oops | plain
    flash(pc, kind, prefer) {
      const k = keyFor(pc, prefer);
      if (!k) return;
      k.classList.remove('heard-ok', 'heard-oops', 'heard-plain');
      void k.offsetWidth;
      k.classList.add('heard-' + kind);
      clearTimeout(k._t);
      k._t = setTimeout(() => k.classList.remove('heard-' + kind), 350);
    },
  };
}
