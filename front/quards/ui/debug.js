// On-screen diagnostics: a failed run must never be a black screen.
// The panel lives on <body>, so mount() clearing #root cannot remove it.
// Arranca OCULTO: se muestra con el checkbox "Debug" del header (o ante un error).
const DEBUG_KEY = 'quards:debug';
let panel = null;
let pre = null;
let visible = false;

function loadPref() {
  try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; }
}
function savePref(value) {
  try { localStorage.setItem(DEBUG_KEY, value ? '1' : '0'); } catch { /* sin storage */ }
}

export function isDebugVisible() { return visible; }

// Muestra u oculta el panel (y recuerda la preferencia).
export function setDebugVisible(value) {
  visible = !!value;
  savePref(visible);
  ensurePanel().classList.toggle('debug-off', !visible);
}

function ensurePanel() {
  if (panel) return panel;
  panel = document.createElement('div');
  panel.className = 'debug';
  const head = document.createElement('div');
  head.className = 'debug-head';
  head.append(document.createTextNode('debug'));
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '–';
  toggle.title = 'colapsar/expandir';
  toggle.addEventListener('click', () => panel.classList.toggle('collapsed'));
  head.append(toggle);
  pre = document.createElement('pre');
  panel.append(head, pre);
  panel.classList.toggle('debug-off', !visible);
  (document.body || document.documentElement).append(panel);
  return panel;
}

function push(line) {
  ensurePanel();
  const time = new Date().toISOString().slice(11, 19);
  pre.textContent += `${pre.textContent ? '\n' : ''}${time} ${line}`;
  pre.scrollTop = pre.scrollHeight;
}

export function initDebug() {
  visible = loadPref();
  ensurePanel();
  window.addEventListener('error', event => fail(`error: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`));
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    fail(`rejection: ${reason && reason.stack ? reason.stack : reason}`);
  });
  push('debug listo');
}

export function log(message) { push(`· ${message}`); console.log(message); }
export function warn(message) { push(`! ${message}`); console.warn(message); }
// Un error real siempre destapa el panel (nunca una pantalla negra).
export function fail(message) { setDebugVisible(true); push(`✖ ${message}`); console.log(`ERR ${message}`); }

export function showFatal(root, error) {
  const text = error && error.stack ? error.stack : String(error);
  fail(text);
  if (!root) return;
  const box = document.createElement('pre');
  box.className = 'fatal';
  box.textContent = `Quards falló al iniciar:\n\n${text}\n\nRevisá el panel de debug abajo a la derecha.`;
  root.replaceChildren(box);
}
