// General n-qubit statevector simulator (n <= 4). This is the "fake" source's
// engine and also the source of the ideal distribution the UI shows.
//
// Bit order matches Qiskit: qubit 0 is the least significant bit of the state
// index, so the measured key prints as q(n-1)...q1q0 (little-endian string).
import { c, add, mul, abs2 } from './complex.js';

const S2 = 1 / Math.SQRT2;

export const SINGLE_GATES = {
  i: [[c(1), c(0)], [c(0), c(1)]],
  x: [[c(0), c(1)], [c(1), c(0)]],
  y: [[c(0), c(0, -1)], [c(0, 1), c(0)]],
  z: [[c(1), c(0)], [c(0), c(-1)]],
  h: [[c(S2), c(S2)], [c(S2), c(-S2)]],
  s: [[c(1), c(0)], [c(0), c(0, 1)]],
  sdg: [[c(1), c(0)], [c(0), c(0, -1)]],
  t: [[c(1), c(0)], [c(0), c(S2, S2)]],
};

export const GATE_LABEL = { h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', sdg: 'S†', t: 'T', cx: 'CX' };

export function zeroState(n) {
  const dim = 1 << n;
  const v = Array.from({ length: dim }, () => c(0));
  v[0] = c(1);
  return v;
}

function clone(state) {
  return state.map(a => [a[0], a[1]]);
}

// Applies a 1-qubit gate to `target`. Qubit q lives in bit q of the index.
export function applyGate(state, n, gate, target) {
  const m = SINGLE_GATES[gate];
  if (!m) throw new Error(`Unknown gate: ${gate}`);
  const dim = 1 << n;
  const out = clone(state);
  const bit = 1 << target;
  for (let i = 0; i < dim; i++) {
    if (i & bit) continue;
    const j = i | bit;
    out[i] = add(mul(m[0][0], state[i]), mul(m[0][1], state[j]));
    out[j] = add(mul(m[1][0], state[i]), mul(m[1][1], state[j]));
  }
  return out;
}

// Controlled-X: flip target whenever control is 1.
export function applyCX(state, n, control, target) {
  const dim = 1 << n;
  const out = clone(state);
  const cb = 1 << control;
  const tb = 1 << target;
  for (let i = 0; i < dim; i++) {
    if (!(i & cb) || i & tb) continue;
    const j = i ^ tb;
    out[i] = [state[j][0], state[j][1]];
    out[j] = [state[i][0], state[i][1]];
  }
  return out;
}

// Controlled-Z: -1 phase when both are 1.
export function applyCZ(state, n, control, target) {
  const dim = 1 << n;
  const out = clone(state);
  const cb = 1 << control;
  const tb = 1 << target;
  for (let i = 0; i < dim; i++) {
    if ((i & cb) && (i & tb)) out[i] = [-state[i][0], -state[i][1]];
  }
  return out;
}

// ops: [{ gate, target } | { gate:'cx'|'cz', control, target }]
export function stateFromOps(n, ops) {
  let state = zeroState(n);
  for (const op of ops) {
    if (op.gate === 'cx') state = applyCX(state, n, op.control, op.target);
    else if (op.gate === 'cz') state = applyCZ(state, n, op.control, op.target);
    else state = applyGate(state, n, op.gate, op.target);
  }
  return state;
}

export const probabilities = state => state.map(abs2);

export function sampleIndex(probs, rng = Math.random) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1;
}

// Little-endian key (q0 rightmost), same shape as Qiskit's count keys.
export const bits = (index, n) => index.toString(2).padStart(n, '0');

export function sampleCounts(state, n, shots, rng = Math.random) {
  const probs = probabilities(state);
  const counts = {};
  for (let s = 0; s < shots; s++) {
    const key = bits(sampleIndex(probs, rng), n);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
