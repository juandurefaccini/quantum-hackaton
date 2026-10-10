#!/usr/bin/env node
// Arma el zip para Qollab: app plana en la raíz + back/ empaquetado, y reescribe
// las rutas `../../../back/` (repo) a `../back/` (zip plano). Qollab necesita
// index.html + main.js + assets en la raíz, así que no puede preservar la
// estructura del repo.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // front/quards/
const ROOT = resolve(HERE, '..', '..');
const OUT = resolve(HERE, '..', 'quards.zip');
const TMP = resolve(ROOT, '.quards-build');
const FILES = ['index.html', 'main.css', 'main.js', 'README.md', 'DESIGN.md'];
const DIRS = ['services', 'ui', 'back'];

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

for (const f of FILES) cpSync(join(HERE, f), join(TMP, f));
for (const d of DIRS) cpSync(d === 'back' ? join(ROOT, d) : join(HERE, d), join(TMP, d), { recursive: true });
mkdirSync(join(TMP, 'quantum'), { recursive: true });
cpSync(join(HERE, 'quantum/qiskit-stub.js'), join(TMP, 'quantum/qiskit-stub.js'));

for (const f of readdirSync(join(TMP, 'services'))) {
  const p = join(TMP, 'services', f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('../../../back/', '../back/'));
}

rmSync(OUT, { force: true });
execFileSync('zip', ['-r', '-X', OUT, ...FILES, ...DIRS, 'quantum', '-x', '*.DS_Store'], { cwd: TMP, stdio: 'ignore' });
rmSync(TMP, { recursive: true, force: true });
console.log(`zip -> ${OUT}`);
