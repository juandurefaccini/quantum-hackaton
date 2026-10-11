// Qards UI (DOM) sobre el MODELO DEL BACK, vía servicios (engine, quantum,
// rules, ai). Misma estructura de DOM/CSS; el colapso lo decide el puerto cuántico.
import * as quantum from '../services/quantum.js';
import * as rules from '../services/rules.js';
import { chooseAction } from '../services/ai.js';
import { startBackground } from './background.js';
import * as audio from './audio.js';
import { log, warn, isDebugVisible, setDebugVisible } from './debug.js';
import { entangledGroupOf, orderHand } from './entangle.js';
import { mountQard } from './qard.js';
import { createGateCard, ensureGateStyles } from './gatecard.js';
import { playCollapse } from './collapse.js';
import { playSuperpose } from './superpose.js';
import { showCircuitOverlay, hideCircuitOverlay } from './circuit-overlay.js';

const SYM = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4' };
const GATE_HINT = {
  x: 'X: intercambia las probabilidades de las dos caras.',
  z: 'Z: invierte la fase (+ ↔ −); no cambia las probabilidades, pero sí el resultado de una H posterior.',
  h: 'H: convierte la fase en probabilidad: suele dejar la carta muy inclinada hacia una cara (la fase, que cambia con Z, decide cuál).',
  cnot: 'CNOT: entrelaza dos cartas (control → target): invierte el target solo cuando el control da |1⟩, así que lo que pase con una cambia lo que sabés de la otra. El target puede ser una carta de la IA.',
  sup: 'SUP (superposición): reabre una carta fija y la deja 50/50 entre sus dos caras. Elegí una carta con cara.',
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
const FACE_COLOR = { red: '#e0463a', blue: '#3a7bd5', green: '#2fae6a', yellow: '#e6b23a', grey: '#6b6358' };

// Preferencia persistente: marcar (o no) las cartas posiblemente jugables.
const PLAYABLE_KEY = 'qards:markPlayable';
function loadFlag(key, fallback = true) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
}

// Respeta la preferencia de movimiento reducido del sistema.
const motionOff = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// FLIP: anima las cartas que cambiaron de posición en la mano (p.ej. al entrelazarse).
// Se ignoran los desplazamientos chicos (selección/hover) con un umbral.
function animateHandMoves(prevRects, container) {
  if (!prevRects.size || motionOff()) return;
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

// Ajusta el solape de una mano para que entre en una sola fila.
// Sin cartas de más no solapa (salvo el --ov-base de la mano); con más, reparte el exceso.
function fitHand(container) {
  const items = [...container.children];
  const n = items.length;
  if (n < 2) { container.style.removeProperty('--ov'); return; }
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap) || 0;
  const base = parseFloat(cs.getPropertyValue('--ov-base')) || 0;
  const widths = items.reduce((sum, node) => sum + node.offsetWidth, 0);
  const natural = widths + (gap - base) * (n - 1);
  const extra = Math.max(0, (natural - container.clientWidth + 1) / (n - 1));
  container.style.setProperty('--ov', `${-(base + extra)}px`);
}

