// Hook de resolución: mapea las importaciones bare de `qiskit` al stub local.
// En el navegador (dev.html / Qollab) un import map hace este trabajo; Node no tiene
// import maps, así que lo hacemos acá. Los tests usan el motor de referencia, por lo
// que las funciones del stub (que lanzan) nunca se invocan.
const STUB = new URL('../quantum/qiskit-stub.js', import.meta.url).href;
const ALIASES = new Set(['qiskit', 'qiskit.quantum_info']);

export function resolve(specifier, context, nextResolve) {
  if (ALIASES.has(specifier)) return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
