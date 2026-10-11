import { mount } from './ui/render.js';
import { initDebug, log, fail, showFatal } from './ui/debug.js';
import { showBoot, bootStep, hideBoot } from './ui/boot.js';

initDebug();
showBoot();
bootStep('Iniciando Qards');
log('main.js cargado');

// Qollab may evaluate this module before index.html is mounted, so wait for it.
let started = false;
function boot() {
  const root = document.getElementById('root');
  if (!root) { setTimeout(boot, 150); return; }
  if (started) { log('boot: ya montado, ignoro segunda carga'); return; }
  started = true;
  log('boot: #root encontrado');
  bootStep('Preparando tablero');
  mount(root)
    .then(() => { log('mount ok'); hideBoot(); })
    .catch(error => { hideBoot(); fail(`mount falló: ${error && error.message ? error.message : error}`); showFatal(root, error); });
}
boot();

// Keep this run alive: remote backends (IonQ) are only reachable while main.js runs.
await new Promise(() => {});