// Carta fantasma boca abajo que vuela del mazo a un rect destino. Devuelve la Animation.
function spawnFlyingCard(deckEl, targetRect, { delay = 0, duration = 420, scaleEnd = 0.85, width, onFinish } = {}) {
  if (motionOff()) return null;
  const from = deckEl.getBoundingClientRect();
  if (!from.width || !targetRect?.width) return null;
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  const dx = targetRect.left + targetRect.width / 2 - fx;
  const dy = targetRect.top + targetRect.height / 2 - fy;
  const ghost = el('div', { class: 'card facedown back fly' });
  if (width) {
    ghost.style.setProperty('--card-w', `${width}px`);
    ghost.style.setProperty('--qard-w', `${width}px`);
    ghost.style.width = `${width}px`;
  }
  ghost.style.position = 'fixed';
  ghost.style.left = `${fx}px`;
  ghost.style.top = `${fy}px`;
  ghost.style.transform = 'translate(-50%, -50%)';
  document.body.append(ghost);
  const anim = ghost.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1) rotate(-6deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleEnd}) rotate(6deg)`, opacity: 0.85 },
    ],
    { duration, delay, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
  );
  anim.onfinish = () => { ghost.remove(); onFinish?.(); };
  return anim;
}

// Anima cartas robadas: vuelan del mazo a la mano destino (carta boca abajo).
function flyCards(deckEl, targetEl, count) {
  if (count <= 0 || motionOff()) return;
  const to = targetEl.getBoundingClientRect();
  if (!to.width) return;
  for (let i = 0; i < count; i++) spawnFlyingCard(deckEl, to, { delay: i * 90 });
}

// Estilos del ojo (espiar). Se inyectan una vez, como los de qard.js.
const SPY_CSS = `
  .gates-row { min-height: 60px; }
  .chip.eye { cursor: pointer; }
  /* El ojo es la habilidad destacada de la fila de abajo: grande, dorado y con pulso cuando se puede usar */
  .eye-big { display: inline-flex; align-items: center; gap: 12px; padding: 8px 20px; min-height: 48px; font-size: 15px;
    letter-spacing: 0.1em; text-transform: uppercase; border-color: #e6b23a; background: linear-gradient(#3a2f14, #241d0c); }
  .eye-big .eye-ico { font-size: 26px; line-height: 1; }
  .eye-big .eye-txt { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; font-weight: 700; }
  .eye-big .eye-txt small { font-size: 10px; font-weight: 400; letter-spacing: 0.1em; text-transform: none; opacity: 0.8; }
  .eye-big .eye-count { font-size: 20px; font-weight: 700; color: #e6b23a; min-width: 2ch; text-align: center; }
  .eye-big:not(:disabled) { animation: eye-pulse 2.2s ease-in-out infinite; }
  .eye-big:disabled { filter: grayscale(0.7); opacity: 0.5; cursor: not-allowed; }
  .eye-big.active { animation: none; outline: 3px solid #e6b23a; outline-offset: 3px; background: linear-gradient(#5a4515, #3a2d0e);
    box-shadow: 3px 3px 0 #0b0a09, 0 0 24px #e6b23a; }
  @keyframes eye-pulse {
    0%, 100% { box-shadow: 3px 3px 0 #0b0a09, 0 0 6px rgba(230, 178, 58, 0.35); }
    50% { box-shadow: 3px 3px 0 #0b0a09, 0 0 22px rgba(230, 178, 58, 0.85); }
  }
  @media (prefers-reduced-motion: reduce) { .eye-big:not(:disabled) { animation: none; } }
  .eye-next { opacity: 0.7; font-size: 0.85em; }
  .card.spy-target { outline: 2px solid #e6b23a; outline-offset: 2px; cursor: pointer; }
  /* main.css pone pointer-events:none a las cartas del rival: acá se habilitan solo las que son objetivo */
  .hand.opp .card.spy-target { pointer-events: auto; }
  .hand.opp > .spy-target:hover { z-index: 6; filter: brightness(1.3); }
  .card.spied { position: relative; }
  .card .spy-mark { position: absolute; top: 4px; right: 4px; white-space: nowrap; font-size: 10px; line-height: 1; color: #f1e8d6; text-shadow: 0 1px 2px #000; pointer-events: none; }
  .spy-toast { display: none; position: fixed; top: 50%; right: 18px; transform: translateY(-50%); z-index: 1000;
    background: #16130f; border: 2px solid #e6b23a; border-radius: 12px; padding: 12px 16px; color: #f1e8d6;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6); min-width: 240px; }
  .spy-toast.show { display: block; }
  .spy-toast .spy-head { font-weight: 700; margin-bottom: 10px; }
  .spy-toast .spy-body { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
  .spy-toast .spy-text { display: flex; flex-direction: column; gap: 2px; }
  .spy-toast .spy-text b { font-size: 1.4em; }
`;
// Glitch de las cartas cuánticas (sin medir): una ráfaga corta cada 5-8 s, desfasada por carta.
// Todo en em: escala con el tamaño de la carta. Se apaga con movimiento reducido y bajo el mouse.
const GLITCH_CSS = `
  .card.k-qubit .inner-canvas { animation: qglitch var(--gl-dur, 6s) steps(1, end) var(--gl-delay, 0s) infinite; }
  .card.k-qubit .inner-canvas::after {
    content: ""; position: absolute; left: 0; right: 0; top: -12%; height: 7%; z-index: 3;
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.28), rgba(255,255,255,0));
    mix-blend-mode: screen; opacity: 0; pointer-events: none;
    animation: qscan var(--gl-dur, 6s) linear var(--gl-delay, 0s) infinite;
  }
  .card.k-qubit .sym { animation: qglitch-sym var(--gl-dur, 6s) steps(1, end) var(--gl-delay, 0s) infinite; }
  .card.k-qubit:hover .inner-canvas, .card.k-qubit:hover .inner-canvas::after, .card.k-qubit:hover .sym { animation: none; }

  @keyframes qglitch {
    0%, 91.9% { transform: none; clip-path: none; filter: none; }
    92%   { transform: translate(-0.05em, 0); filter: drop-shadow(-0.07em 0 rgba(0, 255, 255, 0.75)) drop-shadow(0.07em 0 rgba(255, 40, 110, 0.75)); }
    93.4% { transform: translate(0.08em, 0); clip-path: inset(16% 0 64% 0); filter: drop-shadow(-0.07em 0 rgba(0, 255, 255, 0.75)) drop-shadow(0.07em 0 rgba(255, 40, 110, 0.75)); }
    94.8% { transform: translate(-0.06em, 0.02em); clip-path: inset(60% 0 12% 0); filter: hue-rotate(35deg) drop-shadow(0.07em 0 rgba(0, 255, 255, 0.75)) drop-shadow(-0.07em 0 rgba(255, 40, 110, 0.75)); }
    96.2% { transform: translate(0.03em, 0); clip-path: none; filter: drop-shadow(-0.05em 0 rgba(0, 255, 255, 0.6)) drop-shadow(0.05em 0 rgba(255, 40, 110, 0.6)); }
    97.4%, 100% { transform: none; clip-path: none; filter: none; }
  }
  @keyframes qglitch-sym {
    0%, 91.9% { text-shadow: none; }
    92%, 96.2% { text-shadow: -0.05em 0 rgba(0, 255, 255, 0.85), 0.05em 0 rgba(255, 40, 110, 0.85); }
    97.4%, 100% { text-shadow: none; }
  }
  @keyframes qscan {
    0%, 91.9% { top: -12%; opacity: 0; }
    92% { top: -12%; opacity: 1; }
    97% { top: 105%; opacity: 1; }
    97.5%, 100% { top: 105%; opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card.k-qubit .inner-canvas, .card.k-qubit .inner-canvas::after, .card.k-qubit .sym { animation: none; }
  }
`;
function ensureGlitchStyles() {
  if (document.getElementById('qards-glitch-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'qards-glitch-styles';
  tag.textContent = GLITCH_CSS;
  document.head.append(tag);
}

// Fase del glitch de una carta: depende del id y del reloj global, así no se reinicia (ni se sincroniza
// con las demás) cada vez que render() reconstruye la mano.
function glitchPhase(node, id) {
  const h = [...String(id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const dur = 5 + (h % 31) / 10; // 5.0 a 8.0 s entre ráfagas
  const phase = (performance.now() / 1000 + (h % 100) / 10) % dur;
  node.style.setProperty('--gl-dur', `${dur.toFixed(2)}s`);
  node.style.setProperty('--gl-delay', `-${phase.toFixed(2)}s`);
}

// Selector de color (comodines) y color vigente en el descarte.
const COLOR_CSS = `
  .hint-box .color-pick { display: none; gap: 10px; margin-top: 4px; }
  .hint-box.choosing { min-height: 150px; border-left-color: #e6b23a; }
  .hint-box.choosing .color-pick { display: flex; }
  .color-btn { width: 44px; height: 34px; padding: 0; cursor: pointer; border: 2px solid #0b0a09; box-shadow: 3px 3px 0 #0b0a09; }
  .color-btn:hover { filter: brightness(1.25); transform: translateY(-2px); }
  .color-btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
  .discard.has-color:not(.drop-target) { border-style: solid; border-color: var(--active-color); box-shadow: 0 0 16px var(--active-color); }
  .active-color { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #b9ad98; }
  .active-color .ac-dot { width: 11px; height: 11px; border: 2px solid #0b0a09; border-radius: 50%; }
`;
function ensureColorStyles() {
  if (document.getElementById('quards-color-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'quards-color-styles';
  tag.textContent = COLOR_CSS;
  document.head.append(tag);
}
const COLOR_LIST = ['red', 'blue', 'green', 'yellow'];

function ensureSpyStyles() {
  if (document.getElementById('qards-spy-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'qards-spy-styles';
  tag.textContent = SPY_CSS;
  document.head.append(tag);
}

// Limpieza de la instancia anterior: si mount() se llama de nuevo, no quedan listeners ni el fondo corriendo.
let teardownPrev = null;

export async function mount(root) {
  teardownPrev?.();
  const ac = new AbortController();
  let stopBg = () => {};
  teardownPrev = () => { ac.abort(); stopBg(); hideCircuitOverlay(); };
  ensureSpyStyles();
  ensureGlitchStyles();
  ensureColorStyles();
  ensureGateStyles();
  audio.armAudio();
  root.replaceChildren();

  const bg = el('canvas', { class: 'bg', width: 320, height: 180 });
  const crt = el('div', { class: 'crt' });
  try { stopBg = startBackground(bg); } catch (error) { warn(`fondo WebGL no disponible: ${error?.message ?? error}`); }

  const health = await quantum.ionqHealth().catch(() => ({ ok: false, hasKey: false }));
  const hasIonQ = !quantum.isQollab() && health.ok && health.hasKey;

  let state = rules.newGame({ seed: Date.now() % 100000 });
  let level = 'medium';
  let markPlayable = loadFlag(PLAYABLE_KEY);
  let pendingGate = null; // { gate, a }
  let spyMode = false;     // modo ojo: el próximo clic sobre una carta de la IA la espía
  let spyResult = null;    // { id, outcomes, prob0 }: lo último espiado, se muestra en el cartel
  const spied = new Map(); // id de carta del rival -> { outcomes, prob0 }: lo que ya espiaste (se marca con 👁)
  let selectedId = null;
  let press = null;
  let busy = false;
  let recent = []; // narraciones recientes (máx 3) que se muestran en el panel Info
  let inspectedGate = null; // tipo de puerta bajo el mouse (su descripción va en el panel de Info)
  let inspected = null; // { id, p }: carta bajo el mouse (resumen de estado en el panel de info)
  let leaveTimer = null; // da tiempo a llegar con el mouse al botón "Ver circuito"
  const probCache = new Map();
  const phaseCache = new Map();
  // La clave incluye el circuito y los bits ya medidos: no se mezcla entre partidas ni entre mediciones.
  const groupKey = g => JSON.stringify([g.id, g.ops, g.bits]);
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
  const turnEl = el('span', { class: 'turn' });
  const hintEl = el('p', { class: 'hint-text', role: 'note', 'aria-live': 'polite' });
  const hintTitleEl = el('span', { class: 'hint-title' }, 'Info');
  const stateEl = el('div', { class: 'hint-state' });
  const gateNextEl = el('p', { class: 'hint-sub' });
  const colorPickEl = el('div', { class: 'color-pick', role: 'group', 'aria-label': 'Elegí un color' });
  const activeColorEl = el('span', { class: 'active-color' });
  const hintBoxEl = el('div', { class: 'hint-box' }, hintTitleEl, hintEl, gateNextEl, stateEl, colorPickEl);
  hintBoxEl.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  hintBoxEl.addEventListener('pointerleave', () => { if (inspected) { inspected = null; renderState(); } });
  const drawBtn = el('button', { class: 'draw', type: 'button' }, 'Robar');
  const eyeBtn = el('button', { class: 'chip eye eye-big', type: 'button' });
  const eyeNextEl = el('span', { class: 'eye-next' });
  const spyToastEl = el('div', { class: 'spy-toast', role: 'status', 'aria-live': 'polite' });
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

  // Texto contextual del panel de info (en el centro de la mesa).
  function contextHint() {
    if (state.phase === 'choosing') return state.turn.current === 0 ? 'Jugaste un comodín: elegí el color con el que seguimos.' : 'La IA está eligiendo color…';
    if (state.phase === 'over') return state.winner === 'p1' ? 'Ganaste. Empezá una nueva partida cuando quieras.' : 'Ganó la IA. Probá otra vez.';
    if (!isHumanTurn()) return 'La IA está pensando… Pasá el mouse por tus cartas para ver su estado.';
    if (!rules.hasMove(state)) return 'No tenés jugadas posibles: robá una carta (botón debajo del mazo).';
    return 'Tu turno: jugá una carta o prepará con una puerta.';
  }

  // Narración para el panel Info: qué cara salió, con qué probabilidad y cómo quedó la jugada.
  // `bits` viene de la medición (null para cartas clásicas); `pct0` es P(|0⟩) en % antes de medir.
  function describeResult(id, bits, res, who, pct0 = null) {
    const c = state.cards[id];
    const verb = who === 'IA' ? 'La IA jugó' : 'Jugaste';
    let collapse = '';
    if (bits && c.qubit != null && bits[c.qubit] != null) {
      const bit = bits[c.qubit];
      const pct = pct0 == null ? null : Math.round(bit === 0 ? pct0 : 100 - pct0);
      collapse = ` — colapsó a |${bit}⟩${pct == null ? '' : ` (${pct}% de las veces)`}`;
    }
    const verdict = res?.won ? ' ✔ Ganó la partida.' : res?.valid ? ' ✔ Válida → descarte.' : ' ✘ Inválida: queda en la mano y roba 1.';
    return `${verb} ${rules.describeFace(c.face)}${collapse}.${verdict}`;
  }

  // Guarda una narración para el panel Info (quedan las últimas 3) y la manda también al panel Debug.
  function pushEvent(text) {
    if (!text) return;
    recent.push(text);
    if (recent.length > 3) recent.shift();
    log(text);
  }

  // Entrelazada = otro qubit de su grupo sigue sin medir. Su fase no es "de la carta sola".
  const isEntangled = c => !!c.group && state.groups[c.group].cards.some(x => x !== c.id && !state.cards[x].face);
  const fmtPhase = (ph, c) => (ph ? `${ph} |${ph}⟩` : (isEntangled(c) ? '— (entrelazada)' : '—'));

  // Resumen del estado de la carta bajo el mouse (probabilidades y fase), en el cuadro Info.
  function renderState() {
    if (inspectedGate) {
      hintBoxEl.classList.add('show-state');
      hintTitleEl.textContent = `Puerta ${inspectedGate.toUpperCase()}`;
      stateEl.replaceChildren(
        el('p', { class: 'gate-info' }, (GATE_HINT[inspectedGate] ?? '').replace(/^[A-Z]+: /, '')),
        el('p', { class: 'gate-info muted' }, isHumanTurn() ? 'Clic para usarla; clic de nuevo para cancelar.' : 'La podés usar en tu turno.'));
      return;
    }
    const c = inspected && state.cards[inspected.id];
    hintBoxEl.classList.toggle('show-state', !!c);
    if (!c) { hintTitleEl.textContent = 'Info'; stateEl.replaceChildren(); return; }
    const p0 = Math.round((inspected.p?.[0] ?? 0.5) * 100);
    const phaseTxt = fmtPhase(inspected.ph, c);
    hintTitleEl.textContent = 'Carta cuántica';
    const cid = inspected.id;
    stateEl.replaceChildren(
      ...[0, 1].map(i => el('div', { class: 'st-row' },
        el('span', { class: 'st-dot', style: `background:${FACE_COLOR[c.outcomes[i].color ?? 'grey'] ?? FACE_COLOR.grey}` }),
        el('span', { class: 'st-ket' }, `|${i}⟩`),
        el('span', { class: 'st-pct' }, `${i ? 100 - p0 : p0}%`),
        el('span', { class: 'st-face' }, symOf(c.outcomes[i])))),
      el('div', { class: 'st-row phase' },
        el('span', { class: 'st-ket' }, 'Fase'),
        el('span', { class: 'st-pct' }, phaseTxt)),
      ...(isEntangled(c) ? [el('p', { class: 'gate-info muted' }, 'Entrelazada: lo que se mida en otra carta de su grupo cambia estas probabilidades.')] : []),
      el('button', { class: 'ghost st-circuit', type: 'button', onclick: () => openCircuit(cid) }, 'Ver circuito'));
  }

  // Abre la pantalla con el circuito de la carta (Volver / Jugar).
  async function openCircuit(id) {
    const c = state.cards[id];
    if (!c?.group) return;
    const g = state.groups[c.group];
    let probs = null;
    try {
      const key = groupKey(g);
      if (!probCache.has(key)) probCache.set(key, await quantum.probabilidadesGrupo(g));
      probs = probCache.get(key);
    } catch (e) { warn(`circuito: ${e?.message ?? e}`); }
    showCircuitOverlay(g, {
      cardQubit: c.qubit,
      probs,
      canPlay: isHumanTurn() && rules.canPlay(state, id),
      onPlay: () => doPlay(id),
    });
  }

  async function probsFor(id) {
    const c = state.cards[id];
    if (!c.group) return null;
    const g = state.groups[c.group];
    if (g.bits?.[c.qubit] != null) return g.bits[c.qubit] === 0 ? [1, 0] : [0, 1];
    const key = groupKey(g);
    if (!probCache.has(key)) probCache.set(key, await quantum.probabilidadesGrupo(g));
    return probCache.get(key)[c.qubit];
  }

  // Signo de la fase de la carta: '+' o '−'. null si ya se midió, si está entrelazada o si no está definida.
  async function phaseFor(id) {
    const c = state.cards[id];
    if (!c.group || c.face || isEntangled(c)) return null;
    const g = state.groups[c.group];
    const key = groupKey(g);
    if (!phaseCache.has(key)) phaseCache.set(key, await quantum.probabilidadesFaseGrupo(g));
    const pp = phaseCache.get(key)?.[c.qubit];
    if (!pp || Math.abs(pp[0] - 0.5) < 1e-6) return null;
    return pp[0] > 0.5 ? '+' : '−';
  }

  async function cardEl(id, opts = {}) {
    const c = state.cards[id];
    const node = el('button', { type: 'button', class: `card k-${c.group && !c.face ? 'qubit' : 'classic'}` });
    node.dataset.id = id;
    if (opts.playable) node.classList.add('playable');
    if (opts.target) node.classList.add('gate-target');
    if (opts.selected) node.classList.add('selected');
    if (opts.facedown) { node.classList.add('facedown', 'back'); return node; }
    const grad = f => f.color ?? 'grey';
    let probs = null, phase = null;
    if (c.face) {
      mountQard(node, { kind: 'classic', color: opts.bgColor ?? grad(c.face), symbol: symOf(c.face) });
      if (c.group) probs = await probsFor(id); // carta FIJA: estado definido (100% en una cara), pero es un qubit
    } else {
      const p = probs = await probsFor(id);
      phase = await phaseFor(id);
      mountQard(node, {
        kind: 'quantum',
        color0: grad(c.outcomes[0]), sym0: symOf(c.outcomes[0]),
        color1: grad(c.outcomes[1]), sym1: symOf(c.outcomes[1]),
        prob0: Math.round((p?.[0] ?? 0.5) * 100),
        phase,
      });
    }
    if (c.group) {
      if (!c.face) glitchPhase(node, id); // solo las cartas en superposición glitchean
      const show = () => { clearTimeout(leaveTimer); inspected = { id, p: probs, ph: phase }; renderState(); };
      const leave = () => { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => { inspected = null; renderState(); }, 700); };
      node.addEventListener('pointerenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('pointerleave', leave);
      node.addEventListener('blur', leave);
    }
    if (opts.onPointerDown) node.addEventListener('pointerdown', event => opts.onPointerDown(id, event));
    return node;
  }

  // Probabilidad de la primera cara, para la carta fantasma del colapso.
  async function prob0Of(id) {
    try { const p = await probsFor(id); return Math.round((p?.[0] ?? 0.5) * 100); } catch { return 50; }
  }

  // Anima la carta jugada: vuela desde su posición al descarte. `ghost` es un clon
  // de la carta real (con la cara); si falta, se usa una carta boca abajo.
  function flyToDiscard(fromRect, ghost) {
    if (motionOff() || !fromRect?.width) return;
    const to = discardEl.getBoundingClientRect();
    if (!to.width) return;
    const node = ghost || el('div', { class: 'card facedown back' });
    node.removeAttribute('data-id');
    node.classList.remove('playable', 'selected', 'dragging', 'drop-target');
    node.classList.add('fly');
    node.style.position = 'fixed';
    node.style.setProperty('--card-w', `${fromRect.width}px`);
    node.style.setProperty('--qard-w', `${fromRect.width}px`);
    node.style.width = `${fromRect.width}px`;
    node.style.left = `${fromRect.left + fromRect.width / 2}px`;
    node.style.top = `${fromRect.top + fromRect.height / 2}px`;
    node.style.transform = 'translate(-50%, -50%)';
    const top = discardEl.querySelector('.card');
    const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = to.top + to.height / 2 - (fromRect.top + fromRect.height / 2);
    const scale = Math.max(0.3, to.width / fromRect.width);
    document.body.append(node);
    if (top) top.style.opacity = '0';
    node.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(-5deg)' },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale}) rotate(2deg)` },
      ],
      { duration: 320, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)', fill: 'forwards' },
    ).onfinish = () => {
      node.remove();
      if (top) top.style.opacity = '';
    };
  }

  // Reparto inicial: las cartas vuelan del mazo a cada mano, alternando jugador/IA.
  async function dealAnimation() {
    if (motionOff()) return;
    const oppCards = [...oppHandEl.querySelectorAll('.card')];
    const meCards = [...handEl.querySelectorAll('.card')];
    const n = Math.max(oppCards.length, meCards.length);
    if (!n) return;
    const step = 120;
    const all = [...oppCards, ...meCards];
    all.forEach(node => { node.style.opacity = '0'; });
    const jobs = [];
    let delay = 0;
    for (let i = 0; i < n; i++) {
      if (oppCards[i]) jobs.push({ node: oppCards[i], delay });
      delay += step;
      if (meCards[i]) jobs.push({ node: meCards[i], delay });
      delay += step;
    }
    for (const job of jobs) {
      const rect = job.node.getBoundingClientRect();
      audio.tick(job.delay / 1000);
      spawnFlyingCard(deckEl, rect, {
        delay: job.delay,
        width: rect.width,
        scaleEnd: 1,
        onFinish: () => { job.node.style.opacity = ''; },
      });
    }
    await sleep(delay + 460);
    all.forEach(node => { node.style.opacity = ''; });
  }

  // ---------- flujo ----------
  async function doPlay(id) {
    if (!isHumanTurn() || !rules.canPlay(state, id)) return;
    audio.blip();
    const srcNode = handEl.querySelector(`[data-id="${id}"]`);
    const srcRect = srcNode ? srcNode.getBoundingClientRect() : null;
    const ghost = srcNode ? srcNode.cloneNode(true) : null;
    const r = rules.play(state, id);
    selectedId = null; pendingGate = null;
    if (r.error) { await render(); return; }
    if (r.needsMeasure) {
      log(`Midiendo con ${quantum.kind()}…`);
      await render();
      try {
        const pct0 = await prob0Of(id);
        const bits = await playCollapse({
          state, group: r.needsMeasure, cardId: id,
          bitsPromise: quantum.medirGrupo(r.needsMeasure),
          symOf, prob0: pct0,
        });
        pushEvent(describeResult(id, bits, rules.resolveMeasure(state, bits), 'Tú', pct0));
      } catch (error) { warn(`medición falló: ${error?.message ?? error}`); }
    } else {
      pushEvent(describeResult(id, null, r, 'Tú'));
    }
    await render();
    if (state.discard[state.discard.length - 1] === id) flyToDiscard(srcRect, ghost);
    if (state.phase === 'over') audio.runChord(); else scheduleAI();
  }

  // Selector de color del comodín (humano). La IA elige sola con rules.autoColor.
  async function pickColor(color) {
    if (state.phase !== 'choosing' || state.turn.current !== 0) return;
    audio.blip();
    rules.chooseColor(state, color);
    await render();
    if (state.phase === 'over') audio.runChord(); else scheduleAI();
  }

  async function onGate(gate) {
    if (!isHumanTurn()) return;
    spyMode = false;
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

  async function onEye() {
    if (!isHumanTurn()) return;
    if (spyMode) spyMode = false;
    else if (state.players[0].spies > 0) {
      if (!state.players[1].hand.some(id => state.cards[id].group && !state.cards[id].face)) { hintEl.textContent = 'La IA no tiene cartas cuánticas sin medir para espiar.'; return; }
      spyMode = true; pendingGate = null; selectedId = null;
    }
    else { hintEl.textContent = 'No te quedan espías.'; return; }
    audio.tick();
    await render();
  }

  // Clic sobre una carta de la IA: espiarla (modo ojo) o elegirla de target de un CNOT.
  async function onRivalTap(id) {
    if (!isHumanTurn()) return;
    if (spyMode) {
      const r = rules.spyCard(state, id);
      spyMode = false;
      if (r.error) hintEl.textContent = r.error;
      else {
        // Carta completa: las dos caras y su probabilidad actual (la que ve su dueño).
        const p = await prob0Of(id);
        const info = { outcomes: r.outcomes, prob0: p };
        spyResult = { id, ...info }; spied.set(id, info); audio.blip();
      }
      await render();
      return;
    }
    if (pendingGate?.gate === 'cnot' && pendingGate.a !== null) {
      const r = rules.applyGate(state, 'cnot', pendingGate.a, id);
      pendingGate = null;
      if (r.error) hintEl.textContent = r.error;
      audio.blip();
      await render();
    }
  }

  function spiedLabel(info) {
    return `Espiada: |0⟩ ${rules.describeFace(info.outcomes[0])} (${info.prob0}%) · |1⟩ ${rules.describeFace(info.outcomes[1])} (${100 - info.prob0}%)`;
  }

  // Cartel con el resultado del ojo: el estado revelado y la carta asociada.
  function renderSpy() {
    if (spyResult && (state.phase !== 'play' || state.turn.current !== 0)) spyResult = null;
    spyToastEl.classList.toggle('show', !!spyResult);
    if (!spyResult) { spyToastEl.replaceChildren(); return; }
    const { outcomes: [o0, o1], prob0 } = spyResult;
    // La carta completa, como la ve su dueño: las dos caras y las probabilidades.
    const card = mountQard(el('div'), {
      kind: 'quantum', color0: o0.color ?? 'grey', sym0: symOf(o0), color1: o1.color ?? 'grey', sym1: symOf(o1), prob0,
    });
    card.style.setProperty('--qard-w', '104px');
    spyToastEl.replaceChildren(
      el('div', { class: 'spy-head' }, '👁 Espiaste una carta de la IA'),
      el('div', { class: 'spy-body' }, card,
        el('div', { class: 'spy-text' },
          el('b', {}, 'Carta completa'),
          el('span', {}, `|0⟩ ${rules.describeFace(o0)} · ${prob0}%`),
          el('span', {}, `|1⟩ ${rules.describeFace(o1)} · ${100 - prob0}%`))),
      el('button', { class: 'ghost', type: 'button', onclick: () => { spyResult = null; renderSpy(); } }, 'Cerrar'));
  }

  // ¿`id` puede ser el objetivo de la puerta pendiente? 'sup' apunta a cartas FIJAS (con cara); las
  // demás (x/z/h/cnot) apuntan a cartas sin colapsar.
  const esTargetPuerta = id => (pendingGate?.gate === 'sup' ? !!state.cards[id].face : !state.cards[id].face);

  async function onCardTap(id) {
    if (!isHumanTurn()) return;
    if (pendingGate && !esTargetPuerta(id)) pendingGate = null; // no es objetivo de la puerta: se libera y sigue como un clic normal
    if (pendingGate) {
      if (pendingGate.gate === 'cnot') {
        if (pendingGate.a === null) { pendingGate.a = id; audio.tick(); await render(); return; }
        if (pendingGate.a === id) { pendingGate.a = null; await render(); return; }
        const r = rules.applyGate(state, 'cnot', pendingGate.a, id);
        pendingGate = null;
        if (r.error) hintEl.textContent = r.error;
        audio.blip(); await render(); return;
      }
      const gate = pendingGate.gate;
      pendingGate = null;
      if (gate === 'sup') {
        // Preparación con animación: la carta fija se "abre" en superposición (ver superpose.js).
        const srcNode = handEl.querySelector(`[data-id="${id}"]`);
        const rect = srcNode?.getBoundingClientRect();
        const outcomes = state.cards[id].outcomes;
        const r = rules.applyGate(state, 'sup', id);
        if (r.error) { hintEl.textContent = r.error; audio.blip(); await render(); return; }
        audio.blip();
        await render();
        const live = handEl.querySelector(`[data-id="${id}"]`);
        if (live) live.style.opacity = '0'; // se oculta la carta ya superpuesta mientras corre la animación
        try { await playSuperpose({ rect, outcomes, symOf, prob0: 50 }); }
        catch (error) { warn(`superposición: ${error?.message ?? error}`); }
        if (live) live.style.opacity = '';
        return;
      }
      const r = rules.applyGate(state, gate, id);
      if (r.error) hintEl.textContent = r.error;
      audio.blip(); await render(); return;
    }
    if (rules.canPlay(state, id)) { selectedId = selectedId === id ? null : id; audio.tick(); await render(); return; }
    hintEl.textContent = 'Esa carta no es jugable ahora.';
  }

  function startPress(id, event) {
    if (!isHumanTurn()) return;
    const node = event.currentTarget;
    // Con una puerta pendiente, tocar una carta que no puede ser su objetivo la cancela (y la carta se juega normal).
    if (pendingGate && !esTargetPuerta(id)) pendingGate = null;
    press = { id, el: node, startX: event.clientX, startY: event.clientY, active: false, ghost: null, rect: node.getBoundingClientRect() };
    // La captura mantiene el seguimiento aunque el mouse salga de la carta (o de la ventana).
    try { node.setPointerCapture(event.pointerId); } catch { /* sin captura */ }
  }
  // `slack` agranda la zona de suelta para que no haya que apuntar con precisión.
  function isOver(event, node, slack = 0) {
    const r = node.getBoundingClientRect();
    return event.clientX >= r.left - slack && event.clientX <= r.right + slack && event.clientY >= r.top - slack && event.clientY <= r.bottom + slack;
  }
  function endDrag() {
    if (!press) return;
    press.ghost?.remove();
    press.el?.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    discardEl.classList.remove('drop-target');
  }
  function onPointerMove(event) {
    if (!press) return;
    if (!press.active && !pendingGate && rules.canPlay(state, press.id) && Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 6) {
      press.active = true;
      // Clon limpio: sin estados de la mano y con el mismo tamaño que la carta real
      // (el body no hereda el --card-w grande de la mano).
      const ghost = press.el.cloneNode(true);
      ghost.removeAttribute('data-id');
      ghost.classList.remove('dragging', 'playable', 'selected');
      ghost.classList.add('drag-ghost');
      const w = press.rect.width;
      ghost.style.setProperty('--card-w', `${w}px`);
      ghost.style.setProperty('--qard-w', `${w}px`);
      ghost.style.width = `${w}px`;
      press.ghost = ghost;
      document.body.append(ghost);
      press.el.classList.add('dragging');
      document.body.classList.add('is-dragging');
      inspected = null; renderState();
    }
    if (press.active) {
      press.ghost.style.left = `${event.clientX}px`;
      press.ghost.style.top = `${event.clientY}px`;
      discardEl.classList.toggle('drop-target', isOver(event, discardEl, 28));
    }
  }
  function onPointerUp(event) {
    if (!press) return;
    const p = press; press = null;
    if (p.active) {
      press = p; endDrag(); press = null;
      if (isOver(event, discardEl, 28)) doPlay(p.id);
      return;
    }
    onCardTap(p.id);
  }
  const winOpts = { signal: ac.signal };
  window.addEventListener('resize', () => { fitHand(handEl); fitHand(oppHandEl); }, winOpts);
  window.addEventListener('pointermove', onPointerMove, winOpts);
  window.addEventListener('pointerup', onPointerUp, winOpts);
  window.addEventListener('pointercancel', () => { endDrag(); press = null; }, winOpts);

  // Puerta u ojo en espera: un clic en cualquier lado que no sea un objetivo válido (o el propio control) lo cancela.
  async function releaseInteraction() {
    if (!pendingGate && !spyMode) return;
    pendingGate = null; spyMode = false;
    hintEl.textContent = '';
    audio.tick();
    await render();
  }
  function esObjetivoValido(target) {
    const cardNode = target.closest?.('.card');
    if (!cardNode) return false;
    if (cardNode.classList.contains('spy-target')) return true; // carta de la IA resaltada (ojo / target de CNOT)
    if (pendingGate && handEl.contains(cardNode)) return esTargetPuerta(cardNode.dataset.id);
    return false;
  }
  window.addEventListener('click', event => {
    if (!pendingGate && !spyMode) return;
    if (event.target.closest?.('.gate-card, .eye-big, .color-btn')) return; // estos controles se alternan solos
    if (esObjetivoValido(event.target)) return;
    releaseInteraction();
  }, winOpts);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') releaseInteraction(); }, winOpts);

  discardEl.addEventListener('click', async () => {
    if (!isHumanTurn()) return;
    if (selectedId && rules.canPlay(state, selectedId)) doPlay(selectedId);
    else hintEl.textContent = 'Elegí una carta de tu mano y soltala acá para jugarla.';
  });
  drawBtn.addEventListener('click', async () => { if (isHumanTurn() && !rules.hasMove(state)) { audio.blip(); rules.draw(state); await render(); scheduleAI(); } });
  eyeBtn.addEventListener('click', onEye);
  levelSel.addEventListener('change', () => { level = levelSel.value; });
  engineSel.addEventListener('change', () => { quantum.setEngine(engineSel.value); log(`motor → ${engineSel.value}`); render(); });
  newBtn.addEventListener('click', async () => {
    state = rules.newGame({ seed: Date.now() % 100000 });
    probCache.clear(); phaseCache.clear();
    recent = [];
    spyMode = false; spyResult = null; spied.clear();
    lastCounts = { me: state.players[0].hand.length, opp: state.players[1].hand.length };
    pendingGate = null; selectedId = null; busy = false;
    await render();
    dealAnimation();
  });

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
      let played = null; // { id, rect }: la carta que la IA juega al descarte
      if (action.type === 'gate') rules.applyGate(state, action.gate, action.a, action.b);
      else if (action.type === 'draw') { rules.draw(state); stepMs = AI_PLAY_MS; }
      else {
        const srcNode = oppHandEl.querySelector('.card');
        const rect = srcNode ? srcNode.getBoundingClientRect() : null;
        const r = rules.play(state, action.cardId);
        if (r.needsMeasure) {
          await render();
          try {
            const pct0 = await prob0Of(action.cardId);
            const bits = await playCollapse({
              state, group: r.needsMeasure, cardId: action.cardId,
              bitsPromise: quantum.medirGrupo(r.needsMeasure),
              symOf, prob0: pct0,
            });
            pushEvent(describeResult(action.cardId, bits, rules.resolveMeasure(state, bits), 'IA', pct0));
          } catch (e) { warn(`medición IA: ${e?.message ?? e}`); }
        } else if (r.valid !== undefined) {
          pushEvent(describeResult(action.cardId, null, r, 'IA'));
        }
        if (state.phase === 'choosing') rules.chooseColor(state, rules.autoColor(state, 1));
        played = { id: action.cardId, rect };
        stepMs = AI_PLAY_MS;
      }
      await render();
      if (played && state.discard[state.discard.length - 1] === played.id) flyToDiscard(played.rect, null);
      await sleep(stepMs);
    }
    busy = false; await render();
    if (state.phase === 'over') audio.runChord();
  }

  // ---------- render ----------
  // render() es async: si dos llamadas se solapan, ambas reconstruyen la mano a la vez y
  // se duplican cartas. Se serializan: una sola corre y las que llegan mientras tanto
  // piden UNA repetición al final (con el estado más nuevo).
  let rendering = null;
  let rerender = false;
  function render() {
    if (rendering) { rerender = true; return rendering; }
    rendering = (async () => {
      try { do { rerender = false; await renderNow(); } while (rerender); }
      finally { rendering = null; }
    })();
    return rendering;
  }

  async function renderNow() {
    clearTimeout(leaveTimer);
    inspectedGate = null;
    inspected = null; // los nodos de la mano se reconstruyen: se vuelve a fijar con el próximo hover
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
    debugCb.checked = isDebugVisible(); // sincroniza el checkbox con el panel (que puede cambiar solo, ante errores)

    // Cartas de la IA: boca abajo. Se pueden elegir (ojo o target de CNOT) sin exponer su id en el DOM.
    const rivalTargetable = isHumanTurn() && (spyMode || (pendingGate?.gate === 'cnot' && pendingGate.a !== null));
    oppHandEl.replaceChildren(...opp.hand.map(id => {
      const node = el('div', { class: 'card facedown back' });
      const info = spied.get(id);
      if (info) { node.classList.add('spied'); node.title = spiedLabel(info); node.append(el('span', { class: 'spy-mark' }, `👁 ${symOf(info.outcomes[0])}/${symOf(info.outcomes[1])}`)); }
      const esCuantica = !!state.cards[id].group && !state.cards[id].face;
      if (rivalTargetable && esCuantica) { node.classList.add('spy-target'); node.addEventListener('click', () => onRivalTap(id)); }
      return node;
    }));
    oppCountEl.textContent = `${opp.hand.length} · ${opp.gates.length}🔑`;

    deckEl.replaceChildren(el('span', { class: 'count' }, state.deck.length));
    discardEl.replaceChildren(await cardEl(state.discard[state.discard.length - 1]));
    // Color vigente: aro del color en el descarte + etiqueta (clave con comodines, que no tienen color propio).
    const choosingColor = state.phase === 'choosing';
    discardEl.classList.add('has-color');
    discardEl.style.setProperty('--active-color', FACE_COLOR[state.activeColor] ?? FACE_COLOR.grey);
    activeColorEl.replaceChildren(
      el('span', { class: 'ac-dot', style: `background:${FACE_COLOR[state.activeColor] ?? FACE_COLOR.grey}` }),
      choosingColor ? 'eligiendo color…' : `Color: ${rules.COLOR_ES[state.activeColor] ?? state.activeColor}`);
    const pickingNow = choosingColor && state.turn.current === 0;
    hintBoxEl.classList.toggle('choosing', pickingNow);
    colorPickEl.replaceChildren(...(pickingNow ? COLOR_LIST.map(color => el('button', {
      type: 'button', class: 'color-btn', title: rules.COLOR_ES[color], 'aria-label': rules.COLOR_ES[color],
      style: `background:${FACE_COLOR[color]}`, onclick: () => pickColor(color),
    })) : []));

    handEl.replaceChildren();
    const pods = new Map();
    for (const id of orderHand(state, me.hand)) {
      const isTarget = !!pendingGate && esTargetPuerta(id);
      // Con una puerta pendiente no se marca "jugable": el único resaltado es el objetivo de la puerta.
      const playable = !pendingGate && markPlayable && isHumanTurn() && rules.canPlay(state, id);
      const node = await cardEl(id, { playable, target: isTarget, selected: selectedId === id, onPointerDown: startPress });
      const group = entangledGroupOf(state, id, me.hand);
      if (!group) { handEl.append(el('div', { class: 'slot' }, node)); continue; }
      let pod = pods.get(group.id);
      if (!pod) {
        pod = el('div', { class: 'ent-group', title: 'Cartas entrelazadas: al medir una, cambian las probabilidades de las otras' });
        pods.set(group.id, pod);
        handEl.append(pod);
      }
      pod.append(el('div', { class: 'slot' }, node));
    }
    // Las puertas son cartas más de la mano (al final): así la fila de abajo no cambia con ni sin puertas.
    me.gates.forEach((gate, i) => {
      // Si hay varias del mismo tipo, solo la primera se marca como seleccionada.
      const active = !!pendingGate && pendingGate.gate === gate && me.gates.indexOf(gate) === i;
      const node = createGateCard(gate, { active, disabled: !isHumanTurn() });
      const show = () => { inspectedGate = gate; renderState(); };
      const hide = () => { if (inspectedGate === gate) { inspectedGate = null; renderState(); } };
      node.addEventListener('click', () => onGate(gate));
      node.addEventListener('pointerenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('pointerleave', hide);
      node.addEventListener('blur', hide);
      handEl.append(node);
    });
    fitHand(handEl);
    fitHand(oppHandEl);
    animateHandMoves(prevHandRects, handEl);

    // Próxima puerta: cadencia por turnos propios y tope en mano.
    const { cadaTurnos: cadaPuerta, maximo: maxPuertas } = rules.PUERTAS;
    if (me.gates.length >= maxPuertas) gateNextEl.textContent = `Puertas al tope (${maxPuertas}): usá alguna para recibir más.`;
    else if (cadaPuerta > 1) {
      const t = me.turns || 1;
      const falta = cadaPuerta - ((t - 1) % cadaPuerta);
      gateNextEl.textContent = `Próxima puerta: en ${falta} turno${falta === 1 ? '' : 's'} tuyo${falta === 1 ? '' : 's'}.`;
    } else gateNextEl.textContent = '';

    const spies = me.spies ?? 0;
    const { cadaTurnos, maximo } = rules.ESPIAR;
    const faltan = cadaTurnos > 0 && spies < maximo ? cadaTurnos - ((me.turns || 0) % cadaTurnos) : null;
    eyeBtn.replaceChildren(
      el('span', { class: 'eye-ico' }, '👁'),
      el('span', { class: 'eye-txt' }, 'Ojo', el('small', {}, spyMode ? 'Elegí una carta de la IA' : 'Espiar una carta de la IA')),
      el('span', { class: 'eye-count' }, `×${spies}`));
    eyeBtn.disabled = !isHumanTurn() || (spies <= 0 && !spyMode);
    eyeBtn.classList.toggle('active', spyMode);
    eyeBtn.title = `Espiar una carta de la IA (${spies} disponible${spies === 1 ? '' : 's'})`;
    eyeNextEl.textContent = faltan === null ? '' : `+1 en ${faltan} turno${faltan === 1 ? '' : 's'} tuyo${faltan === 1 ? '' : 's'}`;

    turnEl.textContent = state.phase === 'play' ? (state.turn.current === 0 ? 'Tu turno' : 'Turno de la IA…') : (state.phase === 'choosing' ? 'Elegí un color' : '');

    if (pendingGate) hintEl.textContent = GATE_HINT[pendingGate.gate];
    else if (spyMode) hintEl.textContent = 'Ojo: elegí una carta cuántica de la IA (las resaltadas) y te muestro la carta completa: las dos caras y sus probabilidades.';
    else if (selectedId) hintEl.textContent = 'Arrastrá la carta al descarte o clickeá el descarte para jugarla.';
    else if (recent.length) hintEl.textContent = recent.join('\n');
    else hintEl.textContent = contextHint();
    renderState();
    renderSpy();

    // Robar es la única jugada posible: el botón se enciende.
    const mustDraw = isHumanTurn() && !rules.hasMove(state);
    drawBtn.disabled = !mustDraw;
    drawBtn.classList.toggle('only-option', mustDraw);


    flyCards(deckEl, oppHandEl, grewOpp);
    flyCards(deckEl, handEl, grewMe);
  }

  const layout = el('div', { class: 'layout' },
    el('main', { class: 'board' },
      el('section', { class: 'opponent' },
        el('div', { class: 'sec-head' }, el('span', { class: 'label' }, 'IA'), oppCountEl),
        oppHandEl),
      el('section', { class: 'table' },
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Mazo'), deckEl, drawBtn),
        hintBoxEl,
        el('div', { class: 'pile' }, el('span', { class: 'label' }, 'Descarte'), discardEl, activeColorEl)),
      el('section', { class: 'mine' }, handEl),
      el('section', { class: 'gates-row' }, eyeBtn, eyeNextEl)));

  const app = el('div', { class: 'app' },
    el('header', {},
      el('div', { class: 'header-left' }, el('h1', {}, 'Qards'), badgeEl, turnEl),
      el('div', { class: 'header-right' },
        el('label', { class: 'toggle', title: 'Resaltar las cartas que podrían jugarse' }, markCb, 'Jugables'),
        el('label', { class: 'toggle', title: 'Mostrar el panel de debug' }, debugCb, 'Debug'),
        el('label', {}, 'IA ', levelSel), el('label', {}, 'Motor ', engineSel), newBtn)),
    layout);

  // Atribución exigida por el hackathon: queda visible en el proyecto mientras corre.
  const creditsEl = el('p', { class: 'credits' }, 'This effort is supported by Qollab & IonQ');

  root.append(bg, crt, app, creditsEl, spyToastEl);
  log(`Qards lista (motor ${quantum.kind()}).`);
  await render();
  await dealAnimation();
  scheduleAI();
}
