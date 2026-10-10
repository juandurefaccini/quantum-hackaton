import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zeroState, stateFromOps, applyGate, probabilities, sampleCounts, bits,
} from '../quantum/statevector.js';
import { abs2 } from '../quantum/complex.js';
import { mulberry32 } from '../quantum/rng.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const total = probs => probs.reduce((s, p) => s + p, 0);

test('zeroState is a normalized |0...0>', () => {
  const s = zeroState(3);
  assert.equal(s.length, 8);
  close(abs2(s[0]), 1);
  close(total(probabilities(s)), 1);
});

test('X flips |0> to |1>', () => {
  const s = applyGate(zeroState(1), 1, 'x', 0);
  close(abs2(s[1]), 1);
  close(abs2(s[0]), 0);
});

test('H makes 50/50', () => {
  const p = probabilities(applyGate(zeroState(1), 1, 'h', 0));
  close(p[0], 0.5);
  close(p[1], 0.5);
});

test('HZH acts like X (phase matters only through H)', () => {
  let s = zeroState(1);
  s = applyGate(s, 1, 'h', 0);
  s = applyGate(s, 1, 'z', 0);
  s = applyGate(s, 1, 'h', 0);
  close(abs2(s[1]), 1);
});

test('S and T add the expected phases on |1>', () => {
  const s = applyGate(applyGate(zeroState(1), 1, 'x', 0), 1, 's', 0);
  close(s[1][0], 0); close(s[1][1], 1);
  const t = applyGate(applyGate(zeroState(1), 1, 'x', 0), 1, 't', 0);
  close(t[1][0], 1 / Math.SQRT2); close(t[1][1], 1 / Math.SQRT2);
});

test('Bell state correlates q0 and q1', () => {
  const s = stateFromOps(2, [{ gate: 'h', target: 0 }, { gate: 'cx', control: 0, target: 1 }]);
  close(abs2(s[0]), 0.5); // 00
  close(abs2(s[3]), 0.5); // 11
  for (const i of [1, 2]) close(abs2(s[i]), 0);
});

test('GHZ(3) only yields 000 and 111', () => {
  const s = stateFromOps(3, [
    { gate: 'h', target: 0 },
    { gate: 'cx', control: 0, target: 1 },
    { gate: 'cx', control: 1, target: 2 },
  ]);
  close(abs2(s[0]), 0.5); // 000
  close(abs2(s[7]), 0.5); // 111
});

test('H on every qubit is uniform', () => {
  const s = stateFromOps(3, [0, 1, 2].map(target => ({ gate: 'h', target })));
  for (const p of probabilities(s)) close(p, 1 / 8);
});

test('bit order is little-endian like Qiskit keys', () => {
  assert.equal(bits(0b110, 3), '110');
  assert.equal(bits(1, 3), '001');
});

test('sampling only emits reachable states', () => {
  const s = stateFromOps(2, [{ gate: 'h', target: 0 }, { gate: 'cx', control: 0, target: 1 }]);
  const counts = sampleCounts(s, 2, 200, mulberry32(42));
  for (const key of Object.keys(counts)) assert.ok(key === '00' || key === '11', key);
});
