// Quards UI (DOM) sobre el MODELO DEL BACK, vía servicios (engine, quantum,
// rules, ai). Misma estructura de DOM/CSS; el colapso lo decide el puerto cuántico.
import * as quantum from '../services/quantum.js';
import * as rules from '../services/rules.js';
import { chooseAction } from '../services/ai.js';
import { startBackground } from './background.js';
import * as audio from './audio.js';
import { log, warn } from './debug.js';
import { sizeLayer, drawEntangleLines } from './entangle.js';

const SYM = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4' };
const GATE_HINT = {
  x: 'X: intercambia las probabilidades de las dos caras.',
  z: 'Z: cambia la fase (se nota combinada con H).',
  h: 'H: deja la carta en superposición 50/50.',
  cnot: 'CNOT: entrelaza dos cartas (control → target).',
};
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const symOf = f => SYM[f.symbol] ?? f.symbol;
const colorCls = f => `color-${f.color ?? 'wild'}`;

export async function mount(root) {
  audio.armAudio();
  root.replaceChildren();

  const bg = el('canvas', { class: 'bg', width: 320, height: 180 });
  const crt = el('div', { class: 'crt' });
  try { startBackground(bg); } catch (error) { warn(`fondo WebGL no disponible: ${error?.message ?? error}`); }

  const health = await quantum.ionqHealth().catch(() => ({ ok: false, hasKey: false }));
  const hasIonQ = !quantum.isQollab() && health.ok && health.hasKey;

  let state = rules.newGame({ seed: Date.now() % 100000 });
  let level = 'medium';
  let pendingGate = null; // { gate, a }
  let selectedId = null;
  let press = null;
  let busy = false;
  const probCache = new Map();

  const badgeEl = el('span', { class: 'badge' });
  const levelSel = el('select', {},
    el('option', { value: 'easy' }, 'Fácil'),
    el('option', { value: 'medium' }, 'Media'),
    el('option', { value: 'hard' }, 'Difícil'));
  levelSel.value = level;
  const engineSel = el('select', {});
  const oppCountEl = el('span', { class: 'count-pill' }, '0');
  const oppHandEl = el('div', { class: 'hand opp' });
  const deckEl = el('div', { class: 'deck' });
  const discardEl = el('div', { class: 'discard' });
  const handEl = el('div', { class: 'hand mine' });
  const gatesEl = el('div', { class: 'gates' });
  const turnEl = el('span', { class: 'turn' });
  const statusEl = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const hintEl = el('div', { class: 'hint-bar', role: 'note' });
  const logEl = el('div', { class: 'log' });
  const statYouEl = el('span', { class: 'n' }, '0');
  const statAiEl = el('span', { class: 'n' }, '0');
  const statDeckEl = el('span', { class: 'n' }, '0');
  const drawBtn = el('button', { class: 'draw', type: 'button' }, 'Robar');
  const newBtn = el('button', { class: 'ghost', type: 'button' }, 'Nueva partida');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'entangle-layer');

  const isHumanTurn = () => state.phase === 'play' && state.turn.current === 0 && !busy;

  async function probsFor(id) {
    const c = state.cards[id];
    if (!c.group) return null;
    const g = state.groups[c.group];
    if (g.collapsed) return g.bits[c.qubit] === 0 ? [1, 0] : [0, 1];
    const key = `${g.id}:${g.ops.length}`;
    if (!probCache.has(key)) probCache.set(key, await quantum.probabilidadesGrupo(g));
    return probCache.get(key)[c.qubit];
  }

  function faceEl(face, pct) {
    return el('div', { class: `face ${colorCls(face)}` },
      el('span', { class: 'num' }, symOf(face)),
      pct != null ? el('span', { class: 'pct' }, `${Math.round(pct * 100)}%`) : null);
  }

  async function cardEl(id, opts = {}) {
    const c = state.cards[id];
    const node = el('button', { type: 'button', class: `card k-${c.group ? 'qubit' : 'classic'}` });
    node.dataset.id = id;
    if (opts.playable) node.classList.add('playable');
    if (opts.selected) node.classList.add('selected');
    if (opts.facedown) { node.classList.add('facedown', 'back'); return node; }
    if (c.face) node.append(faceEl(c.face, null));
    else {
      const p = await probsFor(id);
      node.classList.add('super');
      node.append(faceEl(c.outcomes[0], p[0]), faceEl(c.outcomes[1], p[1]));
    }
    if (opts.onPointerDown) node.addEventListener('pointerdown', event => opts.onPointerDown(id, event));
    return node;
  }

  // ---------- flujo ----------
  async function doPlay(id) {
    if (!isHumanTurn() || !rules.canPlay(state, id)) return;
    audio.blip();
    const r = rules.play(state, id);
    selectedId = null; pendingGate = null;
    if (r.error) { await render(); return; }
    if (r.needsMeasure) {
      log(`Midiendo con ${quantum.kind()}…`);
      await render();
      try { rules.resolveMeasure(state, await quantum.medirGrupo(r.needsMeasure)); }
      catch (error) { warn(`medición falló: ${error?.message ?? error}`); }
    }
    await render();
    if (state.phase === 'over') audio.runChord(); else scheduleAI();
  }

  async function onGate(gate) {
    if (!isHumanTurn()) return;
    pendingGate = gate === 'cnot' ? { gate, a: null } : { gate };
    audio.tick();
    await render();
  }

  async function onCardTap(id) {
    if (!isHumanTurn()) return;
    if (pendingGate) {
      if (state.cards[id].face) return;
      if (pendingGate.gate === 'cnot') {
        if (pendingGate.a === null) { pendingGate.a = id; audio.tick(); await render(); return; }
        if (pendingGate.a === id) { pendingGate.a = null; await render(); return; }
        const r = rules.applyGate(state, 'cnot', pendingGate.a, id);
        pendingGate = null;
        if (r.error) hintEl.textContent = r.error;
        audio.blip(); await render(); return;
      }
      const r = rules.applyGate(state, pendingGate.gate, id);
      pendingGate = null;
      if (r.error) hintEl.textContent = r.error;
      audio.blip(); await render(); return;
    }
    if (rules.canPlay(state, id)) { selectedId = selectedId === id ? null : id; audio.tick(); await render(); return; }
    hintEl.textContent = 'Esa carta no es jugable ahora.';
  }

  function startPress(id, event) {
    if (!isHumanTurn()) return;
    press = { id, el: event.currentTarget, startX: event.clientX, startY: event.clientY, active: false, ghost: null };
  }
  function isOver(event, node) {
    const r = node.getBoundingClientRect();
    return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
  }
  function onPointerMove(event) {
    if (!press) return;
    if (!press.active && !pendingGate && rules.canPlay(state, press.id) && Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 6) {
      press.active = true;
      press.el.classList.add('dragging');
      press.ghost = press.el.cloneNode(true);
      press.ghost.classList.add('drag-ghost');
      document.body.append(press.ghost);
    }
    if (press.active) {
      press.ghost.style.left = `${event.clientX}px`;
      press.ghost.style.top = `${event.clientY}px`;
      discardEl.classList.toggle('drop-target', isOver(event, discardEl));
    }
  }
  function onPointerUp(event) {
    if (!press) return;
    const p = press; press = null;
    if (p.active) {
      p.el.classList.remove('dragging');
      if (p.ghost) p.ghost.remove();
      discardEl.classList.remove('drop-target');
      if (isOver(event, discardEl)) doPlay(p.id);
      return;
    }
    onCardTap(p.id);
  }
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', () => { if (press) { press.ghost?.remove(); press.el?.classList.remove('dragging'); discardEl.classList.remove('drop-target'); press = null; } });

  discardEl.addEventListener('click', async () => {
    if (!isHumanTurn()) return;
    if (selectedId && rules.canPlay(state, selectedId)) doPlay(selectedId);
    else hintEl.textContent = 'Elegí una carta de tu mano y soltala acá para jugarla.';
  });
  drawBtn.addEventListener('click', async () => { if (isHumanTurn() && !rules.hasMove(state)) { audio.blip(); rules.draw(state); await render(); scheduleAI(); } });
  levelSel.addEventListener('change', () => { level = levelSel.value; });
  engineSel.addEventListener('change', () => { quantum.setEngine(engineSel.value); log(`motor → ${engineSel.value}`); render(); });
  newBtn.addEventListener('click', () => { state = rules.newGame({ seed: Date.now() % 100000 }); pendingGate = null; selectedId = null; busy = false; render(); });

  function scheduleAI() {
    if (state.phase !== 'play' || state.turn.current !== 1) return;
    aiTurn();
  }
  async function aiTurn() {
    busy = true; await render();
    let guard = 0;
    while (state.phase === 'play' && state.turn.current === 1 && guard++ < 300) {
      const action = await chooseAction(state, 1, level);
      if (!action) break;
      if (action.type === 'gate') rules.applyGate(state, action.gate, action.a, action.b);
      else if (action.type === 'draw') rules.draw(state);
      else {
        const r = rules.play(state, action.cardId);
        if (r.needsMeasure) { try { rules.resolveMeasure(state, await quantum.medirGrupo(r.needsMeasure)); } catch (e) { warn(`medición IA: ${e?.message ?? e}`); } }
      }
      await render();
      await sleep(250);
    }
    busy = false; await render();
    if (state.phase === 'over') audio.runChord();
  }

  // ---------- render ----------
  async function render() {
    const me = state.players[0], opp = state.players[1];
    badgeEl.textContent = `motor: ${quantum.kind()}`;
    engineSel.replaceChildren(
      ...(quantum.isQollab() ? [el('option', { value: 'qiskit' }, 'Qiskit')]
        : [el('option', { value: 'referencia' }, 'Referencia'),
           ...(hasIonQ ? [el('option', { value: 'ionq' }, 'IonQ')] : [])]));
    engineSel.value = quantum.kind();

    oppHandEl.replaceChildren(...opp.hand.map(() => el('div', { class: 'card facedown back' })));
    oppCountEl.textContent = `${opp.hand.length} · ${opp.gates.length}🔑`;
    statYouEl.textContent = me.hand.length;
    statAiEl.textContent = opp.hand.length;
    statDeckEl.textContent = state.deck.length;

    deckEl.replaceChildren(el('span', { class: 'count' }, state.deck.length));
    discardEl.replaceChildren(await cardEl(state.discard[state.discard.length - 1]));

    handEl.replaceChildren();
    for (const id of me.hand) {
      const playable = isHumanTurn() && rules.canPlay(state, id);
      const isTarget = pendingGate && !state.cards[id].face;
      handEl.append(await cardEl(id, { playable: playable || isTarget, selected: selectedId === id, onPointerDown: startPress }));
    }

    gatesEl.replaceChildren();
    if (!me.gates.length) gatesEl.append(el('span', { class: 'muted' }, 'sin puertas'));
    me.gates.forEach(gate => gatesEl.append(el('button', {
      type: 'button', class: `chip gate-${gate}`, title: GATE_HINT[gate], disabled: !isHumanTurn(),
      onclick: () => onGate(gate),
    }, gate.toUpperCase())));

    turnEl.textContent = state.phase === 'play' ? (state.turn.current === 0 ? 'Tu turno' : 'Turno de la IA…') : '';
    if (state.phase === 'over') statusEl.textContent = state.winner === 'p1' ? '¡Ganaste!' : 'Ganó la IA.';
    else if (pendingGate) statusEl.textContent = pendingGate.gate === 'cnot' ? 'CNOT: elegí control y después target.' : `${pendingGate.gate.toUpperCase()}: elegí una carta tuya.`;
    else statusEl.textContent = isHumanTurn() ? 'Prepará con puertas (gratis) y jugá una carta.' : 'La IA está pensando…';

    if (pendingGate) hintEl.textContent = GATE_HINT[pendingGate.gate];
    else if (selectedId) hintEl.textContent = 'Arrastrá la carta al descarte o clickeá el descarte para jugarla.';
    else hintEl.textContent = '';

    drawBtn.disabled = !(isHumanTurn() && !rules.hasMove(state));

    logEl.replaceChildren(...state.log.map((line, i) => el('div', { class: `line${i === state.log.length - 1 ? ' last' : ''}` }, line)));
    logEl.scrollTop = logEl.scrollHeight;

    sizeLayer(svg, root);
    const groups = new Map();
    handEl.querySelectorAll('.card').forEach(node => {
      const c = state.cards[node.dataset.id];
      if (c && c.group) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(node); }
    });
    drawEntangleLines(svg, groups, root);
  }

  const layout = el('div', { class: 'layout' },
    el('aside', { class: 'sidebar' },
      el('div', { class: 'side-info' }, turnEl, statusEl),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, statYouEl, el('span', { class: 'k' }, 'Tú')),
        el('div', { class: 'stat' }, statAiEl, el('span', { class: 'k' }, 'IA')),
        el('div', { class: 'stat' }, statDeckEl, el('span', { class: 'k' }, 'Mazo'))),
      el('h2', {}, 'Historial'),
      logEl),
    el('main', { class: 'board' },
      el('section', { class: 'opponent' },
        el('div', { class: 'sec-head' }, el('span', { class: 'label' }, 'IA'), oppCountEl),
        oppHandEl),
      el('section', { class: 'table' },
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Mazo'), deckEl),
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Descarte'), discardEl)),
      hintEl,
      el('section', { class: 'mine' }, handEl),
      el('section', { class: 'gates-row' }, el('span', { class: 'label' }, 'Puertas'), gatesEl),
      el('div', { class: 'controls' }, drawBtn)));

  const app = el('div', { class: 'app' },
    el('header', {},
      el('div', { class: 'header-left' }, el('h1', {}, 'Quards'), badgeEl),
      el('div', { class: 'header-right' }, el('label', {}, 'IA ', levelSel), el('label', {}, 'Motor ', engineSel), newBtn)),
    layout);

  root.append(bg, crt, svg, app);
  log(`Quards lista (motor ${quantum.kind()}).`);
  await render();
  scheduleAI();
}
