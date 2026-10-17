// Het liedje + gedeelde muziek-definities (kleuren, nootnamen).

// [noot, tellen, lettergreep] — F majeur, 3/4, begint met opmaat op tel 3.
export const SONG = [
  ['C4',1,'We'],
  ['F4',1,'wish'], ['F4',.5,'you'], ['G4',.5,'a'], ['F4',.5,'Mer-'], ['E4',.5,'ry'],
  ['D4',1,'Christ-'], ['D4',1,'mas,'], ['D4',1,'we'],
  ['G4',1,'wish'], ['G4',.5,'you'], ['A4',.5,'a'], ['G4',.5,'Mer-'], ['F4',.5,'ry'],
  ['E4',1,'Christ-'], ['C4',1,'mas,'], ['C4',1,'we'],
  ['A4',1,'wish'], ['A4',.5,'you'], ['Bb4',.5,'a'], ['A4',.5,'Mer-'], ['G4',.5,'ry'],
  ['F4',1,'Christ-'], ['D4',1,'mas'], ['C4',.5,'and'], ['C4',.5,'a'],
  ['D4',1,'hap-'], ['G4',1,'py'], ['E4',1,'new'],
  ['F4',2,'year.'], ['C4',1,'Good'],
  ['F4',1,'ti-'], ['F4',1,'dings'], ['F4',1,'we'],
  ['E4',2,'bring'], ['E4',1,'to'],
  ['F4',1,'you'], ['E4',1,'and'], ['D4',1,'your'],
  ['C4',2,'kin,'], ['G4',1,'good'],
  ['A4',1,'ti-'], ['G4',1,'dings'], ['F4',1,'for'],
  ['C5',1,'Christ-'], ['C4',1,'mas'], ['C4',.5,'and'], ['C4',.5,'a'],
  ['D4',1,'hap-'], ['G4',1,'py'], ['E4',1,'new'],
  ['F4',3,'year!'],
];
export const LINES = [[0,4],[5,8],[9,12],[13,16]];      // maten per regel bladmuziek (maat 0 = opmaat)
export const PHRASE_STARTS = [0, 8, 16, 30, 40];         // zinnen beginnen allemaal met een opmaat
export const BEATS_PER_MEASURE = 3;
export const PICKUP_POS = 2;                             // opmaat valt op tel 3 (index 2)

const PC = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,Bb:10,B:11};
const LETTER_STEP = {C:0,D:1,E:2,F:3,G:4,A:5,B:6};

// Kleuren per toonklasse (Boomwhacker-achtig) — identiek aan stickers.html.
export const STYLE = {
  0:{label:'C',  c:'#E53935', t:'#fff'},
  2:{label:'D',  c:'#EF6C00', t:'#fff'},
  4:{label:'E',  c:'#FDD835', t:'#222'},
  5:{label:'F',  c:'#43A047', t:'#fff'},
  7:{label:'G',  c:'#00ACC1', t:'#fff'},
  9:{label:'A',  c:'#7E57C2', t:'#fff'},
  10:{label:'Bes',c:'#F48FB1', t:'#222'},
  11:{label:'B', c:'#AD1457', t:'#fff'},
};

export function parseNote(s) {
  const m = s.match(/^([A-G])(b|#)?(\d)$/);
  const letter = m[1], key = letter + (m[2] || ''), oct = +m[3];
  return { key, midi: 12 * (oct + 1) + PC[key], pc: PC[key], step: (oct - 4) * 7 + LETTER_STEP[letter] };
}

let pos = PICKUP_POS;
export const notes = SONG.map(([n, beats, lyric], i) => {
  const o = { ...parseNote(n), i, beats, lyric, songBeat: pos - PICKUP_POS,
              measure: Math.floor(pos / BEATS_PER_MEASURE), inMeasure: pos % BEATS_PER_MEASURE };
  pos += beats;
  return o;
});
export const TOTAL_BEATS = pos - PICKUP_POS;
notes.forEach(n => n.line = LINES.findIndex(([a, b]) => n.measure >= a && n.measure <= b));

// Zinnen als [eerste, laatste] noot-index.
export const PHRASES = PHRASE_STARTS.map((s, k) => [s, (PHRASE_STARTS[k + 1] ?? notes.length) - 1]);

// Tel-label (1/2/3) van een songBeat.
export const countLabel = b => (((b + PICKUP_POS) % BEATS_PER_MEASURE) + BEATS_PER_MEASURE) % BEATS_PER_MEASURE + 1;
