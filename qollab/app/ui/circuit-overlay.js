// Pantalla superpuesta con el circuito de una carta cuántica (estilo Quirk, con los colores del juego).
//   [ etiquetas ] [ puertas aplicadas (scroll horizontal) ] | [ chance de |0⟩ · Bloch · amplitudes ] (fijo a la derecha)
// Cada fila es un qubit. Todos los colores salen de variables CSS (bloque `.circuit-overlay`).
// Las lecturas salen de simular() (puertas h, x, z, ry, cx). Si se pasa opts.probs (las del motor), se
// contrastan contra la simulación y se avisa por consola si no coinciden.

const STYLE_ID = 'quards-circuit-overlay-styles';
const SVGNS = 'http://www.w3.org/2000/svg';

const CSS = `
  .circuit-overlay {
    /* --- paleta (usa las variables de main.css; las puertas repiten los colores de circuit.js) --- */
    --co-ink: var(--ink);
    --co-muted: var(--muted);
    --co-edge: var(--edge);
    --co-gold: var(--gold);
    --co-wire: rgba(244, 237, 224, 0.42);
    --co-gate-h: #156b52;
    --co-gate-x: #7a2b22;
    --co-gate-z: #2b3a7a;
    --co-gate-ry: #4a3b6b;
    --co-gate-sup: #5a2f7a;
    --co-gate-other: #2a2723;
    --co-cnot: var(--gold);
    --co-chance: var(--teal);
    --co-bloch: var(--gold);
    --co-amp: var(--teal);
    --co-amp-neg: var(--red);
    --co-box: #1d1a17;
    --co-play: #3a7bd5;
    --co-play-hover: #4d8de6;
    /* --- medidas --- */
    --row: 76px;
    --col: 84px;

    position: fixed; inset: 0; z-index: 80; display: none; align-items: center; justify-content: center;
    padding: 4vh 4vw; background: rgba(8, 7, 6, 0.88);
  }
  .circuit-overlay.open { display: flex; }
  .co-panel {
    width: min(1500px, 100%); max-height: 100%; display: flex; flex-direction: column;
    background: rgba(12, 11, 10, 0.97); border: 2px solid var(--co-edge);
    box-shadow: 4px 4px 0 var(--co-edge), 0 0 28px rgba(34, 179, 160, 0.28);
  }
  .co-head { padding: 14px 20px 0; }
  .co-head h2 { margin: 0; font-size: 18px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--teal); }
  .co-head p { margin: 6px 0 0; font-size: 12px; color: var(--co-muted); }

  .co-body { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; }
  .co-stage { display: flex; align-items: flex-start; gap: 16px; min-width: 620px; padding: 18px 20px;
    background: rgba(0, 0, 0, 0.35); border: 2px solid var(--co-edge); }

  .co-row { height: var(--row); display: flex; align-items: center; justify-content: center; }

  /* etiquetas de los qubits */
  .co-labels { flex: none; }
  .co-q { justify-content: flex-start; min-width: 52px; gap: 6px; font-weight: 700; font-size: 20px; color: var(--co-ink); white-space: nowrap; }
  .co-q small { font-size: 11px; font-weight: 400; color: var(--co-muted); }
  .co-q.mine { color: var(--co-gold); }

  /* puertas (scroll horizontal) */
  .co-scroll { flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; scrollbar-color: var(--co-gold) var(--co-box); }
  .co-cols { display: flex; width: max-content; min-width: 100%; }
  .co-col { position: relative; flex: 0 0 var(--col); width: var(--col); }
  .co-col.rest { flex: 1 1 0; width: auto; min-width: 12px; }
  .co-cell { position: relative; height: var(--row); display: flex; align-items: center; justify-content: center; }
  .co-cell::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px; background: var(--co-wire); }
  .co-cell > * { position: relative; z-index: 2; }

  .co-gate { min-width: 54px; height: 54px; padding: 0 8px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--co-gate-other); color: var(--co-ink); border: 2px solid var(--co-edge); box-shadow: 3px 3px 0 var(--co-edge);
    font-weight: 700; font-size: 20px; line-height: 1; }
  .co-gate small { margin-top: 3px; font-size: 10px; font-weight: 400; opacity: 0.85; }
  .co-gate.g-h { background: var(--co-gate-h); }
  .co-gate.g-x { background: var(--co-gate-x); }
  .co-gate.g-z { background: var(--co-gate-z); }
  .co-gate.g-ry { background: var(--co-gate-ry); }
  .co-gate.g-sup { background: var(--co-gate-sup); }
  .co-gate.meter { background: #16130f; border-color: var(--co-gold); color: var(--co-gold); }
  .co-ctrl { width: 14px; height: 14px; border-radius: 50%; background: var(--co-cnot); border: 2px solid var(--co-edge); }
  .co-tgt { width: 34px; height: 34px; border-radius: 50%; background: #0d1117; border: 2px solid var(--co-cnot); color: var(--co-cnot);
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; line-height: 1; }
  .co-link { position: absolute; left: 50%; width: 2px; margin-left: -1px; background: var(--co-cnot); z-index: 1; }

  /* lecturas: siempre fijas a la derecha */
  .co-fixed { flex: none; display: grid; grid-template-columns: auto auto; column-gap: 22px; row-gap: 10px;
    padding-left: 20px; border-left: 2px solid rgba(255, 255, 255, 0.18); }
  .co-locals { display: flex; gap: 10px; }
  .co-chance { position: relative; width: 60px; height: 58px; background: var(--co-box); border: 2px solid var(--co-edge); overflow: hidden;
    display: flex; align-items: center; justify-content: center; }
  .co-chance i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--co-chance); opacity: 0.8; }
  .co-chance span { position: relative; font-size: 13px; font-weight: 700; text-shadow: 1px 1px 0 var(--co-edge); }
  .co-bloch { width: 64px; height: 64px; }

  .co-amps { display: flex; gap: 8px; align-items: flex-start; }
  .co-amp-grid { display: grid; gap: 6px; }
  .co-amp-rows { display: flex; flex-direction: column; gap: 6px; }
  .co-amp-rows span { height: calc(var(--row) - 6px); display: flex; align-items: center; font-size: 12px; color: var(--co-muted); }
  .co-amp { position: relative; width: 62px; height: calc(var(--row) - 6px); background: var(--co-box); border: 2px solid var(--co-edge); overflow: hidden; }
  .co-amp i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--co-amp); opacity: 0.55; }
  .co-amp.neg i { background: var(--co-amp-neg); }
  .co-amp svg { position: absolute; left: 50%; top: 50%; width: 36px; height: 36px; margin: -18px 0 0 -18px; }
  .co-amp .k { position: absolute; right: 3px; bottom: 2px; font-size: 10px; color: var(--co-muted); }
  .co-amp .p { position: absolute; left: 3px; top: 2px; font-size: 10px; color: var(--co-ink); }

  .co-cap { font-size: 11px; line-height: 1.3; text-align: center; color: var(--co-muted); }
  .co-cap.amps { color: var(--teal); font-weight: 700; }

  .co-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-top: 2px solid var(--co-edge); }
  .co-btn { padding: 10px 28px; font-size: 15px; font-weight: 700; }
  .circuit-overlay .co-back { background: #1a1816; border-color: #3a342b; }
  .circuit-overlay .co-back:hover { background: #26221e; }
  .circuit-overlay .co-play { background: var(--co-play); }
  .circuit-overlay .co-play:hover:not(:disabled) { background: var(--co-play-hover); }
  .co-btn:focus-visible { outline: 3px solid var(--co-gold); outline-offset: 2px; }
`;

