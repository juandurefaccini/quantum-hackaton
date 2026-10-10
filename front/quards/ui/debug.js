// On-screen diagnostics: a failed run must never be a black screen.
// The panel lives on <body>, so mount() clearing #root cannot remove it.
let panel = null;
let pre = null;

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
export function fail(message) { push(`✖ ${message}`); console.log(`ERR ${message}`); }

export function showFatal(root, error) {
  const text = error && error.stack ? error.stack : String(error);
  fail(text);
  if (!root) return;
  const box = document.createElement('pre');
  box.className = 'fatal';
  box.textContent = `Quards falló al iniciar:\n\n${text}\n\nRevisá el panel de debug abajo a la izquierda.`;
  root.replaceChildren(box);
}
