// REGLAS Y TURNOS sobre el modelo del back (que no trae reglas).
// Todo muta `state` (como el motor del back). La app orquesta: jugar -> medir -> resolver.
import { createGame, aplicarPuerta1, aplicarCnot, otorgarPuerta, sortearPuerta, COLORS, MAX_QUBITS } from './engine.js';

const COLOR_ES = { red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo' };
const SYM_ES = { skip: 'salta', reverse: 'reversa', draw2: '+2', wild: 'comodín', wild4: '+4' };

// OJO (espiar la carta del rival). Cada jugador tiene `spies` cargas.
//   inicial:    cargas al empezar
//   cadaTurnos: cada cuántos turnos PROPIOS gana una carga (0 = no se recarga)
//   maximo:     tope de cargas acumuladas
// Variante "5 por partida": { inicial: 5, cadaTurnos: 0, maximo: 5 }.
export const ESPIAR = { inicial: 1, cadaTurnos: 2, maximo: 2 };
// Si es true, el target de un CNOT puede ser una carta de la mano del rival (el control sigue siendo tuyo).
export const CNOT_SOBRE_RIVAL = true;

export function newGame({ players = ['Tú', 'IA'], seed = Date.now() } = {}) {
  const state = createGame({ players, seed: seed | 0 });
  for (const p of state.players) { p.spies = ESPIAR.inicial; p.turns = 0; }
  state.players[state.turn.current].turns = 1; // el primer turno ya empezó
  state.log = [`Partida nueva. Turno de ${state.players[0].name}; recibe una puerta.`];
  return state;
}

export const playerOf = state => state.players[state.turn.current];
export const topCard = state => state.cards[state.discard[state.discard.length - 1]];
export const topFace = state => topCard(state).face;

export function describeFace(f) {
  if (!f) return '?';
  return `${f.color ? COLOR_ES[f.color] + ' ' : ''}${SYM_ES[f.symbol] ?? f.symbol}`;
}

export function possibleFaces(state, id) {
  const c = state.cards[id];
  return c.face ? [c.face] : (c.outcomes || []);
}

export function describe(state, id) {
  const c = state.cards[id];
  return c.face ? describeFace(c.face) : (c.outcomes ? c.outcomes.map(describeFace).join(' / ') : '?');
}

function log(state, msg) { (state.log ||= []).push(msg); }

const isWild = f => f.symbol === 'wild' || f.symbol === 'wild4';

export function canPlay(state, id) {
  const faces = possibleFaces(state, id);
  if (faces.some(isWild)) return true;
  const top = topFace(state);
  return faces.some(f => f.color === state.activeColor || f.symbol === top.symbol);
}

export const playableIds = (state, player = state.turn.current) => state.players[player].hand.filter(id => canPlay(state, id));
export const hasMove = (state, player = state.turn.current) => playableIds(state, player).length > 0;

// Aplica una puerta de la mano del jugador activo (preparación libre).
export function applyGate(state, gate, a, b) {
  const p = playerOf(state);
  const i = p.gates.indexOf(gate);
  if (i < 0) return { error: `No tenés una puerta ${String(gate).toUpperCase()}` };
  if (!p.hand.includes(a)) return { error: 'La carta no está en tu mano' };
  if (state.cards[a].face) return { error: 'Esa carta ya colapsó' };
  if (gate === 'cnot') {
    const rival = state.players[1 - state.turn.current];
    const enRival = CNOT_SOBRE_RIVAL && rival.hand.includes(b);
    if (!p.hand.includes(b) && !enRival) return { error: 'El target no está en tu mano' };
    if (a === b) return { error: 'Control y target deben ser distintos' };
    // Con una carta del rival el mensaje es neutro: no revela si ya tiene cara fija.
    if (state.cards[b].face) return { error: enRival ? 'Esa carta no admite el CNOT' : 'El target ya colapsó' };
    const ga = state.groups[state.cards[a].group], gb = state.groups[state.cards[b].group];
    if (ga !== gb && ga.qubits + gb.qubits > MAX_QUBITS) return { error: `El grupo superaría ${MAX_QUBITS} qubits` };
    aplicarCnot(state.cards, state.groups, a, b);
  } else {
    aplicarPuerta1(state.cards, state.groups, a, gate);
  }
  p.gates.splice(i, 1);
  log(state, `${p.name} aplica ${gate.toUpperCase()} a ${describe(state, a)}`);
  return { ok: true };
}

// Espía una carta de la mano del rival. Gasta una carga y revela UNO de sus estados posibles (al azar,
// con la semilla de la partida) junto con la cara asociada. No mide ni cambia nada de la carta.
// Devuelve { ok, id, k, face }: k = 0 o 1 (estado revelado), o null si la carta ya tiene cara fija.
export function spyCard(state, id) {
  const p = playerOf(state);
  const rival = state.players[1 - state.turn.current];
  if (!(p.spies > 0)) return { error: 'No te quedan espías' };
  if (!rival.hand.includes(id)) return { error: 'Elegí una carta del rival' };
  const c = state.cards[id];
  p.spies--;
  log(state, `${p.name} espía una carta de ${rival.name}`);
  if (c.face) return { ok: true, id, k: null, face: c.face };
  const r = sortearPuerta(state.rng.seed, [0, 1]);
  state.rng.seed = r.seed;
  return { ok: true, id, k: r.gate, face: c.outcomes[r.gate] };
}

// Juega una carta. Con cara fija (clásica o ya medida) -> resuelve ya, sin volver a medir.
// Cuántica sin medir -> pide medir su qubit.
export function play(state, id) {
  if (!canPlay(state, id)) return { error: 'Esa carta no se puede jugar ahora' };
  const c = state.cards[id];
  if (c.face) return resolvePlay(state, id, c.face);
  state.pending = { cardId: id, player: state.turn.current };
  state.phase = 'measuring';
  return { needsMeasure: state.groups[c.group] };
}

// Aplica el resultado de la medición y resuelve la jugada. La medición es PARCIAL: solo se revela
// la carta jugada. Las otras cartas del grupo (p. ej. el target de un CNOT) siguen en superposición,
// pero condicionadas: g.bits fija el bit medido y las probabilidades se calculan a partir de él.
export function resolveMeasure(state, bits) {
  const { cardId } = state.pending;
  const card = state.cards[cardId];
  const g = state.groups[card.group];
  if (!card.face) {
    if (!g.bits) g.bits = Array(g.qubits).fill(null);
    g.bits[card.qubit] = bits[card.qubit];
    card.face = card.outcomes[bits[card.qubit]];
    g.collapsed = g.bits.every((b) => b !== null);
  }
  state.pending = null;
  state.phase = 'play';
  return resolvePlay(state, cardId, card.face);
}

function resolvePlay(state, cardId, face) {
  const player = state.turn.current;
  const p = state.players[player];
  const top = topFace(state);
  const valid = isWild(face) || face.color === state.activeColor || face.symbol === top.symbol;

  if (!valid) {
    drawCards(state, player, 1); // penalización: la carta queda colapsada en la mano y roba 1
    log(state, `${p.name} jugó ${describeFace(face)} (inválida): roba una carta`);
    advance(state, false);
    return { valid: false };
  }

  p.hand.splice(p.hand.indexOf(cardId), 1);
  state.discard.push(cardId);
  state.activeColor = isWild(face) ? chooseWildColor(state, player) : face.color;

  const sym = face.symbol;
  let skip = false;
  if (sym === 'skip' || sym === 'reverse') skip = true;
  if (sym === 'draw2') { drawCards(state, 1 - player, 2); skip = true; }
  if (sym === 'wild4') { drawCards(state, 1 - player, 4); skip = true; }

  log(state, `${p.name} jugó ${describeFace(face)} (válida)${isWild(face) ? ` → color ${COLOR_ES[state.activeColor]}` : ''}`);
  if (p.hand.length === 0) { state.phase = 'over'; state.winner = p.id; log(state, `${p.name} gana`); return { valid: true, won: true }; }
  advance(state, skip);
  return { valid: true };
}

function advance(state, skip) {
  if (!skip) state.turn.current = 1 - state.turn.current;
  otorgarPuerta(state);
  recargarEspia(state);
  log(state, `Turno de ${state.players[state.turn.current].name} (recibe una puerta)`);
}

// Al empezar un turno, el jugador activo cuenta un turno propio y, cada `cadaTurnos`, gana una carga del ojo.
function recargarEspia(state) {
  const p = playerOf(state);
  p.turns = (p.turns || 0) + 1;
  if (ESPIAR.cadaTurnos > 0 && p.turns % ESPIAR.cadaTurnos === 0) p.spies = Math.min(ESPIAR.maximo, (p.spies || 0) + 1);
}

function chooseWildColor(state, player) {
  const counts = {};
  for (const id of state.players[player].hand) for (const f of possibleFaces(state, id)) if (f.color) counts[f.color] = (counts[f.color] || 0) + 1;
  let best = COLORS[0], n = -1;
  for (const c of COLORS) if ((counts[c] || 0) > n) { n = counts[c] || 0; best = c; }
  return best;
}

export function draw(state) {
  if (hasMove(state)) return { error: 'Todavía podés jugar una carta' };
  drawCards(state, state.turn.current, 1);
  log(state, `${playerOf(state).name} roba una carta`);
  advance(state, false);
  return { ok: true };
}

function drawCards(state, player, n) {
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) reshuffle(state);
    const id = state.deck.pop();
    if (id) state.players[player].hand.push(id);
  }
}

function reshuffle(state) {
  const top = state.discard.pop();
  state.deck.push(...state.discard);
  state.discard = top ? [top] : [];
}
