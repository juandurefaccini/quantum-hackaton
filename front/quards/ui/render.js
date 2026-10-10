// Quards UI (DOM) sobre el MODELO DEL BACK, vía servicios (engine, quantum,
// rules, ai). Misma estructura de DOM/CSS; el colapso lo decide el puerto cuántico.
import * as quantum from '../services/quantum.js';
import * as rules from '../services/rules.js';
import { chooseAction } from '../services/ai.js';
import { startBackground } from './background.js';
import * as audio from './audio.js';
import { log, warn, isDebugVisible, setDebugVisible } from './debug.js';
import { entangledGroupOf, orderHand } from './entangle.js';
import { mountQard } from './qard.js';
import { showCircuitTip, hideCircuitTip } from './circuit.js';
import { playCollapse } from './collapse.js';

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
    else if (typeof v === 'boolean') { if (k in node) node[k] = v; else if (v) node.setAttribute(k, ''); else node.removeAttribute(k); }
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Ritmo de la IA: pausas para poder seguir la partida paso a paso.
const AI_THINK_MS = 700; // antes de empezar a actuar
const AI_PREP_MS = 700;  // compuertas (preparación libre)
const AI_PLAY_MS = 1100; // jugar/robar (cierra el turno)
const symOf = f => SYM[f.symbol] ?? f.symbol;

// Preferencia persistente: marcar (o no) las cartas posiblemente jugables.
const PLAYABLE_KEY = 'quards:markPlayable';
function loadFlag(key, fallback = true) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
}

// FLIP: anima las cartas que cambiaron de posición en la mano (p.ej. al entrelazarse).
// Se ignoran los desplazamientos chicos (selección/hover) con un umbral.
function animateHandMoves(prevRects, container) {
  if (!prevRects.size) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const THRESHOLD = 20;
  for (const node of container.querySelectorAll('.card')) {
    const prev = prevRects.get(node.dataset.id);
    if (!prev) continue;
    const next = node.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) continue;
    node.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
      { duration: 340, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)' },
    );
  }
}

