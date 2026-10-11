// CIRCUITO CUÁNTICO (SVG) + tooltip on-hover.
// Dibuja el circuito del grupo de una carta: una fila por qubit y una columna por
// operación. Soporta la preparación ry(theta), las puertas de un qubit h/x/z y el
// cx (control → target). Si el grupo ya colapsó, agrega la columna de medición con
// el bit que salió. Se usa al pasar el mouse por una carta cuántica.

const SVGNS = 'http://www.w3.org/2000/svg';

const COL = 36;   // ancho de una columna (operación)
const ROW = 30;   // alto de una fila (qubit)
const PAD_T = 12;
const PAD_B = 12;
const PAD_L = 34; // deja lugar para las etiquetas q0, q1 y el inicio del cable
const PAD_R = 16;
const BOX = { w: 26, h: 22, r: 4 };

// Color de la caja por puerta (mismo lenguaje que los chips de puertas).
const GATE_FILL = { h: '#156b52', x: '#7a2b22', z: '#2b3a7a', ry: '#4a3b6b' };
const GATE_LABEL = { h: 'H', x: 'X', z: 'Z', ry: 'Ry' };

function node(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  for (const kid of kids) if (kid) n.append(kid);
  return n;
}

const text = value => document.createTextNode(value);

function gateBox(xc, yc, label, fill) {
  const g = node('g');
  g.append(node('rect', {
    x: xc - BOX.w / 2, y: yc - BOX.h / 2, width: BOX.w, height: BOX.h, rx: BOX.r,
    fill, stroke: '#0b0a09', 'stroke-width': 2,
  }));
  g.append(node('text', { x: xc, y: yc + 4, class: 'qc-gate-txt' }, text(label)));
  return g;
}

function cnotGate(xc, yControl, yTarget) {
  const g = node('g');
  g.append(node('line', { x1: xc, y1: yControl, x2: xc, y2: yTarget, class: 'qc-wire-gate' }));
  g.append(node('circle', { cx: xc, cy: yControl, r: 3.2, fill: '#e6b23a', stroke: '#0b0a09', 'stroke-width': 1.5 }));
  g.append(node('circle', { cx: xc, cy: yTarget, r: 8, fill: '#0d1117', stroke: '#e6b23a', 'stroke-width': 2 }));
  g.append(node('line', { x1: xc - 8, y1: yTarget, x2: xc + 8, y2: yTarget, stroke: '#e6b23a', 'stroke-width': 2 }));
  g.append(node('line', { x1: xc, y1: yTarget - 8, x2: xc, y2: yTarget + 8, stroke: '#e6b23a', 'stroke-width': 2 }));
  return g;
}

function meterBox(xc, yc) {
  const g = node('g');
  g.append(node('rect', {
    x: xc - BOX.w / 2, y: yc - BOX.h / 2, width: BOX.w, height: BOX.h, rx: BOX.r,
    fill: '#16130f', stroke: '#e6b23a', 'stroke-width': 2,
  }));
  g.append(node('path', {
    d: `M ${xc - 7} ${yc + 4} A 7 7 0 0 1 ${xc + 7} ${yc + 4}`,
    fill: 'none', stroke: '#e6b23a', 'stroke-width': 1.5,
  }));
  g.append(node('line', { x1: xc, y1: yc + 4, x2: xc + 5, y2: yc - 3, stroke: '#e6b23a', 'stroke-width': 1.5 }));
  return g;
}

// Dibuja el circuito del grupo. opts: { measured, bits, meter }.
export function circuitSVG(group, opts = {}) {
  const qubits = group.qubits;
  const ops = group.ops || [];
  const measured = !!opts.measured;
  const bits = opts.bits || null;
  const showMeter = opts.meter !== false;

  const cols = ops.length + (showMeter ? 1 : 0);
  const width = PAD_L + Math.max(cols, 1) * COL + PAD_R + (measured ? 16 : 0);
  const height = PAD_T + qubits * ROW + PAD_B;

  const cx = c => PAD_L + c * COL + COL / 2;
  const cy = q => PAD_T + q * ROW + ROW / 2;

  const root = node('svg', {
    xmlns: SVGNS, viewBox: `0 0 ${width} ${height}`, width, height, class: 'qc-svg',
    role: 'img',
    'aria-label': `Circuito de ${qubits} qubit${qubits > 1 ? 's' : ''} con ${ops.length} operación${ops.length === 1 ? '' : 'es'}`,
  });
  const g = node('g');

  for (let q = 0; q < qubits; q++) {
    const y = cy(q);
    g.append(node('text', { x: 6, y: y + 4, class: 'qc-label' }, text(`q${q}`)));
    g.append(node('line', { x1: PAD_L - 12, y1: y, x2: width - 8, y2: y, class: 'qc-wire' }));
  }

  ops.forEach((op, c) => {
    const [gate, ...a] = op;
    const xc = cx(c);
    if (gate === 'cx') g.append(cnotGate(xc, cy(a[0]), cy(a[1])));
    else if (gate === 'ry') g.append(gateBox(xc, cy(a[1]), GATE_LABEL.ry, GATE_FILL.ry));
    else if (GATE_LABEL[gate]) g.append(gateBox(xc, cy(a[0]), GATE_LABEL[gate], GATE_FILL[gate]));
  });

  if (showMeter) {
    const mc = ops.length;
    const xc = cx(mc);
    for (let q = 0; q < qubits; q++) g.append(meterBox(xc, cy(q)));
    if (measured) {
      for (let q = 0; q < qubits; q++) {
        g.append(node('text', {
          x: xc + BOX.w / 2 + 7, y: cy(q) + 4, class: 'qc-bit',
        }, text(String(bits?.[q] ?? '?'))));
      }
    }
  }

  root.append(g);
  return root;
}

// --- tooltip on-hover (singleton) ---
let tipEl = null;

export function hideCircuitTip() {
  if (!tipEl) return;
  tipEl.remove();
  tipEl = null;
}

function positionTip(tip, anchor) {
  const a = anchor.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const margin = 10;
  let top = a.top - t.height - margin;
  let below = false;
  if (top < 6) { top = a.bottom + margin; below = true; }
  let left = a.left + a.width / 2 - t.width / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - t.width - 6));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.classList.toggle('below', below);
  const caretX = Math.max(14, Math.min(a.left + a.width / 2 - left, t.width - 14));
  tip.style.setProperty('--caret-x', `${Math.round(caretX)}px`);
}

export function showCircuitTip(anchor, group, opts = {}) {
  if (!anchor || !group || !group.ops) return;
  hideCircuitTip();
  const tip = document.createElement('div');
  tip.className = 'circuit-tip';
  tip.style.visibility = 'hidden';
  const label = document.createElement('span');
  label.className = 'circuit-tip-label';
  label.textContent = group.collapsed ? 'Circuito colapsado' : 'Circuito cuántico';
  tip.append(circuitSVG(group, { measured: group.collapsed, bits: group.bits, ...opts }), label);
  document.body.append(tip);
  positionTip(tip, anchor);
  tip.style.visibility = '';
  tipEl = tip;
}
