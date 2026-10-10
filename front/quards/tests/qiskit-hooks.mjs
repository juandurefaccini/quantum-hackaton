// Registra el alias de `qiskit` para los tests en Node (ver qiskit-resolver.mjs).
// Uso:
//   node --import front/quards/tests/qiskit-hooks.mjs \
//     --test front/quards/tests/services.test.js
import { register } from 'node:module';

register('./qiskit-resolver.mjs', import.meta.url);
