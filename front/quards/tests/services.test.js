import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, resolveMeasure, applyGate, draw, playableIds } from '../services/rules.js';
import { chooseAction } from '../services/ai.js';
import * as quantum from '../services/quantum.js';
import { checkState } from '../services/engine.js';

async function step(state, action) {
  if (action.type === 'gate') return applyGate(state, action.gate, action.a, action.b);
  if (action.type === 'draw') return draw(state);
  const r = play(state, action.cardId);
  if (r.needsMeasure) return resolveMeasure(state, await quantum.medirGrupo(r.needsMeasure));
  return r;
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
