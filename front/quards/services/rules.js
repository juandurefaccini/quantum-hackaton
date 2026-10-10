// REGLAS Y TURNOS sobre el modelo del back (que no trae reglas).
// Todo muta `state` (como el motor del back). La app orquesta: jugar -> medir -> resolver.
import { createGame, aplicarPuerta1, aplicarCnot, otorgarPuerta, COLORS, MAX_QUBITS } from './engine.js';

const COLOR_ES = { red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo' };
const SYM_ES = { skip: 'salta', reverse: 'reversa', draw2: '+2', wild: 'comodín', wild4: '+4' };

export function newGame({ players = ['Tú', 'IA'], seed = Date.now() } = {}) {
  const state = createGame({ players, seed: seed | 0 });
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
    if (!p.hand.includes(b)) return { error: 'El target no está en tu mano' };
    if (a === b) return { error: 'Control y target deben ser distintos' };
    if (state.cards[b].face) return { error: 'El target ya colapsó' };
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

// Juega una carta. Clásica -> resuelve ya. Cuántica -> pide medir su grupo.
export function play(state, id) {
  if (!canPlay(state, id)) return { error: 'Esa carta no se puede jugar ahora' };
  const c = state.cards[id];
  if (!c.group) return resolvePlay(state, id, c.face);
  state.pending = { cardId: id, player: state.turn.current };
  state.phase = 'measuring';
  return { needsMeasure: state.groups[c.group] };
}

// Aplica el resultado de la medición del grupo pendiente y resuelve la jugada.
export function resolveMeasure(state, bits) {
  const { cardId } = state.pending;
  const g = state.groups[state.cards[cardId].group];
  g.collapsed = true;
  g.bits = bits;
  for (const cid of g.cards) state.cards[cid].face = state.cards[cid].outcomes[bits[state.cards[cid].qubit]];
  state.pending = null;
  state.phase = 'play';
  return resolvePlay(state, cardId, state.cards[cardId].face);
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
  if (sym === 'draw2') drawCards(state, 1 - player, 2);
  if (sym === 'wild4') { drawCards(state, 1 - player, 4); skip = true; }

  log(state, `${p.name} jugó ${describeFace(face)} (válida)${isWild(face) ? ` → color ${COLOR_ES[state.activeColor]}` : ''}`);
  if (p.hand.length === 0) { state.phase = 'over'; state.winner = p.id; log(state, `${p.name} gana`); return { valid: true, won: true }; }
  advance(state, skip);
  return { valid: true };
}

function advance(state, skip) {
  if (!skip) state.turn.current = 1 - state.turn.current;
  otorgarPuerta(state);
  log(state, `Turno de ${state.players[state.turn.current].name} (recibe una puerta)`);
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
