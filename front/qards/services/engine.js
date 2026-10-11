// FACHADA del motor del back. La app NO importa back/estado.js directamente:
// usa estos servicios. `engine` re-exporta el motor; `clone` permite simular.
export {
  createGame,
  checkState,
  aplicarPuerta1,
  aplicarCnot,
  aplicarSuperponer,
  otorgarPuerta,
  sortearPuerta,
  barajar,
  CATALOGO,
  COLORS,
} from '../../../back/estado.js';

// Copia profunda del estado (es plano y serializable): para simular/deshacer.
export function clone(state) {
  return structuredClone(state);
}

export const MAX_QUBITS = 8;