// Anima cartas robadas: vuelan del mazo a la mano destino (carta boca abajo).
function flyCards(deckEl, targetEl, count) {
  if (count <= 0) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const from = deckEl.getBoundingClientRect();
  const to = targetEl.getBoundingClientRect();
  if (!from.width || !to.width) return;
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - fx;
  const dy = to.top + to.height / 2 - fy;
  for (let i = 0; i < count; i++) {
    const ghost = el('div', { class: 'card facedown back fly' });
    ghost.style.left = `${fx}px`;
    ghost.style.top = `${fy}px`;
    document.body.append(ghost);
    ghost.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(-6deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.85) rotate(6deg)`, opacity: 0.85 },
      ],
      { duration: 420, delay: i * 90, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
    ).onfinish = () => ghost.remove();
  }
}

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
  let markPlayable = loadFlag(PLAYABLE_KEY);
  let pendingGate = null; // { gate, a }
  let selectedId = null;
  let press = null;
  let busy = false;
  const probCache = new Map();
  // Manos en el render anterior, para animar los robos (delta de cartas).
  let lastCounts = { me: state.players[0].hand.length, opp: state.players[1].hand.length };

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
  const markCb = el('input', { type: 'checkbox' });
  markCb.checked = markPlayable;
  markCb.addEventListener('change', () => {
    markPlayable = markCb.checked;
    try { localStorage.setItem(PLAYABLE_KEY, markPlayable ? '1' : '0'); } catch { /* sin storage */ }
    render();
  });
  // El panel de debug arranca apagado; se muestra con este checkbox (arriba).
  const debugCb = el('input', { type: 'checkbox' });
  debugCb.checked = isDebugVisible();
  debugCb.addEventListener('change', () => setDebugVisible(debugCb.checked));

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

  async function cardEl(id, opts = {}) {
    const c = state.cards[id];
    const node = el('button', { type: 'button', class: `card k-${c.group ? 'qubit' : 'classic'}` });
    node.dataset.id = id;
    if (opts.playable) node.classList.add('playable');
    if (opts.selected) node.classList.add('selected');
    if (opts.facedown) { node.classList.add('facedown', 'back'); return node; }
    const grad = f => f.color ?? 'grey';
    if (c.face) {
      mountQard(node, { kind: 'classic', color: grad(c.face), symbol: symOf(c.face) });
    } else {
      const p = await probsFor(id);
      node.classList.add('super');
      mountQard(node, {
        kind: 'quantum',
        color0: grad(c.outcomes[0]), sym0: symOf(c.outcomes[0]),
        color1: grad(c.outcomes[1]), sym1: symOf(c.outcomes[1]),
        prob0: Math.round((p?.[0] ?? 0.5) * 100),
      });
    }
    if (c.group) {
      const g = state.groups[c.group];
      const show = () => showCircuitTip(node, g);
      node.addEventListener('pointerenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('pointerleave', hideCircuitTip);
      node.addEventListener('blur', hideCircuitTip);
    }
    if (opts.onPointerDown) node.addEventListener('pointerdown', event => opts.onPointerDown(id, event));
    return node;
  }

  // Probabilidad de la primera cara, para la carta fantasma del colapso.
  async function prob0Of(id) {
    try { const p = await probsFor(id); return Math.round((p?.[0] ?? 0.5) * 100); } catch { return 50; }
  }

  // ---------- flujo ----------
  async function doPlay(id) {
    if (!isHumanTurn() || !rules.canPlay(state, id)) return;
    hideCircuitTip();
    audio.blip();
    const r = rules.play(state, id);
    selectedId = null; pendingGate = null;
    if (r.error) { await render(); return; }
    if (r.needsMeasure) {
      log(`Midiendo con ${quantum.kind()}…`);
      await render();
      try {
        const bits = await playCollapse({
          state, group: r.needsMeasure, cardId: id,
          bitsPromise: quantum.medirGrupo(r.needsMeasure),
          symOf, prob0: await prob0Of(id),
        });
        rules.resolveMeasure(state, bits);
      } catch (error) { warn(`medición falló: ${error?.message ?? error}`); }
    }
    await render();
    if (state.phase === 'over') audio.runChord(); else scheduleAI();
  }

  async function onGate(gate) {
    if (!isHumanTurn()) return;
    // Volver a presionar la misma puerta cancela la selección pendiente.
    if (pendingGate && pendingGate.gate === gate) {
      pendingGate = null;
      hintEl.textContent = '';
    } else {
      pendingGate = gate === 'cnot' ? { gate, a: null } : { gate };
    }
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
    hideCircuitTip();
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
  newBtn.addEventListener('click', () => { state = rules.newGame({ seed: Date.now() % 100000 }); lastCounts = { me: state.players[0].hand.length, opp: state.players[1].hand.length }; pendingGate = null; selectedId = null; busy = false; render(); });

  function scheduleAI() {
    if (state.phase !== 'play' || state.turn.current !== 1) return;
    aiTurn();
  }
  async function aiTurn() {
    busy = true; await render();
    await sleep(AI_THINK_MS);
    let guard = 0;
    while (state.phase === 'play' && state.turn.current === 1 && guard++ < 300) {
      const action = await chooseAction(state, 1, level);
      if (!action) break;
      let stepMs = AI_PREP_MS;
      if (action.type === 'gate') rules.applyGate(state, action.gate, action.a, action.b);
      else if (action.type === 'draw') { rules.draw(state); stepMs = AI_PLAY_MS; }
      else {
        const r = rules.play(state, action.cardId);
        if (r.needsMeasure) {
          await render();
          try {
            const bits = await playCollapse({
              state, group: r.needsMeasure, cardId: action.cardId,
              bitsPromise: quantum.medirGrupo(r.needsMeasure),
              symOf, prob0: await prob0Of(action.cardId),
            });
            rules.resolveMeasure(state, bits);
          } catch (e) { warn(`medición IA: ${e?.message ?? e}`); }
        }
        stepMs = AI_PLAY_MS;
      }
      await render();
      await sleep(stepMs);
    }
    busy = false; await render();
    if (state.phase === 'over') audio.runChord();
  }

  // ---------- render ----------
  async function render() {
    hideCircuitTip();
    const prevHandRects = new Map();
    handEl.querySelectorAll('.card').forEach(node => prevHandRects.set(node.dataset.id, node.getBoundingClientRect()));
    const me = state.players[0], opp = state.players[1];
    const grewMe = Math.max(0, me.hand.length - lastCounts.me);
    const grewOpp = Math.max(0, opp.hand.length - lastCounts.opp);
    lastCounts = { me: me.hand.length, opp: opp.hand.length };
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
    const pods = new Map();
    for (const id of orderHand(state, me.hand)) {
      const playable = markPlayable && isHumanTurn() && rules.canPlay(state, id);
      const isTarget = pendingGate && !state.cards[id].face;
      const node = await cardEl(id, { playable: playable || isTarget, selected: selectedId === id, onPointerDown: startPress });
      const group = entangledGroupOf(state, id, me.hand);
      if (!group) { handEl.append(node); continue; }
      let pod = pods.get(group.id);
      if (!pod) {
        pod = el('div', { class: 'ent-group', title: 'Cartas entrelazadas: se miden juntas' });
        pods.set(group.id, pod);
        handEl.append(pod);
      }
      pod.append(node);
    }
    animateHandMoves(prevHandRects, handEl);

    gatesEl.replaceChildren();
    if (!me.gates.length) gatesEl.append(el('span', { class: 'muted' }, 'sin puertas'));
    me.gates.forEach(gate => gatesEl.append(el('button', {
      type: 'button', class: `chip gate-${gate}${pendingGate && pendingGate.gate === gate ? ' active' : ''}`,
      title: GATE_HINT[gate], disabled: !isHumanTurn(),
      onclick: () => onGate(gate),
    }, gate.toUpperCase())));

    turnEl.textContent = state.phase === 'play' ? (state.turn.current === 0 ? 'Tu turno' : 'Turno de la IA…') : '';
    if (state.phase === 'over') statusEl.textContent = state.winner === 'p1' ? '¡Ganaste!' : 'Ganó la IA.';
    else if (pendingGate) statusEl.textContent = pendingGate.gate === 'cnot' ? 'CNOT: elegí control y después target.' : `${pendingGate.gate.toUpperCase()}: elegí una carta tuya.`;
    else statusEl.textContent = isHumanTurn() ? 'Prepará con puertas (gratis) y jugá una carta.' : 'La IA está pensando…';

    if (pendingGate) hintEl.textContent = GATE_HINT[pendingGate.gate];
    else if (selectedId) hintEl.textContent = 'Arrastrá la carta al descarte o clickeá el descarte para jugarla.';
    else hintEl.textContent = '';

    // Robar es la única jugada posible: el botón se enciende.
    const mustDraw = isHumanTurn() && !rules.hasMove(state);
    drawBtn.disabled = !mustDraw;
    drawBtn.classList.toggle('only-option', mustDraw);

    logEl.replaceChildren(...state.log.map((line, i) => el('div', { class: `line${i === state.log.length - 1 ? ' last' : ''}` }, line)));
    logEl.scrollTop = logEl.scrollHeight;

    flyCards(deckEl, oppHandEl, grewOpp);
    flyCards(deckEl, handEl, grewMe);
  }

  const layout = el('div', { class: 'layout' },
    el('aside', { class: 'sidebar' },
      el('div', { class: 'side-info' }, turnEl, statusEl),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, statYouEl, el('span', { class: 'k' }, 'Tú')),
        el('div', { class: 'stat' }, statAiEl, el('span', { class: 'k' }, 'IA')),
        el('div', { class: 'stat' }, statDeckEl, el('span', { class: 'k' }, 'Mazo'))),
      el('h2', {}, 'Historial'),
      logEl,
      el('div', { class: 'sidebar-draw' }, drawBtn)),
    el('main', { class: 'board' },
      el('section', { class: 'opponent' },
        el('div', { class: 'sec-head' }, el('span', { class: 'label' }, 'IA'), oppCountEl),
        oppHandEl),
      el('section', { class: 'table' },
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Mazo'), deckEl),
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Descarte'), discardEl)),
      hintEl,
      el('section', { class: 'mine' }, handEl),
      el('section', { class: 'gates-row' }, el('span', { class: 'label' }, 'Puertas'), gatesEl)));

  const app = el('div', { class: 'app' },
    el('header', {},
      el('div', { class: 'header-left' }, el('h1', {}, 'Quards'), badgeEl),
      el('div', { class: 'header-right' },
        el('label', { class: 'toggle', title: 'Resaltar las cartas que podrían jugarse' }, markCb, 'Jugables'),
        el('label', { class: 'toggle', title: 'Mostrar el panel de debug' }, debugCb, 'Debug'),
        el('label', {}, 'IA ', levelSel), el('label', {}, 'Motor ', engineSel), newBtn)),
    layout);

  root.append(bg, crt, app);
  log(`Quards lista (motor ${quantum.kind()}).`);
  await render();
  scheduleAI();
}
