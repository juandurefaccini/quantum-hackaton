// Carta de PUERTA del diseño de cards/index.html — versión importable y ESCALABLE.
// Igual que qard.js: las medidas fijas (px/rem) pasaron a em, así la carta se adapta a cualquier tamaño.
// El tamaño lo define la variable `--gate-w` (ancho); todo lo demás escala. Aspecto 4:7, 1em = ancho/10
// (a 160px de ancho, 1em = 16px: las medidas en em equivalen al diseño original).
//
// API:
//   createGateCard('h'|'x'|'z'|'cnot', { active, disabled }) -> .gate-card
//   ensureGateStyles()                                       -> inyecta el CSS (una sola vez)
//
// En el juego viven DENTRO de la mano, después de las cartas (ver render.js).
// Es un <div role="button"> (no un <button>) para no heredar los estilos globales de button del juego.
// El hover es el del diseño original: sube y se agranda un poco con un brillo blanco.

const STYLE_ID = 'gate-card-styles';

export const GATE_CSS = `
  .gate-card {
    --gw: var(--gate-w, 160px);
    box-sizing: border-box;
    position: relative;
    flex: none;
    width: var(--gw);
    aspect-ratio: 4 / 7;
    font-size: calc(var(--gw) / 10);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 0.75em;
    background-color: #ffffff;
    color: #0d0f12;
    border: max(2px, 0.19em) solid #0d0f12;
    border-radius: 0.75em;
    box-shadow: 0 0.6em 1.5em rgba(0, 0, 0, 0.6);
    font-family: 'Chakra Petch', sans-serif;
    user-select: none;
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.25s ease, opacity 0.2s ease;
  }
  .gate-card:focus-visible { outline: 3px solid #22b3a0; outline-offset: 3px; }

  /* HOVER del diseño: sube y se agranda un poco (no aplica cuando no es tu turno) */
  .gate-card:not(.is-disabled):hover {
    transform: translateY(-0.75em) scale(1.025);
    box-shadow: 0 1.1em 2.2em rgba(255, 255, 255, 0.3);
  }
  /* seleccionada (puerta pendiente de aplicar) */
  .gate-card.active {
    transform: translateY(-0.75em);
    outline: 3px solid #22b3a0; outline-offset: 2px;
    box-shadow: 0 0 1.3em #22b3a0;
  }
  .gate-card.is-disabled { opacity: 0.55; cursor: default; }

  .gate-card .gate-inner-border {
    position: absolute; inset: 0.375em;
    border: max(1px, 0.094em) solid #0d0f12; border-radius: 0.5em;
    pointer-events: none;
  }
  .gate-card .gate-header, .gate-card .gate-footer { display: flex; z-index: 2; }
  .gate-card .gate-header { justify-content: flex-start; }
  .gate-card .gate-footer { justify-content: flex-end; }
  .gate-card .gate-badge { font-size: max(0.85em, 9px); font-weight: 700; color: #0d0f12; }
  .gate-card .gate-symbol-layer {
    position: absolute; inset: 0;
    display: flex; justify-content: center; align-items: center;
    pointer-events: none;
  }
  .gate-card .gate-title { font-size: 3.6em; font-weight: 700; color: #0d0f12; line-height: 1; }
  .gate-card .cnot-diagram { display: flex; flex-direction: column; align-items: center; gap: 0.25em; }
  .gate-card .cnot-dot { width: 0.75em; height: 0.75em; background-color: #0d0f12; border-radius: 50%; }
  .gate-card .cnot-line { width: max(1px, 0.125em); height: 1.75em; background-color: #0d0f12; }
  .gate-card .cnot-target { font-size: 2.2em; font-weight: 700; line-height: 0.8; color: #0d0f12; }

  /* En la mano: misma altura que las cartas (aspecto 4:7 contra 5:7) y mismo hover que ellas */
  .hand .gate-card { --gate-w: calc(var(--card-w) * 0.8); touch-action: manipulation; }
  .hand.mine .gate-card:not(.is-disabled):hover, .hand.mine .gate-card.active { transform: translateY(-12px) scale(1.025); }

  /* Texto de la puerta en el panel de Info */
  .hint-state .gate-info { margin: 0; font-size: 13px; line-height: 1.4; color: #f1e8d6; }
  .hint-state .gate-info.muted { font-size: 12px; color: #b9ad98; }

  /* Cuándo llega la próxima puerta (debajo del texto del panel; se oculta al inspeccionar o elegir color) */
  .hint-box .hint-sub { margin: 6px 0 0; font-size: 12px; color: #b9ad98; }
  .hint-box .hint-sub:empty, .hint-box.show-state .hint-sub, .hint-box.choosing .hint-sub { display: none; }
`;

export function ensureGateStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const tag = doc.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = GATE_CSS;
  doc.head.append(tag);
}

// Dibujos especiales; el resto de las puertas muestra su nombre.
const GATE_TEMPLATES = {
  CNOT: `
    <div class="cnot-diagram">
      <div class="cnot-dot"></div>
      <div class="cnot-line"></div>
      <div class="cnot-target">⊕</div>
    </div>`,
};

export function createGateCard(type, { active = false, disabled = false } = {}) {
  ensureGateStyles();
  const name = String(type).toUpperCase();
  const el = document.createElement('div');
  el.className = 'gate-card';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Gate ${name}`);
  el.dataset.gate = String(type);
  if (active) el.classList.add('active');
  if (disabled) { el.classList.add('is-disabled'); el.setAttribute('aria-disabled', 'true'); }

  const symbolHTML = GATE_TEMPLATES[name] || `<span class="gate-title">${name}</span>`;
  el.innerHTML = `
    <div class="gate-inner-border"></div>
    <div class="gate-header"><span class="gate-badge">${name}</span></div>
    <div class="gate-symbol-layer">${symbolHTML}</div>
    <div class="gate-footer"><span class="gate-badge">${name}</span></div>
  `;

  // Teclado: Enter o espacio activan la carta como un botón.
  el.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
  });
  return el;
}
