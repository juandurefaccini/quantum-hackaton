// OPERACIONES CUÁNTICAS CON QISKIT
// Todo lo cuántico del juego pasa por acá: armar el circuito de un grupo, calcular la probabilidad
// de una carta y medir. Corre solo dentro de Qollab (en Node no existe `qiskit`).
//
// El estado del juego guarda el circuito como dato plano (`ops`); este archivo lo traduce a Qiskit.
import { QuantumCircuit } from 'qiskit';
import { Statevector } from 'qiskit.quantum_info';

// Traduce { qubits, ops } a un QuantumCircuit de Qiskit. Con `medir` agrega la medición de todos
// los qubits (para backend.run); sin `medir` queda sin medición (para calcular probabilidades).
export function construirCircuito({ qubits, ops }, { medir = false } = {}) {
  const qc = medir ? QuantumCircuit(qubits, qubits) : QuantumCircuit(qubits); // sin `new`
  for (const [gate, ...a] of ops) {
    if (gate === 'h') qc.h(a[0]);
    else if (gate === 'x') qc.x(a[0]);
    else if (gate === 'z') qc.z(a[0]);
    else if (gate === 'ry') qc.ry(a[0], a[1]);   // ry(ángulo, qubit)
    else if (gate === 'cx') qc.cx(a[0], a[1]);   // cx(control, target)
    else throw new Error(`Puerta desconocida: ${gate}`);
  }
  if (medir) {
    const todos = Array.from({ length: qubits }, (_, i) => i);
    qc.measure(todos, todos);
  }
  return qc;
}

// [P(0), P(1)] de un qubit del grupo, exacto y sin medir (no colapsa nada, no usa el backend).
// Si el qubit está entrelazado, es la probabilidad de ese qubit solo.
export async function probabilidadQubit(group, qubit) {
  const sv = Statevector(construirCircuito(group));
  return Array.from(sv.probabilities([qubit]).toJs());
}

// Lo mismo para todos los qubits del grupo con un solo Statevector: devuelve [[P(0), P(1)], ...] por qubit.
export async function probabilidadesGrupo(group) {
  const sv = Statevector(construirCircuito(group));
  return Array.from({ length: group.qubits }, (_, q) => Array.from(sv.probabilities([q]).toJs()));
}

// [P(+), P(−)] de cada qubit del grupo: agrega una H y mide en la base X. No colapsa nada.
// Si el qubit está entrelazado, la fase no es de la carta sola y suele dar cerca de 50/50.
export async function probabilidadesFaseGrupo(group) {
  const salida = [];
  for (let q = 0; q < group.qubits; q++) {
    const sv = Statevector(construirCircuito({ qubits: group.qubits, ops: [...group.ops, ['h', q]] }));
    salida.push(Array.from(sv.probabilities([q]).toJs()));
  }
  return salida;
}

// [P(0), P(1)] de una carta, lo que ve su dueño. Una carta clásica devuelve null; una ya colapsada es segura.
export async function probabilidadCarta(state, idCarta) {
  const c = state.cards[idCarta];
  if (!c.group) return null;
  const g = state.groups[c.group];
  if (g.collapsed) return g.bits[c.qubit] === 0 ? [1, 0] : [0, 1];
  return probabilidadQubit(g, c.qubit);
}

// Mide el grupo entero una sola vez en el backend y devuelve bits[q] = resultado del qubit q.
// Qiskit escribe los resultados con el qubit 0 a la DERECHA ('10' = qubit1 en 1, qubit0 en 0).
export async function medirGrupo(group, backend) {
  const job = await backend.run(construirCircuito(group, { medir: true }), { shots: 1 });
  const counts = (await job.result()).get_counts().toJs();
  const clave = counts instanceof Map ? [...counts.keys()][0] : Object.keys(counts)[0];
  return Array.from({ length: group.qubits }, (_, q) => Number(clave[clave.length - 1 - q]));
}
