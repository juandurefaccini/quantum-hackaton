// Laboratorio de cartas: compara 10 variantes de diseño de carta sobre el fondo
// animado, cada una con los mismos estados de ejemplo (super, |0>, |1>, acciones,
// boca abajo, jugable, seleccionada). No toca el motor: solo DOM + CSS.
import { startBackground } from './background.js';
import { createGlitch } from './glitch-texture.js';

const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === 'boolean') { if (k in node) node[k] = v; else if (v) node.setAttribute(k, ''); else node.removeAttribute(k); }
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};

const SYM = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4' };
const SUIT = { red: '♥', yellow: '♦', green: '♣', blue: '♠' };
const symOf = f => SYM[f.symbol] ?? f.symbol;
const suitOf = f => SUIT[f.color] ?? '★';
const colorCls = f => `color-${f.color ?? 'wild'}`;

// Paleta del diseño de cards/ (split diagonal + kets).
const QCOLOR = { red: 'qred', yellow: 'qyellow', green: 'qgreen', blue: 'qblue' };
const qcolor = f => QCOLOR[f.color] ?? 'qdark';

// La face lleva siempre los mismos nodos (num + esquinas + pip + pct). Las
// variantes UNO/poker los muestran u ocultan por CSS; las clásicas solo usan .num.
function faceEl(face, pct) {
  const rank = symOf(face);
  const suit = suitOf(face);
  const corner = side => el('span', { class: `corner ${side}` },
    el('span', { class: 'rk' }, rank), el('span', { class: 'st' }, suit));
  return el('div', { class: `face ${colorCls(face)}` },
    corner('tl'),
    el('span', { class: 'pip' }, suit),
    el('span', { class: 'num' }, rank),
    corner('br'),
    pct != null ? el('span', { class: 'pct' }, `${Math.round(pct * 100)}%`) : null);
}

// Carta del diseño de cards/: superpuesta = split diagonal con kets; definida = full-bg.
function qcardEl(id, spec) {
  const node = el('div', { class: `qcard qv${id}` });
  if (spec.facedown) {
    node.classList.add('facedown', 'back');
    return el('div', { class: 'spec-cell' }, node, el('span', { class: 'cap' }, spec.caption));
  }
  if (spec.outcomes) {
    const kets = ['|0⟩', '|1⟩'];
    const badge = i => el('span', { class: 'qket' }, kets[i],
      spec.pcts ? el('b', { class: 'qpct' }, `${Math.round(spec.pcts[i] * 100)}%`) : null);
    node.append(
      el('div', { class: `qh0 ${qcolor(spec.outcomes[0])}` }),
      el('div', { class: `qh1 ${qcolor(spec.outcomes[1])}` }),
      el('div', { class: 'qline' }),
      el('div', { class: 'qsymbols' },
        el('span', { class: 'qsym qsym-0' }, symOf(spec.outcomes[0])),
        el('span', { class: 'qsym qsym-1' }, symOf(spec.outcomes[1]))),
      el('div', { class: 'qcontent' },
        el('div', { class: 'qhead' }, badge(0)),
        el('div', { class: 'qfoot' }, badge(1))));
  } else {
    const f = spec.face;
    node.append(
      el('div', { class: `qfull ${qcolor(f)}` }),
      el('div', { class: 'qsymbols' }, el('span', { class: 'qsym qsym-center' }, symOf(f))),
      el('div', { class: 'qcontent' },
        el('div', { class: 'qhead' }, el('span', { class: 'qket' }, symOf(f))),
        el('div', { class: 'qfoot' }, el('span', { class: 'qket' }, symOf(f)))));
  }
  if (spec.playable) node.classList.add('playable');
  if (spec.selected) node.classList.add('selected');
  return el('div', { class: 'spec-cell' }, node, el('span', { class: 'cap' }, spec.caption));
}

