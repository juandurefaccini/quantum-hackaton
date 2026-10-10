// Counts come back little-endian (Qiskit convention: q0 rightmost). These
// helpers are the only place that touches key shape, so the fake and the
// Qiskit sources feed the exact same downstream code.
export function parseCounts(raw) {
  const counts = {};
  for (const [key, value] of Object.entries(raw || {})) {
    counts[String(key).replace(/\s+/g, '')] = Number(value);
  }
  return counts;
}

export function allStates(n) {
  const dim = 1 << n;
  return Array.from({ length: dim }, (_, i) => i.toString(2).padStart(n, '0'));
}

export function normalize(counts, n) {
  const out = {};
  for (const s of allStates(n)) out[s] = counts[s] || 0;
  return out;
}
