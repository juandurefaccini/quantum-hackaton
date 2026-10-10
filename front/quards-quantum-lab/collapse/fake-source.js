// Local adapter: samples the ideal distribution with the JS statevector.
// Used whenever there is no Qollab `backend`, i.e. every dev run.
import { stateFromOps, sampleCounts } from '../quantum/statevector.js';
import { mulberry32 } from '../quantum/rng.js';
import { parseCounts } from './pool.js';

export async function runCircuit(circuit, shots, seed = Date.now()) {
  const state = stateFromOps(circuit.qubits, circuit.ops);
  const raw = sampleCounts(state, circuit.qubits, shots, mulberry32(seed));
  return {
    counts: parseCounts(raw),
    sourceLabel: 'statevector JS local (solo desarrollo, no es Qiskit)',
  };
}