// Carta DOM estándar (base del lab), sin el wrapper de celda.
function baseCardEl(id, spec) {
  const classes = ['card', `v${id}`, spec.kind === 'classic' ? 'k-classic' : 'k-qubit'];
  if (spec.outcomes) classes.push('super');
  if (spec.facedown) classes.push('facedown', 'back');
  if (spec.playable) classes.push('playable');
  if (spec.selected) classes.push('selected');
  const node = el('button', { type: 'button', class: classes.join(' ') });
  if (!spec.facedown) {
    if (spec.face) node.append(faceEl(spec.face, null));
    else node.append(faceEl(spec.outcomes[0], spec.pcts?.[0]), faceEl(spec.outcomes[1], spec.pcts?.[1]));
  }
  return node;
}

const cap = spec => el('span', { class: 'cap' }, spec.caption);

// Glitch activos del montaje (se frenan al desmontar).
const glitchStops = [];

// Un espécimen = una carta en cierto estado, con el DOM que usa cada diseño.
function specimenEl(variant, spec) {
  if (variant.design === 'qard') return qcardEl(variant.id, spec);
  if (variant.design === 'glitch') {
    // Superposición = DOS cartas con shader glitch; el resto = carta minimalista.
    if (spec.outcomes) {
      const g = createGlitch(spec.outcomes[0], spec.outcomes[1], { intensity: 1 });
      glitchStops.push(g.stop);
      g.el.classList.add('glitch-spec');
      return el('div', { class: 'spec-cell' }, g.el, cap(spec));
    }
    return el('div', { class: 'spec-cell' }, baseCardEl(9, spec), cap(spec));
  }
  return el('div', { class: 'spec-cell' }, baseCardEl(variant.id, spec), cap(spec));
}

// Estados de ejemplo: idénticos en todas las variantes para que la comparación sea justa.
const STATES = [
  { kind: 'qubit', outcomes: [{ color: 'red', symbol: '5' }, { color: 'blue', symbol: '2' }], pcts: [0.5, 0.5], caption: 'super 50/50' },
  { kind: 'qubit', outcomes: [{ color: 'green', symbol: '7' }, { color: 'yellow', symbol: '0' }], pcts: [0.7, 0.3], caption: 'super 70/30' },
  { kind: 'qubit', face: { color: 'red', symbol: '7' }, caption: 'colapsó |0⟩' },
  { kind: 'qubit', face: { color: 'blue', symbol: '1' }, caption: 'colapsó |1⟩' },
  { kind: 'classic', face: { color: 'yellow', symbol: 'skip' }, caption: 'salta' },
  { kind: 'classic', face: { color: 'green', symbol: 'draw2' }, caption: '+2' },
  { kind: 'classic', face: { color: null, symbol: 'wild4' }, caption: '+4' },
  { kind: 'classic', facedown: true, caption: 'boca abajo' },
  { kind: 'classic', face: { color: 'red', symbol: '3' }, playable: true, caption: 'jugable' },
  { kind: 'qubit', face: { color: 'green', symbol: '5' }, selected: true, caption: 'seleccionada' },
];

