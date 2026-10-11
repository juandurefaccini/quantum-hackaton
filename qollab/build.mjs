#!/usr/bin/env node
// Arma el bundle plano para subir a Qollab (proyecto JS/Qiskit).
//
// Qollab espera index.html + main.js en la RAÍZ del proyecto (main.css opcional) y resuelve los
// imports de JS con rutas `./`. El repo tiene el back fuera de la app (`back/`), así que este script
// aplana la estructura en `qollab/app/` y reescribe las rutas `../../../back/` -> `../back/`.
//
//   node qollab/build.mjs
//
// Salida:
//   qollab/app/                 -> subí estos archivos (o el zip) al proyecto de Qollab
//   qollab/qards-qollab.zip    -> el mismo contenido, en un zip
//
// Nota: NO se incluye quantum/qiskit-stub.js. En el repo el import `qiskit` se resuelve con un
// import map a ese stub; dentro de Qollab `qiskit` es el paquete real y no hace falta el stub.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // qollab/
const ROOT = resolve(HERE, '..');
const APP = join(HERE, 'app');
const ZIP = join(HERE, 'qards-qollab.zip');

// entry (raíz) + app + back.
const FILES = [
  [join(ROOT, 'front/qards/index.html'), 'index.html'],
  [join(ROOT, 'front/qards/main.js'), 'main.js'],
  [join(ROOT, 'main.css'), 'main.css'],
];
const UI = ['render.js', 'debug.js', 'qard.js', 'collapse.js', 'superpose.js', 'entangle.js', 'background.js', 'glitch.js', 'gatecard.js', 'circuit-overlay.js', 'audio.js'];
const SERVICES = ['engine.js', 'rules.js', 'ai.js', 'quantum.js', 'ionq.js'];
const BACK = ['estado.js', 'quantum/util.js', 'quantum/referencia.js', 'quantum/qiskit.js'];

// La fuente decorativa de las cartas, best-effort: si el sandbox bloquea la red, cae a la del sistema.
const FONT_NOTE = `/* Qollab carga SOLO main.css. La fuente es opcional: si la red del sandbox la bloquea,
   el juego sigue con la pila de fuentes del sistema. */
@import url("https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&display=swap");

`;

rmSync(APP, { recursive: true, force: true });
mkdirSync(join(APP, 'ui'), { recursive: true });
mkdirSync(join(APP, 'services'), { recursive: true });
mkdirSync(join(APP, 'back/quantum'), { recursive: true });

for (const [src, dest] of FILES) cpSync(src, join(APP, dest));

for (const f of UI) cpSync(join(ROOT, 'front/qards/ui', f), join(APP, 'ui', f));
for (const f of SERVICES) cpSync(join(ROOT, 'front/qards/services', f), join(APP, 'services', f));
for (const f of BACK) cpSync(join(ROOT, 'back', f), join(APP, 'back', f));

// Reescribe las rutas del repo (`../../../back/`) por las del bundle plano (`../back/`).
for (const f of readdirSync(join(APP, 'services'))) {
  const p = join(APP, 'services', f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('../../../back/', '../back/'));
}

// main.css con la fuente al frente (los @import tienen que ir antes que cualquier otra regla).
const css = readFileSync(join(APP, 'main.css'), 'utf8');
writeFileSync(join(APP, 'main.css'), FONT_NOTE + css);

// Verificación barata: que no queden rutas `../../../` sin reescribir.
const sospechosas = [];
for (const dir of ['ui', 'services']) {
  for (const f of readdirSync(join(APP, dir))) {
    const txt = readFileSync(join(APP, dir, f), 'utf8');
    if (txt.includes('../../../')) sospechosas.push(`${dir}/${f}`);
  }
}
if (sospechosas.length) {
  console.error(`ERROR: quedaron rutas ../../../ sin reescribir en: ${sospechosas.join(', ')}`);
  process.exit(1);
}

rmSync(ZIP, { force: true });
if (existsSync('/usr/bin/zip') || existsSync('/usr/local/bin/zip') || process.env.PATH?.includes('zip')) {
  try {
    execFileSync('zip', ['-r', '-X', ZIP, '.', '-x', '*.DS_Store'], { cwd: APP, stdio: 'ignore' });
    console.log(`zip -> ${basename(ZIP)}`);
  } catch {
    console.log('zip no disponible: subí los archivos de qollab/app/ uno por uno.');
  }
}

console.log(`bundle -> ${APP}`);
