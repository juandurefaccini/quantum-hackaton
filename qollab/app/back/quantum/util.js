// HELPERS PUROS sobre distribuciones de probabilidad (sin simulación ni Qiskit).
// Los usan todos los motores (referencia.js y qiskit.js): una distribución conjunta del grupo es un
// arreglo de 2^n probabilidades, con el qubit q en el bit q del índice.

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

// Elige un índice según la distribución p (r = número al azar en [0, 1)).
export function elegirIndice(p, r = Math.random()) {
  let acc = 0;
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i; }
  let last = p.length - 1;
  while (last > 0 && p[last] <= 0) last--; // por redondeo: nunca un estado imposible
  return last;
}