const VARIANTS = [
  // --- base / estética del probe ---
  { id: 1, family: 'base', name: 'Clásica', desc: 'Base actual: borde duro, esquina chica, sombra offset.' },
  { id: 2, family: 'base', name: 'Suave', desc: 'Sin borde, esquina grande, sombra difusa y gradiente sutil.' },
  { id: 3, family: 'base', name: 'Neón', desc: 'Fondo oscuro, marco y números con glow teal/color.' },
  { id: 4, family: 'base', name: 'Vidrio', desc: 'Translúcida con blur (backdrop-filter) y borde claro.' },
  { id: 5, family: 'base', name: 'Brutalista', desc: 'Borde grueso negro, esquinas rectas, sombra dura grande.' },
  { id: 6, family: 'base', name: 'Terminal', desc: 'Verde fósforo, scanlines, marco fino pixelado.' },
  { id: 7, family: 'base', name: 'Holográfica', desc: 'Marco con gradiente cónico tipo foil.' },
  { id: 8, family: 'base', name: 'Blueprint', desc: 'Fondo técnico azul con grilla y líneas cian.' },
  { id: 9, family: 'base', name: 'Minimal', desc: 'Plana sin borde; el color se indica con un punto.' },
  { id: 10, family: 'base', name: 'VFD retro', desc: 'Display ámbar con números incandescentes.' },
  // --- familia UNO ---
  { id: 11, family: 'UNO', name: 'UNO clásico', desc: 'Carta color pleno, óvalo blanco central, índice en las esquinas.' },
  { id: 12, family: 'UNO', name: 'UNO oscuro', desc: 'Base negra, medallón de color con número blanco.' },
  { id: 13, family: 'UNO', name: 'UNO plano', desc: 'Color pleno sin borde, número gigante centrado.' },
  // --- familia poker / naipe ---
  { id: 14, family: 'Poker', name: 'Naipe francés', desc: 'Blanca con índice rango+palo en las esquinas y palo grande al centro.' },
  { id: 15, family: 'Poker', name: 'Naipe oro', desc: 'Naipe negro con foil dorado y marca de agua del palo.' },
  { id: 16, family: 'Poker', name: 'Naipe suizo', desc: 'Minimal: índice grande arriba a la izquierda y mucho aire.' },
  // --- originales ---
  { id: 17, family: 'original', name: 'Metal líquido', desc: 'Cromo con reflejo diagonal y relieve grabado.' },
  { id: 18, family: 'original', name: 'Riso duotono', desc: 'Dos tintas con registro desplazado y textura de puntos.' },
  { id: 19, family: 'original', name: 'Arcade LED', desc: 'Fondo negro, marco magenta y dígitos cian con glow.' },
  { id: 20, family: 'original', name: 'Ticket', desc: 'Boleto troquelado: talón de color y línea perforada.' },
  // --- familia cards/ (split diagonal + kets, importado del último pull) ---
  { id: 21, family: 'cards', design: 'qard', name: 'Cards · diagonal', desc: 'El prototipo de cards/: superposición = split diagonal, kets |0⟩/|1⟩.' },
  { id: 22, family: 'cards', design: 'qard', name: 'Cards · vertical', desc: 'Split izquierda/derecha con costura vertical.' },
  { id: 23, family: 'cards', design: 'qard', name: 'Cards · horizontal', desc: 'Split arriba/abajo, como la superposición del juego.' },
  { id: 24, family: 'cards', design: 'qard', name: 'Cards · neón', desc: 'Base oscura, costura teal con glow y símbolos incandescentes.' },
  { id: 25, family: 'cards', design: 'qard', name: 'Cards · fundido', desc: 'Sin corte duro: las mitades se mezclan (superposición difusa).' },
  { id: 26, family: 'cards', design: 'qard', name: 'Cards · terminal', desc: 'Verde fósforo, scanlines y tipografía mono.' },
  { id: 27, family: 'cards', design: 'qard', name: 'Cards · blanca', desc: 'Tema claro con costura oscura.' },
  { id: 28, family: 'cards', design: 'qard', name: 'Cards · probabilidad', desc: 'Los kets muestran su probabilidad.' },
  // --- minimalista + superposición glitch ---
  { id: 29, family: 'glitch', design: 'glitch', name: 'Minimal + glitch', desc: 'Mazo minimalista; la superposición son DOS cartas con shader glitch (WebGL).' },
];

function entGroupDemo() {
  const group = el('div', { class: 'ent-group', title: 'Cartas entrelazadas: se miden juntas' },
    specimenEl({ id: 1 }, { kind: 'qubit', outcomes: [{ color: 'red', symbol: '5' }, { color: 'blue', symbol: '2' }], pcts: [0.5, 0.5], caption: 'grupo A' }),
    specimenEl({ id: 1 }, { kind: 'qubit', outcomes: [{ color: 'green', symbol: '7' }, { color: 'yellow', symbol: '0' }], pcts: [0.5, 0.5], caption: 'grupo A' }));
  return el('div', { class: 'spec-row' }, group);
}

