// OPERACIONES CUÁNTICAS CON QISKIT
// Todo lo cuántico del juego pasa por acá: armar el circuito de un grupo, calcular la probabilidad
// de una carta y medir. Corre solo dentro de Qollab (en Node no existe `qiskit`).
//
// El estado del juego guarda el circuito como dato plano (`ops`); este archivo lo traduce a Qiskit.
import { QuantumCircuit } from 'qiskit';
import { Statevector } from 'qiskit.quantum_info';
import { condicionar, marginal, elegirIndice } from './referencia.js'; // helpers puros (sin simulación)

// Shots que se piden al medir un grupo con qubits ya medidos: se queda con las muestras compatibles.
const SHOTS_CONDICIONADOS = 512;

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

// Distribución conjunta del grupo (2^n estados), exacta y sin medir, ya CONDICIONADA por los qubits
// que se midieron antes (group.bits). `extra` agrega ops solo para este cálculo. No usa el backend.
function distribucionGrupo(group, extra = []) {
  const sv = Statevector(construirCircuito({ qubits: group.qubits, ops: [...group.ops, ...extra] }));
  return condicionar(Array.from(sv.probabilities().toJs()), group.bits || []);
}

// [P(0), P(1)] de un qubit del grupo. Si está entrelazado, es la probabilidad de ese qubit solo,
// condicionada por lo ya medido en su grupo.
export async function probabilidadQubit(group, qubit) {
  return marginal(distribucionGrupo(group), qubit);
}

// Lo mismo para todos los qubits del grupo con un solo Statevector: devuelve [[P(0), P(1)], ...] por qubit.
export async function probabilidadesGrupo(group) {
  const p = distribucionGrupo(group);
  return Array.from({ length: group.qubits }, (_, q) => marginal(p, q));
}

// [P(+), P(−)] de cada qubit del grupo: agrega una H y mide en la base X. No colapsa nada.
// Si el qubit está entrelazado, la fase no es de la carta sola y suele dar cerca de 50/50.
export async function probabilidadesFaseGrupo(group) {
  return Array.from({ length: group.qubits }, (_, q) => marginal(distribucionGrupo(group, [['h', q]]), q));
}

// [P(0), P(1)] de una carta, lo que ve su dueño. Una carta clásica devuelve null; una ya medida es segura.
export async function probabilidadCarta(state, idCarta) {
  const c = state.cards[idCarta];
  if (!c.group) return null;
  const g = state.groups[c.group];
  const medido = g.bits?.[c.qubit];
  if (medido != null) return medido === 0 ? [1, 0] : [0, 1];
  return probabilidadQubit(g, c.qubit);
}

// Mide el grupo en el backend y devuelve bits[q] = resultado del qubit q, compatible con los qubits
// que ya estaban medidos (group.bits). Quien llama solo usa el bit de la carta jugada (medición parcial).
// Sin qubits medidos alcanza 1 shot. Con qubits medidos se piden varios y se descartan los que no
// coinciden con ellos (post-selección); si ninguno coincide, se muestrea la distribución exacta.
// Qiskit escribe los resultados con el qubit 0 a la DERECHA ('10' = qubit1 en 1, qubit0 en 0).
export async function medirGrupo(group, backend) {
  const fijos = group.bits || [];
  const hayFijos = fijos.some(b => b != null);
  const job = await backend.run(construirCircuito(group, { medir: true }), { shots: hayFijos ? SHOTS_CONDICIONADOS : 1 });
  const counts = (await job.result()).get_counts().toJs();
  const entradas = counts instanceof Map ? [...counts.entries()] : Object.entries(counts);

  const candidatos = [];
  for (const [clave, n] of entradas) {
    const bits = Array.from({ length: group.qubits }, (_, q) => Number(clave[clave.length - 1 - q]));
    if (bits.every((b, q) => fijos[q] == null || fijos[q] === b)) candidatos.push([bits, Number(n) || 1]);
  }
  if (candidatos.length) {
    const total = candidatos.reduce((s, [, n]) => s + n, 0);
    let r = Math.random() * total;
    for (const [bits, n] of candidatos) { r -= n; if (r < 0) return bits; }
    return candidatos[candidatos.length - 1][0];
  }
  const idx = elegirIndice(distribucionGrupo(group));
  return Array.from({ length: group.qubits }, (_, q) => (idx >> q) & 1);
}
