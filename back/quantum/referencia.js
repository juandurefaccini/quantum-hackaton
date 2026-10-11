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

// ---------------------------------------------------------------------------
// MEDICIÓN PARCIAL. group.bits[q] es null mientras el qubit q no se midió, y 0 o 1 después.
// Los qubits ya medidos condicionan al resto: la distribución es la del circuito completo, filtrada
// por esos bits y renormalizada. Es exacto porque las puertas posteriores solo tocan qubits sin medir
// (una carta medida ya no recibe puertas) y conmutan con la proyección de los medidos.
// ---------------------------------------------------------------------------

// Filtra una distribución conjunta por los bits ya medidos y la renormaliza.
export function condicionar(p, bits = []) {
  const out = new Array(p.length).fill(0);
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    let ok = true;
    for (let q = 0; q < bits.length; q++) {
      if (bits[q] != null && ((i >> q) & 1) !== bits[q]) { ok = false; break; }
    }
    if (ok) { out[i] = p[i]; total += p[i]; }
  }
  if (total > 1e-12) for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// [P(0), P(1)] del qubit q dentro de una distribución conjunta.
export function marginal(p, q) {
  let p1 = 0;
  for (let i = 0; i < p.length; i++) if ((i >> q) & 1) p1 += p[i];
  return [1 - p1, p1];
}

// Distribución conjunta del grupo condicionada a sus bits medidos. `extra` agrega ops solo para este cálculo.
export function distribucionCondicionada(group, extra = []) {
  const g = extra.length ? { qubits: group.qubits, ops: [...group.ops, ...extra] } : group;
  return condicionar(distribucion(g), group.bits || []);
}

// [P(0), P(1)] de un qubit del grupo, condicionado.
export function probabilidadQubit(group, q) {
  return marginal(distribucionCondicionada(group), q);
}

// [P(+), P(−)] del qubit q: agrega una H y mide en la base X. Es lo que cambia la puerta Z.
export function probabilidadFaseQubit(group, q) {
  return marginal(distribucionCondicionada(group, [['h', q]]), q);
}

// Elige un índice según la distribución p (r = número al azar en [0, 1)).
export function elegirIndice(p, r = Math.random()) {
  let acc = 0;
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i; }
  let last = p.length - 1;
  while (last > 0 && p[last] <= 0) last--; // por redondeo: nunca un estado imposible
  return last;
}

// Muestra TODOS los qubits del grupo, compatible con los ya medidos: devuelve bits[q].
export function muestrear(group) {
  const idx = elegirIndice(distribucionCondicionada(group));
  return Array.from({ length: group.qubits }, (_, q) => (idx >> q) & 1);
}

// [P(la carta mide 0), P(la carta mide 1)]: lo que ve su dueño. Si la carta está entrelazada, es la
// probabilidad de la carta sola, condicionada por lo que ya se midió en su grupo. Una carta ya medida es segura.
export function probabilidadCarta(state, idCarta) {
  const c = state.cards[idCarta];
  if (!c.group) return null; // carta clásica: no hay nada que calcular
  const g = state.groups[c.group];
  const medido = g.bits?.[c.qubit];
  if (medido != null) return medido === 0 ? [1, 0] : [0, 1];
  return probabilidadQubit(g, c.qubit);
}
