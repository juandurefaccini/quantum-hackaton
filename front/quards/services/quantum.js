// PUERTO CUÁNTICO: una sola interfaz, varios adaptadores.
//   Probabilidades (exactas): Qollab -> back/quantum/qiskit.js (Statevector); local -> back/quantum/referencia.js.
//   Medición (el colapso):    Qollab -> qiskit (backend.run); local -> IonQ (proxy) o referencia (muestreo).
// La app nunca importa back/quantum/* ni IonQ directamente: solo este servicio.
import * as qiskit from '../../../back/quantum/qiskit.js';
import * as referencia from '../../../back/quantum/referencia.js';
import * as ionq from './ionq.js';

const hasQollab = typeof backend !== 'undefined';

function configuredEngine() {
  const g = String(globalThis.QUARDS_ENGINE || '').toLowerCase();
  if (g) return g;
  try { return (new URLSearchParams(location.search).get('engine') || '').toLowerCase() || null; } catch { return null; }
}

// Motor de MEDICIÓN: 'qiskit' (Qollab) | 'ionq' (local, vía proxy) | 'referencia' (local).
let engine = hasQollab ? 'qiskit' : (configuredEngine() === 'ionq' ? 'ionq' : 'referencia');

export const kind = () => engine;
export const isQollab = () => hasQollab;
export function setEngine(name) { engine = hasQollab ? 'qiskit' : name; }

// --- Probabilidades (nunca por IonQ: son exactas) ---
export async function probabilidadCarta(state, id) {
  return hasQollab ? qiskit.probabilidadCarta(state, id) : referencia.probabilidadCarta(state, id);
}

export async function probabilidadesGrupo(group) {
  if (hasQollab) return qiskit.probabilidadesGrupo(group);
  const p = referencia.distribucion(group);
  return Array.from({ length: group.qubits }, (_, q) => {
    let p1 = 0;
    for (let i = 0; i < p.length; i++) if ((i >> q) & 1) p1 += p[i];
    return [1 - p1, p1];
  });
}

export async function probabilidadesFaseGrupo(group) {
  return hasQollab ? qiskit.probabilidadesFaseGrupo(group) : null;
}

// --- Medición (colapso) ---
export async function medirGrupo(group) {
  if (engine === 'qiskit') return qiskit.medirGrupo(group, backend);
  if (engine === 'ionq') return ionq.medirGrupo(group);
  const p = referencia.distribucion(group);
  let r = Math.random(), acc = 0, idx = p.length - 1;
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) { idx = i; break; } }
  return Array.from({ length: group.qubits }, (_, q) => (idx >> q) & 1);
}

export async function ionqHealth() {
  return hasQollab ? { ok: false, hasKey: false } : ionq.health();
}
