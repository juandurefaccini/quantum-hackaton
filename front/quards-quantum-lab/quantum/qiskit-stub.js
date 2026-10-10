// Local stand-in for Qollab's Python-backed 'qiskit' module. It is mapped via
// the import map in dev.html so qiskit-source.js can be imported statically in
// dev. The fake sampler is used locally, so this is never constructed.
export function QuantumCircuit() {
  throw new Error('qiskit no está disponible en local: usá dev.html (sampler fake) o corré en Qollab.');
}
