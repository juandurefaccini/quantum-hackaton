// Carta del diseño de cards/index.html — versión importable y ESCALABLE.
// Mismo DOM y mismo estilo que el prototipo; lo único que cambia es que las
// medidas fijas (px/rem) pasaron a unidades relativas (em + aspect-ratio), así
// la carta se adapta a cualquier tamaño sin reescribir el diseño.
//
// El tamaño lo define la variable `--qard-w` (ancho). Todo lo demás escala:
//   .card { --qard-w: var(--card-w) }   // el juego la ata a su propio ancho
//
// API:
//   createQard({ color0, sym0, color1, sym1, prob0, phase })  -> .qard-card
//   createClassicQard({ color, symbol })                      -> .qard-card
//   mountQard(el, { kind:'quantum'|'classic', ... })          -> rellena `el`
//   ensureQardStyles()                                        -> inyecta el CSS

const STYLE_ID = 'qard-styles';

export const QARD_CSS = `
  .qard-card, .qard-card * { box-sizing: border-box; }

  /* CONTENEDOR DE CARTA · aspecto 5:7 · base relativa 1em = ancho/10 */
  .qard-card {
    width: var(--qard-w, 200px);
    aspect-ratio: 5 / 7;
    font-size: calc(var(--qard-w, 200px) / 10);
    border-radius: 0.9em;
    border: 0.1em solid #ffffff;
    position: relative;
    background-color: #0d1117;
    box-shadow: 0 0.7em 1.5em rgba(0, 0, 0, 0.7);
    user-select: none;
    overflow: hidden;
    transition: background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  }

  /* LIENZO INTERNO DE COLOR */
  .qard-card .inner-canvas {
    position: absolute;
    inset: 0;
    border-radius: 0.8em;
    overflow: hidden;
    transition: inset 0.25s ease, border-radius 0.25s ease;
  }

  /* FONDOS Y GRADIENTES */
  .qard-card .full-bg { position: absolute; inset: 0; }

  .qard-card .half-0 { position: absolute; inset: 0; clip-path: polygon(0 0, 100% 0, 0 100%); }
  .qard-card .half-1 { position: absolute; inset: 0; clip-path: polygon(100% 0, 100% 100%, 0 100%); }

  .qard-card .diagonal-line {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom right,
      transparent calc(50% - 0.05em),
      rgba(255, 255, 255, 0.4) 50%,
      transparent calc(50% + 0.05em)
    );
    pointer-events: none;
  }

  /* GRADIENTES COMPILADOS EN CSS — alineados a la paleta de la app
     (rojo #e0463a · azul #3a7bd5 · verde #2fae6a · dorado #e6b23a), con
     remates oscurecidos del mismo tono en vez de primarios saturados. */
  .qard-card .grad-red    { background: radial-gradient(circle at 30% 30%, #e0463a 0%, #5a1c17 100%); }
  .qard-card .grad-blue   { background: radial-gradient(circle at 30% 30%, #3a7bd5 0%, #16305e 100%); }
  .qard-card .grad-green  { background: radial-gradient(circle at 30% 30%, #2fae6a 0%, #14502f 100%); }
  .qard-card .grad-yellow { background: radial-gradient(circle at 30% 30%, #e6b23a 0%, #6f5314 100%); }
  .qard-card .grad-grey   { background: radial-gradient(circle at 30% 30%, #2b2620 0%, #0d1117 100%); }

  /* SÍMBOLOS CENTRALES */
  .qard-card .symbols-layer { position: absolute; inset: 0; pointer-events: none; z-index: 2; }

  .qard-card .sym {
    position: absolute;
    font-size: 3.04em;
    font-weight: 300;
    color: #ffffff;
    line-height: 1;
  }

  .qard-card .sym-0 { top: 30%; left: 30%; transform: translate(-50%, -50%); }
  .qard-card .sym-1 { bottom: 30%; right: 30%; transform: translate(50%, 50%); }
  .qard-card .sym-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }

  /* CAPAS DE TEXTO EXTERNAS */
  .qard-card .header,
  .qard-card .footer {
    position: absolute;
    left: 0.5em;
    right: 0.5em;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
    pointer-events: none;
    height: 1.2em;
  }

  .qard-card .header { top: 0.3em; }
  .qard-card .footer { bottom: 0.3em; }
  .qard-card .footer.classic-footer { justify-content: flex-end; }

  .qard-card .ket-badge {
    font-size: 0.76em;
    font-weight: 300;
    color: #ffffff;
    transition: color 0.25s ease;
  }

  .qard-card .phase-badge,
  .qard-card .prob-badge {
    font-size: 0.52em;
    font-weight: 700;
    color: #000000;
    opacity: 0;
    transition: opacity 0.2s ease;
    letter-spacing: 0.015em;
  }

  /* ========================================================
     HOVER ÚNICO: el de la carta clásica, igual para todas.
     (La probabilidad y la fase ya no se revelan acá: van en el cuadro Info.)
     ======================================================== */
  .qard-card:hover,
  .slot:hover > .qard-card {
    background-color: #ffffff;
    border-color: #ffffff;
    box-shadow: 0 0 1.25em rgba(255, 255, 255, 0.45);
  }

  .qard-card:hover .inner-canvas,
  .slot:hover > .qard-card .inner-canvas {
    inset: 1.7em 0.4em 1.7em 0.4em;
    border-radius: 1.7em 0px 1.7em 0px;
  }

  .qard-card:hover .ket-badge,
  .slot:hover > .qard-card .ket-badge {
    color: #000000;
    font-weight: 500;
  }
`;

