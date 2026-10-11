import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, resolveMeasure, applyGate, draw, playableIds, chooseColor, autoColor } from '../services/rules.js';
import { chooseAction } from '../services/ai.js';
import * as quantum from '../services/quantum.js';
import { checkState } from '../services/engine.js';
import { distribucion } from '../../../back/quantum/referencia.js';

async function step(state, action) {
  if (action.type === 'gate') return applyGate(state, action.gate, action.a, action.b);
  if (action.type === 'draw') return draw(state);
  const r = play(state, action.cardId);
  const out = r.needsMeasure ? resolveMeasure(state, await quantum.medirGrupo(r.needsMeasure)) : r;
  // Un comodín jugado deja la partida en fase 'choosing' hasta que alguien elige el color
  // (puede salir de una carta cuántica medida). En IA vs IA elige el jugador activo con autoColor().
  if (state.phase === 'choosing') return chooseColor(state, autoColor(state, state.turn.current));
  return out;
}

test('newGame: 7 cartas, una puerta para el primero, coherencia OK', () => {
  const s = newGame({ seed: 1 });
  assert.equal(s.players[0].hand.length, 7);
  assert.equal(s.players[1].hand.length, 7);
  assert.equal(s.players[0].gates.length, 1);
  assert.equal(s.phase, 'play');
  assert.deepEqual(checkState(s), []);
});

test('aplicar una puerta no cierra el turno y la consume de la mano', () => {
  const s = newGame({ seed: 2 });
  s.players[0].gates.push('h'); // forzamos una puerta conocida
  const target = s.players[0].hand.find(id => !s.cards[id].face && s.cards[id].group);
  const before = s.players[0].gates.length;
  const r = applyGate(s, 'h', target);
  assert.equal(r.ok, true);
  assert.equal(s.players[0].gates.length, before - 1);
  assert.equal(s.turn.current, 0); // no cerró el turno
  assert.deepEqual(checkState(s), []);
});

test('aplicar una puerta que no tenés falla', () => {
  const s = newGame({ seed: 3 });
  const r = applyGate(s, 'cnot', s.players[0].hand[0], s.players[0].hand[1]);
  assert.ok(r.error);
});

test('jugar una carta mide y mantiene la coherencia', async () => {
  const s = newGame({ seed: 4 });
  const ids = playableIds(s);
  if (ids.length) await step(s, { type: 'play', cardId: ids[0] });
  else draw(s);
  assert.equal(s.phase, 'play');
  assert.deepEqual(checkState(s), []);
});

// La fase es la parte genuinamente cuántica del juego: Z no cambia las probabilidades visibles, pero
// una H posterior convierte esa fase en probabilidad. Verificamos la identidad H·Z·H ≡ X en el
// simulador de referencia y contra los valores del Statevector de Qiskit (capturados con qiskit 2.5.2).
// Ver también examples/qards_circuit.py (el lado Qiskit de esta misma comparación).
test('H·Z·H ≡ X: la fase se vuelve probabilidad (coincide con Qiskit Statevector)', () => {
  const z = 0.6; // carta preparada con P(0) = (1+z)/2 = 0.8
  const theta = Math.atan2(Math.sqrt(1 - z * z), z);
  const hzh = distribucion({ qubits: 1, ops: [['ry', theta, 0], ['h', 0], ['z', 0], ['h', 0]] });
  const x = distribucion({ qubits: 1, ops: [['ry', theta, 0], ['x', 0]] });
  // H·Z·H ≡ X: mismas probabilidades
  for (let i = 0; i < hzh.length; i++) assert.ok(Math.abs(hzh[i] - x[i]) < 1e-12);
  // Valores de Qiskit 2.5.2 (Statevector.probabilities()): H·Z·H = [0.2, 0.8]
  assert.ok(Math.abs(hzh[0] - 0.2) < 1e-9);
  assert.ok(Math.abs(hzh[1] - 0.8) < 1e-9);
  // Z sola (sin H) NO cambia las probabilidades: la fase es invisible hasta que una H la revela.
  const zOnly = distribucion({ qubits: 1, ops: [['ry', theta, 0], ['z', 0]] });
  assert.ok(Math.abs(zOnly[0] - 0.8) < 1e-12);
});

// Todas las cartas son qubits: las "fijas" se ven de una cara pero guardan una cara OCULTA y un grupo.
test('todas las cartas son qubits y las fijas tienen cara oculta', () => {
  const s = newGame({ seed: 12 });
  for (const id of Object.keys(s.cards)) {
    const c = s.cards[id];
    assert.ok(c.group, `${id} no tiene grupo`);
    assert.ok(c.outcomes, `${id} no tiene outcomes`);
    if (c.face) assert.equal(s.groups[c.group].bits[c.qubit], 0, `${id} fija no nace en |0⟩`);
  }
  assert.deepEqual(checkState(s), []);
});

// La puerta de superposición ('sup') reabre una carta fija: la deja 50/50 entre sus dos caras.
test('sup reabre una carta fija (50/50) y mantiene la coherencia', async () => {
  const s = newGame({ seed: 11 });
  const fija = s.players[0].hand.find(id => s.cards[id].face && s.cards[id].outcomes);
  assert.ok(fija, 'debe haber una carta fija en la mano');
  const c = s.cards[fija];
  s.players[0].gates.push('sup');
  const r = applyGate(s, 'sup', fija);
  assert.equal(r.ok, true);
  assert.equal(c.face, null);
  assert.deepEqual(s.groups[c.group].bits, [null]);
  assert.deepEqual(s.groups[c.group].ops, [['sup', 0]]);
  const p = await quantum.probabilidadesGrupo(s.groups[c.group]);
  assert.ok(Math.abs(p[0][0] - 0.5) < 1e-9, 'debe quedar 50/50');
  assert.deepEqual(checkState(s), []);
  // Ya en superposición: la puerta no aplica.
  s.players[0].gates.push('sup');
  assert.ok(applyGate(s, 'sup', fija).error);
});

for (const level of ['easy', 'medium', 'hard']) {
  test(`partidas IA vs IA terminan con ganador y coherencia (${level})`, async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame({ seed });
      let m = 0;
      while (s.phase !== 'over' && m < 4000) {
        const action = await chooseAction(s, s.turn.current, level);
        if (!action) break;
        await step(s, action);
        m++;
      }
      assert.equal(s.phase, 'over', `seed ${seed} no terminó (${m} mov)`);
      assert.ok(s.winner === 'p1' || s.winner === 'p2');
      assert.deepEqual(checkState(s), [], `seed ${seed} incoherente`);
    }
  });
}
