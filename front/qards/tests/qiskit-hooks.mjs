// Registra el alias de `qiskit` para los tests en Node (ver qiskit-resolver.mjs).
// Uso:
//   node --import front/qards/tests/qiskit-hooks.mjs \
//     --test front/qards/tests/services.test.js
import { register } from 'node:module';

register('./qiskit-resolver.mjs', import.meta.url);
