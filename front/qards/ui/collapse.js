// ANIMACIÓN DE MEDICIÓN (COLAPSO).
// Cuando una carta cuántica se juega, el grupo se mide: el resultado lo decide el
// puerto cuántico (referencia/IonQ/Qiskit). Acá se hace visible ese momento:
//   1) "midiendo"  → barrido sobre la carta y los kets |0⟩/|1⟩ alternando.
//   2) "colapso"   → la superposición se cae sobre la cara ganadora y aparece |bit⟩.
// La medición corre en paralelo: si es remota (IonQ), el barrido dura lo que tarde
// la red. Al terminar devuelve los bits medidos.
import { mountQard } from './qard.js';

const MEASURE_MS = 900;  // barrido mínimo de "midiendo"
const COLLAPSE_MS = 720; // caída al bit
const SETTLE_MS = 520;   // se deja ver el resultado

const sleep = ms => new Promise(r => setTimeout(r, ms));
const prefersReduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function span(cls, value) {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = value;
  return s;
}

function buildOverlay({ card, anchor, symOf, prob0 }) {
  const rect = anchor.getBoundingClientRect();
  const w = Math.max(Math.round(rect.width) || 96, 72);

  const overlay = document.createElement('div');
  overlay.className = 'collapse-fx';
  overlay.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  overlay.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
  overlay.style.setProperty('--card-w', `${w}px`);

  const stage = document.createElement('div');
  stage.className = 'cc-stage';

  // Carta fantasma: clona la carta real (misma estética) si está en el tablero;
  // si no (p.ej. la IA juega desde su mano boca abajo), la arma desde sus caras.
  const real = document.querySelector(`[data-id="${card.id}"]`);
  let ghost;
  if (real) {
    ghost = real.cloneNode(true);
    ghost.removeAttribute('data-id');
    ghost.classList.remove('playable', 'selected', 'dragging');
    ghost.style.transform = '';
  } else {
    ghost = mountQard(document.createElement('div'), {
      kind: 'quantum',
      color0: card.outcomes[0].color ?? 'grey', sym0: symOf(card.outcomes[0]),
      color1: card.outcomes[1].color ?? 'grey', sym1: symOf(card.outcomes[1]),
      prob0,
    });
  }
  ghost.classList.add('card', 'cc-card');

  const scan = document.createElement('div');
  scan.className = 'cc-scan';
  const kets = document.createElement('div');
  kets.className = 'cc-kets';
  kets.append(span('cc-ket ket0', '|0⟩'), span('cc-ket ket1', '|1⟩'));
  const result = document.createElement('div');
  result.className = 'cc-result';
  result.append(span('', '|0⟩'));
  const caption = document.createElement('div');
  caption.className = 'cc-caption';
  caption.textContent = 'midiendo…';

  stage.append(ghost, scan, kets, result, caption);
  overlay.append(stage);
  return overlay;
}

export async function playCollapse({ state, group, cardId, bitsPromise, symOf = s => s, prob0 = 50 }) {
  if (prefersReduced()) return bitsPromise;

  const card = state.cards[cardId];
  const anchor = document.querySelector(`.board [data-id="${cardId}"]`)
    || document.querySelector('.discard')
    || document.querySelector('.table')
    || document.body;

  const overlay = buildOverlay({ card, anchor, symOf, prob0 });
  document.body.append(overlay);
  overlay.classList.add('measuring');

  const [bits] = await Promise.all([Promise.resolve(bitsPromise), sleep(MEASURE_MS)]);

  const bit = bits[card.qubit];
  overlay.querySelector('.cc-result span').textContent = `|${bit}⟩`;
  overlay.querySelector('.cc-caption').textContent = `colapso → |${bit}⟩`;
  overlay.classList.remove('measuring');
  overlay.classList.add('collapsing', bit ? 'to-1' : 'to-0');
  await sleep(COLLAPSE_MS);
  overlay.classList.add('settled');
  await sleep(SETTLE_MS);
  overlay.remove();
  return bits;
}
