// PUERTO CUÁNTICO: una sola interfaz, varios adaptadores.
//   Probabilidades (exactas): Qollab -> back/quantum/qiskit.js (Statevector); local -> back/quantum/referencia.js.
//   Medición (el colapso):    Qollab -> qiskit (backend.run); local -> IonQ (proxy) o referencia (muestreo).
// La app nunca importa back/quantum/* ni IonQ directamente: solo este servicio.
import * as qiskit from '../../../back/quantum/qiskit.js';
import * as referencia from '../../../back/quantum/referencia.js';
import * as ionq from './ionq.js';

const hasQollab = typeof backend !== 'undefined';

function configuredEngine() {
  const g = String(globalThis.QARDS_ENGINE || '').toLowerCase();
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
//
// En Qollab, los simuladores locales aceptan todos los jobs que haga falta, pero los backends de
// IonQ admiten UN solo job por ejecución (Run). Para no romper la partida si eligen IonQ:
//   - el primer colapso se mide con el backend real (`qiskit` -> `backend.run`);
//   - si el runtime rechaza el segundo job, se marca el límite y el resto de la partida se mide con
//     el simulador de referencia (la distribución es la misma; el colapso es idéntico en ley);
//   - cualquier otro fallo (red, timeout, job fallido) también cae a la referencia.
// Así, en los simuladores locales la medición SIEMPRE pasa por Qiskit, y en IonQ el primer colapso
// es un job real. El juego nunca queda esperando una medición que no llega.
let remoteJobsExhausted = false; // true cuando el backend remoto agotó su presupuesto de jobs (IonQ)

// El runtime de Qollab corta el segundo job de IonQ con un error del tipo "only one job is allowed".
function isOneJobLimit(error) {
  const m = String(error?.message ?? error).toLowerCase();
  return m.includes('one job') || m.includes('only one job') || m.includes('single job');
}

export async function medirGrupo(group) {
  if (engine === 'qiskit' && !remoteJobsExhausted) {
    try {
      return await qiskit.medirGrupo(group, backend);
    } catch (error) {
      if (isOneJobLimit(error)) {
        remoteJobsExhausted = true;
        console.warn('The remote backend (IonQ) allows a single job per run; remaining collapses are computed with the reference simulator.');
      } else {
        console.warn(`Measurement with qiskit failed (${error?.message ?? error}); falling back to reference.`);
      }
    }
  } else if (engine === 'ionq') {
    try {
      return await ionq.medirGrupo(group);
    } catch (error) {
      console.warn(`Measurement with ionq failed (${error?.message ?? error}); falling back to reference.`);
    }
  }
  return referencia.muestrear(group);
}

export async function ionqHealth() {
  return hasQollab ? { ok: false, hasKey: false } : ionq.health();
}
