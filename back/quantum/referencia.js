// SIMULADOR DE REFERENCIA (solo para pruebas en Node)
// El juego calcula y mide con Qiskit (ver quantum/qiskit.js). Este archivo existe porque Qiskit no
// corre en Node: sirve para contrastar los resultados de Qiskit y para correr tests sin Qollab.
//
//
// Puertas: 'h', 'x', 'z', 'ry' y 'cx'. Todas tienen matrices reales, así que las amplitudes quedan
// reales y alcanza con un número por estado. Si algún día se suma una puerta con fases (S, Y, Rz)
// hay que pasar a números complejos.
//
// Los estados se numeran con el qubit q en el bit q: el índice 5 (binario 101) es qubit0=1, qubit1=0, qubit2=1.

function aplicar1(amp, q, [[a, b], [c, d]]) {
  const bit = 1 << q;
  for (let i = 0; i < amp.length; i++) {
    if (i & bit) continue;
    const j = i | bit;
    const x = amp[i], y = amp[j];
    amp[i] = a * x + b * y;
    amp[j] = c * x + d * y;
  }
}

function aplicarCx(amp, control, target) {
  const cb = 1 << control, tb = 1 << target;
  for (let i = 0; i < amp.length; i++) {
    if (!(i & cb) || i & tb) continue;
    const j = i | tb;
    [amp[i], amp[j]] = [amp[j], amp[i]];
  }
}

// Amplitudes del estado final del grupo (empieza con todos los qubits en 0).
export function amplitudes(group) {
  const amp = new Float64Array(1 << group.qubits);
  amp[0] = 1;
  for (const [gate, ...a] of group.ops) {
    if (gate === 'h') {
      const s = Math.SQRT1_2;
      aplicar1(amp, a[0], [[s, s], [s, -s]]);
    } else if (gate === 'x') {
      aplicar1(amp, a[0], [[0, 1], [1, 0]]);
    } else if (gate === 'z') {
      aplicar1(amp, a[0], [[1, 0], [0, -1]]);
    } else if (gate === 'ry') {
      const c = Math.cos(a[0] / 2), s = Math.sin(a[0] / 2);
      aplicar1(amp, a[1], [[c, -s], [s, c]]);
    } else if (gate === 'cx') {
      aplicarCx(amp, a[0], a[1]);
    } else {
      throw new Error(`Puerta no soportada por el simulador: ${gate}`);
    }
  }
  return amp;
}

// Probabilidad de cada estado conjunto del grupo (suman 1).
export function distribucion(group) {
  return Array.from(amplitudes(group), (x) => x * x);
}

// [P(la carta mide 0), P(la carta mide 1)]: lo que ve su dueño. Si la carta está entrelazada, es la
// probabilidad de la carta sola, sin mirar a su pareja. Una carta ya colapsada es segura.
export function probabilidadCarta(state, idCarta) {
  const c = state.cards[idCarta];
  if (!c.group) return null; // carta clásica: no hay nada que calcular
  const g = state.groups[c.group];
  if (g.collapsed) return g.bits[c.qubit] === 0 ? [1, 0] : [0, 1];
  const p = distribucion(g);
  let p1 = 0;
  for (let i = 0; i < p.length; i++) if ((i >> c.qubit) & 1) p1 += p[i];
  return [1 - p1, p1];
}