// Inyecta el CSS del diseño una sola vez (idempotente).
export function ensureQardStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const tag = doc.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = QARD_CSS;
  doc.head.append(tag);
}

// --- plantillas de contenido (mismo DOM que el prototipo) ---
// phase = '+' | '−' (signo de la fase) o null si no está definida (p. ej. carta entrelazada).
function quantumInner({ color0, sym0, color1, sym1, prob0 = 50, phase = null }) {
  const prob1 = 100 - prob0;
  const fase = phase ? `FASE: ${phase} |${phase}⟩` : 'FASE: —';
  return `
    <div class="header">
      <span class="ket-badge">|0⟩</span>
      <span class="phase-badge">${fase}</span>
    </div>

    <div class="inner-canvas">
      <div class="half-0 grad-${color0}"></div>
      <div class="half-1 grad-${color1}"></div>
      <div class="diagonal-line"></div>

      <div class="symbols-layer">
        <span class="sym sym-0">${sym0}</span>
        <span class="sym sym-1">${sym1}</span>
      </div>
    </div>

    <div class="footer">
      <span class="prob-badge">PROBABILITY: ${prob0}% | ${prob1}%</span>
      <span class="ket-badge">|1⟩</span>
    </div>
  `;
}

function classicInner({ color, symbol }) {
  return `
    <div class="header">
      <span class="ket-badge">${symbol}</span>
    </div>

    <div class="inner-canvas">
      <div class="full-bg grad-${color}"></div>

      <div class="symbols-layer">
        <span class="sym sym-center">${symbol}</span>
      </div>
    </div>

    <div class="footer classic-footer">
      <span class="ket-badge">${symbol}</span>
    </div>
  `;
}

// Rellena un elemento existente como carta (le agrega la clase .qard-card).
export function mountQard(el, spec = {}) {
  ensureQardStyles();
  el.classList.add('qard-card');
  el.innerHTML = spec.kind === 'classic' ? classicInner(spec) : quantumInner(spec);
  return el;
}

// Carta cuántica (superposición): split diagonal + kets |0⟩ / |1⟩.
export function createQard(spec = {}) {
  return mountQard(document.createElement('div'), { kind: 'quantum', ...spec });
}

// Carta clásica / normal: fondo pleno y símbolo centrado.
export function createClassicQard(spec = {}) {
  return mountQard(document.createElement('div'), { kind: 'classic', ...spec });
}
