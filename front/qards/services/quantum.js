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

// Todas las probabilidades salen condicionadas por los qubits del grupo que ya se midieron (group.bits).
export async function probabilidadesGrupo(group) {
  if (hasQollab) return qiskit.probabilidadesGrupo(group);
  const p = referencia.distribucionCondicionada(group);
  return Array.from({ length: group.qubits }, (_, q) => referencia.marginal(p, q));
}

// [P(+), P(−)] de cada qubit (base X). Cambia con la puerta Z; no colapsa nada.
export async function probabilidadesFaseGrupo(group) {
  if (hasQollab) return qiskit.probabilidadesFaseGrupo(group);
  return Array.from({ length: group.qubits }, (_, q) => referencia.probabilidadFaseQubit(group, q));
}

// --- Medición (colapso) ---
// Devuelve una muestra de TODOS los qubits del grupo, compatible con los que ya estaban medidos
// (group.bits). Quien llama solo usa el bit de la carta jugada: la medición es parcial.
// Si el motor remoto (Qiskit/IonQ) falla (red, timeout, job fallido), se mide con el
// simulador de referencia: el juego nunca queda esperando una medición que no llega.
export async function medirGrupo(group) {
  try {
    if (engine === 'qiskit') return await qiskit.medirGrupo(group, backend);
    if (engine === 'ionq') return await ionq.medirGrupo(group);
  } catch (error) {
    console.warn(`Medición con ${engine} falló (${error?.message ?? error}); se usa la referencia.`);
  }
  return referencia.muestrear(group);
}

export async function ionqHealth() {
  return hasQollab ? { ok: false, hasKey: false } : ionq.health();
}