function specBlock(v) {
  return el('section', { class: `spec spec-v${v.id}` },
    el('div', { class: 'spec-head' },
      el('span', { class: 'vtag' }, `v${v.id}`),
      el('div', { class: 'spec-copy' },
        el('div', { class: 'spec-name' }, el('strong', {}, v.name), el('span', { class: `fam fam-${v.family}` }, v.family)),
        el('p', { class: 'spec-desc' }, v.desc))),
    el('div', { class: 'spec-row' }, ...STATES.map(s => specimenEl(v, s))));
}

export function mount(root) {
  root.replaceChildren();
  glitchStops.length = 0;

  const bg = el('canvas', { class: 'bg', width: 320, height: 180 });
  let stopBg = () => {};
  try { stopBg = startBackground(bg) || (() => {}); } catch { /* sin WebGL */ }
  const crt = el('div', { class: 'crt' });

  const bgCb = el('input', { type: 'checkbox' });
  bgCb.checked = true;
  bgCb.addEventListener('change', () => { bg.style.display = bgCb.checked ? '' : 'none'; });
  const crtCb = el('input', { type: 'checkbox' });
  crtCb.checked = true;
  crtCb.addEventListener('change', () => { crt.style.display = crtCb.checked ? '' : 'none'; });

  // Prueba: superposición como dos cartas solapadas + shader glitch.
  let glitchStop = () => {};
  function glitchProof() {
    const faceA = { color: 'red', symbol: '5' };
    const faceB = { color: 'blue', symbol: '2' };
    const glitch = createGlitch(faceA, faceB, { intensity: 1 });
    glitchStop = glitch.stop;

    const amt = el('input', { type: 'range', min: '0', max: '2', step: '0.1', value: '1' });
    amt.addEventListener('input', () => glitch.setIntensity(Number(amt.value)));
    const pause = el('input', { type: 'checkbox' });
    pause.addEventListener('change', () => glitch.setPaused(pause.checked));

    return el('section', { class: 'spec spec-glitch' },
      el('div', { class: 'spec-head' },
        el('span', { class: 'vtag' }, '◑'),
        el('div', { class: 'spec-copy' },
          el('div', { class: 'spec-name' }, el('strong', {}, 'Prueba · superposición glitch'), el('span', { class: 'fam fam-glitch' }, 'shader')),
          el('p', { class: 'spec-desc' }, 'La superposición como DOS cartas solapadas, con shader WebGL (RGB split + slices por bandas).'))),
      el('div', { class: 'glitch-row' },
        glitch.el,
        el('div', { class: 'glitch-controls' },
          el('label', { class: 'toggle' }, pause, 'Pausa'),
          el('label', { class: 'glitch-amt' }, el('span', {}, 'Intensidad'), amt))));
  }

  const app = el('div', { class: 'lab' },
    el('header', { class: 'lab-head' },
      el('div', { class: 'lab-title' },
        el('h1', {}, 'Laboratorio de cartas'),
        el('p', { class: 'lab-sub' }, `${VARIANTS.length} variantes × estados de ejemplo, sobre el fondo animado.`)),
      el('div', { class: 'lab-controls' },
        el('label', { class: 'toggle' }, bgCb, 'Fondo'),
        el('label', { class: 'toggle' }, crtCb, 'CRT'),
        el('a', { class: 'ghost link', href: './dev.html' }, '← Juego'))),
    el('section', { class: 'spec spec-ent' },
      el('div', { class: 'spec-head' },
        el('span', { class: 'vtag' }, '⚛'),
        el('div', { class: 'spec-copy' }, el('strong', {}, 'Grupo entrelazado'), el('p', { class: 'spec-desc' }, 'Contenedor .ent-group, igual en todas las variantes.'))),
      entGroupDemo()),
    glitchProof(),
    el('div', { class: 'lab-grid' }, ...VARIANTS.map(specBlock)));

  root.append(bg, crt, app);
  return () => { stopBg(); glitchStop(); glitchStops.forEach(fn => fn()); };
}
