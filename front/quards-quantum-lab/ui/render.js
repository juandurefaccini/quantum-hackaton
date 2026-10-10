// Quards · Quantum Lab — a probe that exercises the primitives the game will
// need: a general 1-3 qubit statevector, single-qubit gates, CNOT, Bell/GHZ
// entanglement, measurement through the collapse adapter, and the rich look.
import { allStates } from '../collapse/pool.js';
import { loadSource } from '../collapse/source.js';
import { stateFromOps, probabilities } from '../quantum/statevector.js';
import { startBackground } from './background.js';
import * as audio from './audio.js';
import { log, warn } from './debug.js';

const STEPS = 6;
const PALETTE = ['h', 'x', 'y', 'z', 's', 'sdg', 't', 'cx'];
const GLYPH = { '': '·', h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', sdg: 'S†', t: 'T', cx: 'CX' };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const emptyGrid = (n, steps) => Array.from({ length: n }, () => Array(steps).fill(''));

export async function mount(root) {
  audio.armAudio();
  root.replaceChildren();

  const bg = el('canvas', { class: 'bg', width: 320, height: 180 });
  const crt = el('div', { class: 'crt' });
  try {
    startBackground(bg);
    log('fondo WebGL iniciado');
  } catch (error) {
    warn(`fondo WebGL no disponible: ${error && error.message ? error.message : error}`);
  }

  log('cargando adaptador de medición…');
  const source = await loadSource();
  log(`adaptador: ${source.kind || 'desconocido'}`);

  const state = {
    qubits: 2, grid: emptyGrid(2, STEPS), shots: 200,
    brush: 'h', eraser: false, busy: false,
    result: null, ideal: null, sourceLabel: '—',
  };

  const badgeEl = el('span', { class: 'badge' }, 'fuente: —');
  const paletteEl = el('div', { class: 'palette' });
  const circuitEl = el('div', { class: 'circuit' });
  const statusEl = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' }, 'Listo.');
  const plotEl = el('div', { class: 'plot' });
  const ampsEl = el('div', { class: 'amps' });
  const qubitsSel = el('select', {}, [1, 2, 3].map(n => el('option', { value: n }, `${n} qubit${n > 1 ? 's' : ''}`)));
  qubitsSel.value = '2';
  const shotsInput = el('input', { type: 'number', min: 1, max: 4096, value: 200 });
  const runBtn = el('button', { class: 'run' }, 'Medir (collapse)');
  const clearBtn = el('button', { class: 'ghost' }, 'Limpiar');

  const setStatus = text => { statusEl.textContent = text; console.log(text); };

  function updateIdeal() {
    const ops = opsFromGrid();
    state.ideal = probabilities(stateFromOps(state.qubits, ops));
  }

  function opsFromGrid() {
    const ops = [];
    for (let c = 0; c < STEPS; c++) {
      for (let r = 0; r < state.qubits; r++) {
        const gate = state.grid[r][c];
        if (!gate) continue;
        if (gate === 'cx') {
          if (r < state.qubits - 1) ops.push({ gate: 'cx', control: r, target: r + 1 });
        } else {
          ops.push({ gate, target: r });
        }
      }
    }
    return ops;
  }

  function setCell(r, c) {
    if (state.eraser) state.grid[r][c] = '';
    else if (state.brush === 'cx') {
      if (r >= state.qubits - 1) { setStatus('CX necesita un qubit por debajo.'); audio.tick(); return; }
      state.grid[r][c] = state.grid[r][c] === 'cx' ? '' : 'cx';
    } else {
      state.grid[r][c] = state.grid[r][c] === state.brush ? '' : state.brush;
    }
    audio.blip();
    state.result = null;
    updateIdeal();
    renderCircuit();
    renderResults();
  }

  function renderCircuit() {
    circuitEl.replaceChildren();
    for (let r = 0; r < state.qubits; r++) {
      const row = el('div', { class: 'qrow' });
      row.append(el('span', { class: 'qlabel' }, `q${r}`));
      for (let c = 0; c < STEPS; c++) {
        const gate = state.grid[r][c];
        const cell = el('button', {
          type: 'button',
          class: `cell${gate === 'cx' ? ' cx' : ''}${gate ? ' filled' : ''}`,
          title: gate ? GLYPH[gate] : 'vacío',
          onclick: () => setCell(r, c),
        }, GLYPH[gate] || '·');
        row.append(cell);
      }
      circuitEl.append(row);
    }
  }

  function renderPalette() {
    paletteEl.replaceChildren();
    for (const gate of PALETTE) {
      const active = !state.eraser && state.brush === gate;
      paletteEl.append(el('button', {
        type: 'button',
        class: `chip${active ? ' active' : ''}`,
        onclick: () => { state.brush = gate; state.eraser = false; audio.tick(); renderPalette(); },
      }, GLYPH[gate]));
    }
    paletteEl.append(el('button', {
      type: 'button',
      class: `chip eraser${state.eraser ? ' active' : ''}`,
      onclick: () => { state.eraser = !state.eraser; audio.tick(); renderPalette(); },
    }, 'borrar'));
  }

  function renderResults() {
    const n = state.qubits;
    const states = allStates(n);
    const reached = state.result ? Object.values(state.result).reduce((a, b) => a + b, 0) : 0;
    plotEl.replaceChildren();
    states.forEach((s, idx) => {
      const measured = state.result ? (state.result[s] || 0) / (reached || 1) : 0;
      const ideal = state.ideal ? state.ideal[idx] : 0;
      const mBar = el('div', { class: 'bar measured' }, el('span', { class: 'val' }, (measured * 100).toFixed(0)));
      const iBar = el('div', { class: 'bar ideal' });
      const col = el('div', { class: 'col', title: `|${s}⟩ ideal ${(ideal * 100).toFixed(1)}%` },
        el('div', { class: 'track' }, mBar, iBar),
        el('span', { class: 'ket' }, `|${s}⟩`));
      plotEl.append(col);
      requestAnimationFrame(() => {
        mBar.style.height = `${(measured * 100).toFixed(2)}%`;
        iBar.style.height = `${(ideal * 100).toFixed(2)}%`;
      });
    });

    const reachable = (state.ideal || []).map((p, i) => (p > 1e-6 ? i : -1)).filter(i => i >= 0);
    const allSame = reachable.length > 1 && reachable.every(i => i === 0 || i === (1 << n) - 1);
    ampsEl.replaceChildren();
    ampsEl.append(el('h3', {}, 'Estado (amplitudes ideales)'));
    const list = el('ul', {});
    for (const idx of reachable) {
      const key = allStates(n)[idx];
      list.append(el('li', {}, `|${key}⟩  p=${(state.ideal[idx] * 100).toFixed(1)}%`));
    }
    ampsEl.append(list);
    if (allSame) ampsEl.append(el('p', { class: 'hint' }, 'Correlación total: solo |' + '0'.repeat(n) + '⟩ y |' + '1'.repeat(n) + '⟩.'));
    badgeEl.textContent = state.result ? `fuente: ${state.sourceLabel}` : 'fuente: (sin medir)';
  }

  function shake() {
    const app = root.querySelector('.app');
    if (!app) return;
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  }

  function setBusy(busy) {
    state.busy = busy;
    runBtn.disabled = busy;
    runBtn.textContent = busy ? 'Midiendo…' : 'Medir (collapse)';
  }

  async function run() {
    if (state.busy) return;
    setBusy(true);
    setStatus('Midiendo…');
    const circuit = { qubits: state.qubits, ops: opsFromGrid() };
    log(`run: ${circuit.qubits}q, ${state.shots} shots, ops=${JSON.stringify(circuit.ops)}`);
    try {
      const res = await source.runCircuit(circuit, state.shots, (Math.random() * 2 ** 31) | 0);
      log(`counts: ${JSON.stringify(res.counts)}`);
      state.result = res.counts;
      state.sourceLabel = res.sourceLabel;
      updateIdeal();
      renderResults();
      shake();
      audio.collapseSweep();
      setTimeout(audio.runChord, 120);
      setStatus(`Listo: ${state.shots} shots (${res.sourceLabel}).`);
    } catch (error) {
      const message = String(error && error.message ? error.message : error).trim().split('\n').pop();
      setStatus(`Falló: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(name) {
    if (name === 'bell') { setQubits(2); state.grid[0][0] = 'h'; state.grid[0][1] = 'cx'; }
    if (name === 'ghz') { setQubits(3); state.grid[0][0] = 'h'; state.grid[0][1] = 'cx'; state.grid[1][1] = 'cx'; }
    if (name === 'uniform') { setQubits(3); for (let r = 0; r < 3; r++) state.grid[r][0] = 'h'; }
    state.result = null;
    updateIdeal();
    renderCircuit();
    renderResults();
    audio.blip();
  }

  function setQubits(n) {
    state.qubits = n;
    qubitsSel.value = String(n);
    state.grid = emptyGrid(n, STEPS);
  }

  qubitsSel.addEventListener('change', () => setQubits(Number(qubitsSel.value)));
  qubitsSel.addEventListener('change', () => { state.result = null; updateIdeal(); renderCircuit(); renderResults(); });
  shotsInput.addEventListener('change', () => { state.shots = Math.max(1, Math.min(4096, Number(shotsInput.value) || 200)); });
  runBtn.addEventListener('click', run);
  clearBtn.addEventListener('click', () => { setQubits(state.qubits); state.result = null; updateIdeal(); renderCircuit(); renderResults(); setStatus('Lienzo limpio.'); });

  const header = el('header', {},
    el('h1', {}, 'Quards', el('span', { class: 'sub' }, ' · Quantum Lab')),
    badgeEl);
  const builder = el('section', { class: 'builder' },
    el('div', { class: 'builder-head' }, el('h2', {}, 'Circuito'), el('span', { class: 'hint' }, 'Elegí una compuerta y hacé click en una celda.')),
    paletteEl,
    circuitEl,
    el('div', { class: 'controls' },
      el('label', {}, 'Qubits ', qubitsSel),
      el('label', {}, 'Shots ', shotsInput),
      runBtn,
      clearBtn));
  const presets = el('div', { class: 'presets' },
    el('button', { type: 'button', onclick: () => applyPreset('bell') }, 'Bell (2)'),
    el('button', { type: 'button', onclick: () => applyPreset('ghz') }, 'GHZ (3)'),
    el('button', { type: 'button', onclick: () => applyPreset('uniform') }, 'Uniforme (3)'));
  const results = el('section', { class: 'results' },
    el('h2', {}, 'Resultados'), plotEl, ampsEl, statusEl);

  const app = el('div', { class: 'app' }, header, el('p', { class: 'lead' }, 'Prueba de primitivas: statevector general, compuertas, entrelazado y colapso por el adaptador.'), presets, builder, results);

  root.append(bg, crt, app);

  renderPalette();
  renderCircuit();
  updateIdeal();
  renderResults();
  setStatus('Listo. Armá un circuito o usá un preset, después presioná Medir.');
  log('UI renderizada');
}
