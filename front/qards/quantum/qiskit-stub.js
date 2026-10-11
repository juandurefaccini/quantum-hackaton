// Local stand-in for Qollab's Python-backed Qiskit modules. Mapped via the
// import map in dev.html so back/quantum/qiskit.js can be imported statically in
// dev. The reference simulator is used locally, so these are never constructed.
export function QuantumCircuit() {
  throw new Error('qiskit no está disponible en local: usá el simulador de referencia o corré en Qollab.');
}

export function Statevector() {
  throw new Error('qiskit.quantum_info no está disponible en local: usá el simulador de referencia o corré en Qollab.');
}
