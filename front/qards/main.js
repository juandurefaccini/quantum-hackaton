import { mount } from './ui/render.js';
import { initDebug, log, fail, showFatal } from './ui/debug.js';
import { showBoot, bootStep, hideBoot } from './ui/boot.js';

initDebug();
showBoot();
bootStep('Starting Qards');
log('main.js loaded');

// Qollab may evaluate this module before index.html is mounted, so wait for it.
let started = false;
function boot() {
  const root = document.getElementById('root');
  if (!root) { setTimeout(boot, 150); return; }
  if (started) { log('boot: already mounted, ignoring second load'); return; }
  started = true;
  log('boot: #root found');
  bootStep('Preparing board');
  mount(root)
    .then(() => { log('mount ok'); hideBoot(); })
    .catch(error => { hideBoot(); fail(`mount failed: ${error && error.message ? error.message : error}`); showFatal(root, error); });
}
boot();

// Keep this run alive: remote backends (IonQ) are only reachable while main.js runs.
await new Promise(() => {});
