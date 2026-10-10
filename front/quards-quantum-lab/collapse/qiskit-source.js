// Qollab adapter: runs the same circuit on the selected `backend`.
// This is the ONLY module in the project that imports 'qiskit'.
import { QuantumCircuit } from 'qiskit';
import { parseCounts } from './pool.js';

export async function runCircuit(circuit, shots) {
  const n = circuit.qubits;
  const qc = QuantumCircuit(n, n);
  for (const op of circuit.ops) {
    if (op.gate === 'cx') qc.cx(op.control, op.target);
    else if (op.gate === 'cz') qc.cz(op.control, op.target);
    else qc[op.gate](op.target);
  }
  const wires = Array.from({ length: n }, (_, i) => i);
  qc.measure(wires, wires);

  const job = await backend.run(qc, { shots });
  const result = await job.result();
  // A Python dict becomes a Map by default; ask for a plain object instead.
  const raw = result.get_counts().toJs({ dict_converter: Object.fromEntries });
  return {
    counts: parseCounts(raw),
    sourceLabel: `Qiskit en ${String(result.backend_name ?? 'backend desconocido')}`,
  };
}
