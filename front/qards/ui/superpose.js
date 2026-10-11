// ANIMACIÓN DE SUPERPOSICIÓN (la inversa del colapso, ver collapse.js).
// Cuando aplicás la puerta SUP a una carta fija, la carta "se abre" en sus dos caras:
//   0) viaja al centro de la mesa (estado intermedio) mientras "carga".
//   1) "splitting" → se abre en diagonal: aparece la segunda cara y parpadean los kets |0⟩/|1⟩.
//   2) "settled"   → queda en superposición (|0⟩ + |1⟩).
//   3) vuelve a su lugar original en la mano.
// La transición es solo de la carta (sin efecto WebGL).
import { createClassicQard, createQard } from './qard.js';

const CHARGE_MS = 480;
const SPLIT_MS = 780;
const SETTLE_MS = 460;
const MOVE_MS = 400;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const prefersReduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function span(cls, value) {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = value;
  return s;
}

function buildOverlay({ rect, outcomes, symOf, prob0 }) {
  const w = Math.max(Math.round(rect.width) || 120, 80);
  const overlay = document.createElement('div');
  overlay.className = 'superpose-fx';
  overlay.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  overlay.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
  overlay.style.setProperty('--card-w', `${w}px`);

  const stage = document.createElement('div');
  stage.className = 'sp-stage';

  const c0 = outcomes[0].color ?? 'grey';
  const c1 = outcomes[1].color ?? 'grey';
  const classic = createClassicQard({ color: c0, symbol: symOf(outcomes[0]) });
  classic.classList.add('sp-card', 'sp-classic');
  const quantum = createQard({
    color0: c0, sym0: symOf(outcomes[0]),
    color1: c1, sym1: symOf(outcomes[1]), prob0,
  });
  quantum.classList.add('sp-card', 'sp-quantum');

  const kets = document.createElement('div');
  kets.className = 'sp-kets';
  kets.append(span('sp-ket sp-ket0', '|0⟩'), span('sp-ket sp-ket1', '|1⟩'));
  const caption = document.createElement('div');
  caption.className = 'sp-caption';
  caption.textContent = 'loading…';

  stage.append(classic, quantum, kets, caption);
  overlay.append(stage);
  return { overlay, caption };
}

// Anima la carta fija (rect) hacia su superposición. `outcomes` son sus dos caras.
// La carta VIAJA al centro de la mesa (estado intermedio), se abre ahí y vuelve a su lugar.
export async function playSuperpose({ rect, outcomes, symOf = s => s, prob0 = 50 }) {
  if (!rect || !rect.width || !outcomes) return;
  if (prefersReduced()) return;

  const { overlay, caption } = buildOverlay({ rect, outcomes, symOf, prob0 });
  document.body.append(overlay);

  // Destino "intermedio": el centro de la mesa (donde están mazo/descarte). Agranda un poco.
  const table = document.querySelector('.table')?.getBoundingClientRect();
  const cx = table ? table.left + table.width / 2 : window.innerWidth / 2;
  const cy = table ? table.top + table.height / 2 : window.innerHeight * 0.45;
  const dx = Math.round(cx - (rect.left + rect.width / 2));
  const dy = Math.round(cy - (rect.top + rect.height / 2));
  const scale = Math.max(1, Math.min(1.7, (window.innerHeight * 0.5) / rect.height));
  const enCasa = 'translate(-50%, -50%) scale(1)';
  const enMesa = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale})`;
  const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  // 0) VIAJE AL CENTRO (a la vez que "carga").
  overlay.classList.add('charging');
  caption.textContent = 'loading…';
  const moveIn = overlay.animate([{ transform: enCasa }, { transform: enMesa }], { duration: MOVE_MS, easing: ease, fill: 'forwards' });
  await Promise.all([moveIn.finished, sleep(CHARGE_MS)]);

  // 1) SEPARACIÓN en el centro: la carta se abre en sus dos caras.
  overlay.classList.remove('charging');
  overlay.classList.add('splitting');
  caption.textContent = 'splitting…';
  await sleep(SPLIT_MS);

  // 2) ASENTAR: queda la superposición.
  overlay.classList.add('settled');
  caption.textContent = '|0⟩ + |1⟩';
  await sleep(SETTLE_MS);

  // 3) VUELVE a su lugar original en la mano.
  const moveBack = overlay.animate([{ transform: enMesa }, { transform: enCasa }], { duration: MOVE_MS, easing: ease, fill: 'forwards' });
  await moveBack.finished;
  overlay.remove();
}
