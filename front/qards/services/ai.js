// IA sobre el modelo del back. Devuelve un descriptor de acción; el driver lo
// aplica. Puede devolver preparación (gate) y el driver la repite hasta que juegue/robe.
import * as quantum from './quantum.js';
import { clone, aplicarPuerta1, aplicarCnot } from './engine.js';
import { playableIds, topFace } from './rules.js';

const isWild = f => f.symbol === 'wild' || f.symbol === 'wild4';

// P(que la cara medida de la carta coincida con el descarte).
async function matchProbability(state, id) {
  const c = state.cards[id];
  const top = topFace(state);
  const ok = f => isWild(f) || f.color === state.activeColor || f.symbol === top.symbol;
  if (c.face) return ok(c.face) ? 1 : 0;
  const p = await quantum.probabilidadCarta(state, id);
  return (ok(c.outcomes[0]) ? p[0] : 0) + (ok(c.outcomes[1]) ? p[1] : 0);
}

async function bestProb(state, player) {
  let best = 0;
  for (const id of state.players[player].hand) best = Math.max(best, await matchProbability(state, id));
  return best;
}

// Mejor preparación (gate) que mejora la mejor P(partido). Null si ninguna mejora.
async function bestPrep(state, player) {
  const p = state.players[player];
  if (!p.gates.length) return null;
  const before = await bestProb(state, player);
  const targets = p.hand.filter(id => !state.cards[id].face);
  for (const gate of p.gates) {
    for (const a of targets) {
      if (gate === 'cnot') {
        for (const b of targets) {
          if (a === b) continue;
          const trial = clone(state);
          try { aplicarCnot(trial.cards, trial.groups, a, b); } catch { continue; }
          if (await bestProb(trial, player) > before + 1e-9) return { type: 'gate', gate, a, b };
        }
      } else {
        const trial = clone(state);
        try { aplicarPuerta1(trial.cards, trial.groups, a, gate); } catch { continue; }
        if (await bestProb(trial, player) > before + 1e-9) return { type: 'gate', gate, a };
      }
    }
  }
  return null;
}

export async function chooseAction(state, player, level = 'medium') {
  if (state.phase !== 'play' || state.winner !== null) return null;
  const ids = playableIds(state, player);

  if (level === 'hard') {
    const prep = await bestPrep(state, player);
    if (prep) return prep;
  }
  if (!ids.length) return { type: 'draw' };
  if (level === 'easy') return { type: 'play', cardId: ids[Math.floor(Math.random() * ids.length)] };

  let best = ids[0], bp = -1;
  for (const id of ids) { const p = await matchProbability(state, id); if (p > bp) { bp = p; best = id; } }
  return { type: 'play', cardId: best };
}