let root = null;
let onKey = null;

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/* ---------- simulación (amplitudes reales: las puertas h, x, z, ry y cx lo son) ---------- */

export function simular(group) {
  const n = group.qubits;
  const N = 1 << n;
  const a = new Float64Array(N);
  a[0] = 1;

  const one = (q, m) => {
    for (let i = 0; i < N; i++) {
      if ((i >> q) & 1) continue;
      const j = i | (1 << q);
      const x = a[i], y = a[j];
      a[i] = m[0] * x + m[1] * y;
      a[j] = m[2] * x + m[3] * y;
    }
  };
  const S = Math.SQRT1_2;
  for (const [gate, ...args] of group.ops || []) {
    if (gate === 'h' || gate === 'sup') one(args[0], [S, S, S, -S]);
    else if (gate === 'x') one(args[0], [0, 1, 1, 0]);
    else if (gate === 'z') one(args[0], [1, 0, 0, -1]);
    else if (gate === 'ry') { const c = Math.cos(args[0] / 2), s = Math.sin(args[0] / 2); one(args[1], [c, -s, s, c]); }
    else if (gate === 'cx') {
      const [c, t] = args;
      for (let i = 0; i < N; i++) {
        if (((i >> c) & 1) && !((i >> t) & 1)) { const j = i | (1 << t); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
      }
    } else console.warn(`circuit-overlay: puerta no simulada "${gate}"`);
  }

  // Qubits ya medidos: se descartan los estados incompatibles y se renormaliza.
  const bits = group.bits || [];
  let mask = 0, val = 0;
  for (let q = 0; q < n; q++) if (bits[q] === 0 || bits[q] === 1) { mask |= 1 << q; if (bits[q]) val |= 1 << q; }
  if (mask) {
    let norm = 0;
    for (let i = 0; i < N; i++) { if ((i & mask) !== val) a[i] = 0; else norm += a[i] * a[i]; }
    if (norm > 1e-12) { const k = 1 / Math.sqrt(norm); for (let i = 0; i < N; i++) a[i] *= k; }
  }

  const p0 = [], bloch = [];
  for (let q = 0; q < n; q++) {
    let q0 = 0, rho01 = 0;
    for (let i = 0; i < N; i++) {
      if ((i >> q) & 1) continue;
      q0 += a[i] * a[i];
      rho01 += a[i] * a[i | (1 << q)];
    }
    p0.push(q0);
    bloch.push({ x: 2 * rho01, z: 2 * q0 - 1 }); // y = 0: todas las amplitudes son reales
  }
  return { amp: Array.from(a), p0, bloch };
}

// Distribución de las amplitudes en una grilla: las primeras floor(n/2) qubits van en filas y el resto en columnas.
// Las etiquetas siguen el orden de los qubits ("0_" = q0 en 0; "_1" = q1 en 1).
export function grillaAmplitudes(n) {
  const a = Math.floor(n / 2), b = n - a;
  const idx = (r, c) => {
    let i = 0;
    for (let j = 0; j < a; j++) if ((r >> (a - 1 - j)) & 1) i |= 1 << j;
    for (let j = 0; j < b; j++) if ((c >> (b - 1 - j)) & 1) i |= 1 << (a + j);
    return i;
  };
  return {
    R: 1 << a, C: 1 << b, a, idx,
    rowLabel: r => r.toString(2).padStart(a, '0') + '_'.repeat(b),
    colLabel: c => '_'.repeat(a) + c.toString(2).padStart(b, '0'),
  };
}

/* ---------- dibujo ---------- */

const span = op => {
  const [gate, ...a] = op;
  if (gate === 'cx') return [Math.min(a[0], a[1]), Math.max(a[0], a[1])];
  const q = gate === 'ry' ? a[1] : a[0];
  return [q, q];
};

// Cada operación va en la primera columna libre después de la última que choca con sus qubits.
function columnas(ops) {
  const cols = [];
  for (const op of ops) {
    const [lo, hi] = span(op);
    let idx = cols.length;
    for (let c = cols.length - 1; c >= 0; c--) {
      let choca = false;
      for (let q = lo; q <= hi; q++) if (cols[c].usados[q]) { choca = true; break; }
      if (choca) break;
      idx = c;
    }
    if (idx === cols.length) cols.push({ usados: {}, ops: [] });
    cols[idx].ops.push(op);
    for (let q = lo; q <= hi; q++) cols[idx].usados[q] = true;
  }
  return cols;
}

const fmtPi = t => `${+(t / Math.PI).toFixed(2)}π`;

function gateEl(gate, theta) {
  const g = h('div', `co-gate g-${gate}`, gate === 'ry' ? 'Ry' : gate.toUpperCase());
  if (gate === 'ry' && typeof theta === 'number') g.append(h('small', '', fmtPi(theta)));
  return g;
}

function dibujarCircuito(group, n) {
  const scroll = h('div', 'co-scroll');
  const cols = h('div', 'co-cols');

  const nuevaColumna = cls => {
    const col = h('div', cls || 'co-col');
    const cells = [];
    for (let q = 0; q < n; q++) { const c = h('div', 'co-cell'); cells.push(c); col.append(c); }
    return { col, cells };
  };

  for (const { ops } of columnas(group.ops || [])) {
    const { col, cells } = nuevaColumna();
    for (const op of ops) {
      const [gate, ...a] = op;
      if (gate === 'cx') {
        const [c, t] = a;
        cells[c].append(h('div', 'co-ctrl'));
        cells[t].append(h('div', 'co-tgt', '⊕'));
        const link = h('div', 'co-link');
        link.style.top = `calc(${Math.min(c, t)} * var(--row) + var(--row) / 2)`;
        link.style.height = `calc(${Math.abs(c - t)} * var(--row))`;
        col.append(link);
      } else if (gate === 'ry') cells[a[1]].append(gateEl('ry', a[0]));
      else cells[a[0]].append(gateEl(gate));
    }
    cols.append(col);
  }

  // Medición al final (con el bit que salió, si el grupo ya colapsó).
  const { col, cells } = nuevaColumna();
  for (let q = 0; q < n; q++) {
    const bit = group.bits?.[q];
    const m = h('div', 'co-gate meter', bit === 0 || bit === 1 ? String(bit) : 'M');
    m.title = 'Medición';
    cells[q].append(m);
  }
  cols.append(col);
  cols.append(nuevaColumna('co-col rest').col); // los cables llegan hasta la zona fija

  scroll.append(cols);
  // La rueda del mouse desplaza en horizontal cuando hay overflow.
  scroll.addEventListener('wheel', e => {
    if (scroll.scrollWidth <= scroll.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    scroll.scrollLeft += e.deltaY;
  }, { passive: false });
  return scroll;
}

function dibujarBloch(canvas, v) {
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(canvas);
  const wire = css.getPropertyValue('--co-wire').trim() || '#888';
  const vec = css.getPropertyValue('--co-bloch').trim() || '#e6b23a';
  const s = canvas.width, c = s / 2, r = s * 0.42, E = 0.3; // E = achatamiento del ecuador
  // x a la derecha, z arriba (y, hacia el observador, vale 0 porque las amplitudes son reales).
  ctx.clearRect(0, 0, s, s);
  ctx.lineWidth = 2;
  ctx.strokeStyle = wire;
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(c, c, r, r * E, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c, c - r); ctx.lineTo(c, c + r); ctx.moveTo(c - r, c); ctx.lineTo(c + r, c); ctx.stroke();
  const tx = c + r * v.x, ty = c - r * v.z;
  ctx.strokeStyle = vec; ctx.fillStyle = vec; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, Math.PI * 2); ctx.fill();
}

// Dial de una amplitud real: la línea sale del centro hacia la derecha (positiva) o la izquierda (negativa).
function dialAmplitud(a) {
  const el = svg('svg', { viewBox: '0 0 36 36' });
  el.append(svg('circle', { cx: 18, cy: 18, r: 15, fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(244,237,224,0.45)', 'stroke-width': 1.5 }));
  const len = 15 * Math.min(1, Math.abs(a));
  const col = a < -1e-9 ? 'var(--co-amp-neg)' : 'var(--co-ink)';
  if (len > 0.5) el.append(svg('line', { x1: 18, y1: 18, x2: 18 + Math.sign(a) * len, y2: 18, stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  el.append(svg('circle', { cx: 18, cy: 18, r: 2, fill: col }));
  return el;
}

function ensure() {
  if (root) return;
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.append(s);
  }
  root = h('div', 'circuit-overlay');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Circuito de la carta');
  root.addEventListener('click', e => { if (e.target === root) hideCircuitOverlay(); });
  document.body.append(root);
}

// group: grupo del estado ({ qubits, ops, bits, cards }).
// opts: { cardQubit, probs (opcional, del motor: [[p0,p1],...]), canPlay, onPlay }
export function showCircuitOverlay(group, opts = {}) {
  ensure();
  const { cardQubit = null, probs = null, canPlay = false, onPlay } = opts;
  const n = group.qubits;
  const sim = simular(group);
  const entangled = (group.cards?.length ?? 1) > 1;

  if (probs) {
    sim.p0.forEach((p, q) => {
      const e = probs[q]?.[0];
      if (typeof e === 'number' && Math.abs(e - p) > 0.02) {
        console.warn(`circuit-overlay: q${q} P(0) motor=${e.toFixed(3)} vs simulación=${p.toFixed(3)}`);
      }
    });
  }

  const head = h('div', 'co-head');
  head.append(
    h('h2', '', 'Circuito de la carta'),
    h('p', '', entangled ? 'Esta carta está entrelazada: sus qubits se miden juntos.' : 'Una fila por qubit; las puertas se leen de izquierda a derecha.'),
  );

  // --- etiquetas (izquierda) ---
  const labels = h('div', 'co-labels');
  for (let q = 0; q < n; q++) {
    const lab = h('div', `co-row co-q${q === cardQubit ? ' mine' : ''}`, '|0⟩');
    lab.append(h('small', '', `q${q}`));
    if (q === cardQubit) lab.title = 'Esta carta';
    labels.append(lab);
  }

  // --- lecturas fijas (derecha): chance de |0⟩, Bloch, amplitudes ---
  const colChance = h('div'), colBloch = h('div');
  const blochs = [];
  for (let q = 0; q < n; q++) {
    const pct = Math.round(sim.p0[q] * 1000) / 10;
    const box = h('div', 'co-chance');
    const fill = h('i');
    fill.style.height = `${pct}%`;
    box.append(fill, h('span', '', `${pct.toFixed(1)}%`));
    box.title = `q${q}: probabilidad de medir |0⟩`;
    const rc = h('div', 'co-row'); rc.append(box); colChance.append(rc);

    const cv = h('canvas', 'co-bloch');
    cv.width = 128; cv.height = 128;
    blochs.push([cv, sim.bloch[q]]);
    const rb = h('div', 'co-row'); rb.append(cv); colBloch.append(rb);
  }
  const locals = h('div', 'co-locals');
  locals.append(colChance, colBloch);

  const g = grillaAmplitudes(n);
  const grid = h('div', 'co-amp-grid');
  grid.style.gridTemplateColumns = `repeat(${g.C}, 62px)`;
  for (let r = 0; r < g.R; r++) {
    for (let c = 0; c < g.C; c++) {
      const i = g.idx(r, c);
      const a = sim.amp[i];
      const p = a * a;
      const box = h('div', `co-amp${a < -1e-9 ? ' neg' : ''}`);
      const fill = h('i');
      fill.style.height = `${(p * 100).toFixed(1)}%`;
      const txt = Math.abs(a) < 5e-4 ? '0' : `${a < 0 ? '−' : '+'}${Math.abs(a).toFixed(3)}`;
      box.append(fill, dialAmplitud(a), h('span', 'p', `${Math.round(p * 1000) / 10}%`), h('span', 'k', g.colLabel(c)));
      box.title = `|${i.toString(2).padStart(n, '0')}⟩ (q${n - 1}…q0) · amplitud ${txt} · probabilidad ${(p * 100).toFixed(1)}%`;
      grid.append(box);
    }
  }
  const amps = h('div', 'co-amps');
  amps.append(grid);
  if (g.a > 0) {
    const rows = h('div', 'co-amp-rows');
    for (let r = 0; r < g.R; r++) rows.append(h('span', '', g.rowLabel(r)));
    amps.append(rows);
  }

  const fixed = h('div', 'co-fixed');
  fixed.append(locals, amps,
    h('div', 'co-cap', 'Estado local por qubit\n(Chance de |0⟩ / Bloch)'),
    h('div', 'co-cap amps', 'Amplitudes finales'));
  fixed.querySelector('.co-cap').style.whiteSpace = 'pre-line';

  const stage = h('div', 'co-stage');
  stage.append(labels, dibujarCircuito(group, n), fixed);
  const body = h('div', 'co-body');
  body.append(stage);

  const back = h('button', 'co-btn co-back', 'Volver');
  back.type = 'button';
  back.addEventListener('click', hideCircuitOverlay);

  const play = h('button', 'co-btn co-play', 'Jugar');
  play.type = 'button';
  play.disabled = !canPlay;
  if (!canPlay) play.title = 'Esta carta no se puede jugar ahora';
  play.addEventListener('click', () => { hideCircuitOverlay(); onPlay?.(); });

  const bar = h('div', 'co-bar');
  bar.append(back, play);

  const panel = h('div', 'co-panel');
  panel.append(head, body, bar);
  root.replaceChildren(panel);
  root.classList.add('open');
  blochs.forEach(([cv, v]) => dibujarBloch(cv, v)); // después de insertar: lee los colores del CSS

  if (onKey) document.removeEventListener('keydown', onKey);
  onKey = e => { if (e.key === 'Escape') hideCircuitOverlay(); };
  document.addEventListener('keydown', onKey);
  (canPlay ? play : back).focus();
}

export function hideCircuitOverlay() {
  if (!root) return;
  root.classList.remove('open');
  root.replaceChildren();
  if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
}
