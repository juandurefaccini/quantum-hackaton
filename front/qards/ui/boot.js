// Pantalla de carga (boot). El overlay vive en <body>, FUERA de #root, así el
// mount() de la app puede limpiar #root sin borrarlo; nosotros lo retiramos con
// fade cuando el tablero ya está pintado (ver hideBoot en main.js).
const MIN_VISIBLE_MS = 700; // evita el parpadeo cuando la carga es instantánea
const FADE_MS = 420;

let overlay = null;
let logEl = null;
let shownAt = 0;
let hiding = false;

// Crea el overlay (idempotente). Devuelve el elemento si ya existía.
export function showBoot() {
  if (overlay) return overlay;
  shownAt = Date.now();
  hiding = false;

  overlay = document.createElement('div');
  overlay.className = 'boot';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Loading Qards');

  const logo = document.createElement('div');
  logo.className = 'boot-logo';
  const title = document.createElement('h1');
  title.className = 'boot-title';
  title.textContent = 'Qards';
  const sub = document.createElement('p');
  sub.className = 'boot-sub';
  sub.textContent = 'quantum card game';
  logo.append(title, sub);

  const kets = document.createElement('div');
  kets.className = 'boot-kets';
  kets.setAttribute('aria-hidden', 'true');
  for (const ket of ['|0⟩', '|1⟩', '|0⟩']) {
    const span = document.createElement('span');
    span.className = 'boot-ket';
    span.textContent = ket;
    kets.append(span);
  }

  const bar = document.createElement('div');
  bar.className = 'boot-bar';
  bar.setAttribute('aria-hidden', 'true');

  logEl = document.createElement('div');
  logEl.className = 'boot-log';

  overlay.append(logo, kets, bar, logEl);
  (document.body || document.documentElement).append(overlay);
  return overlay;
}

// Agrega una línea al log del boot (motor, backend, reparto…).
export function bootStep(text) {
  if (!overlay || !logEl || !text) return;
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.textContent = text;
  logEl.append(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// Retira el overlay con fade, respetando un mínimo visible y sin fallar si ya se fue.
export function hideBoot() {
  if (!overlay || hiding) return;
  hiding = true;
  const el = overlay;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  setTimeout(() => {
    el.classList.add('boot-hide');
    setTimeout(() => el.remove(), FADE_MS);
    overlay = null;
    logEl = null;
  }, wait);
}
