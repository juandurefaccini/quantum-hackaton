// Adaptador IonQ (solo para pruebas locales). Mide un grupo con la API REST de
// IonQ a través del proxy del dev-server (la API key queda server-side).
// Las PROBABILIDADES no pasan por acá: se calculan exactas con el simulador de
// referencia (o Qiskit en Qollab). IonQ solo aporta la MEDICIÓN (el colapso).
const base = () => `${globalThis.QUARDS_IONQ_PROXY || ''}/ionq`;

// { qubits, ops } -> circuito ionq.circuit.v0 (gateset qis).
export function toIonQCircuit(group) {
  const circuit = group.ops.map(([gate, ...a]) => {
    if (gate === 'h') return { gate: 'h', target: a[0] };
    if (gate === 'x') return { gate: 'x', target: a[0] };
    if (gate === 'z') return { gate: 'z', target: a[0] };
    if (gate === 'ry') return { gate: 'ry', target: a[1], rotation: a[0] };
    if (gate === 'cx') return { gate: 'cnot', control: a[0], target: a[1] };
    throw new Error(`Puerta no soportada por IonQ: ${gate}`);
  });
  return { format: 'ionq.circuit.v0', gateset: 'qis', qubits: group.qubits, circuit };
}

export async function health() {
  try {
    const r = await fetch(`${base()}/health`);
    if (!r.ok) return { ok: false, hasKey: false };
    return await r.json();
  } catch {
    return { ok: false, hasKey: false };
  }
}

function bitsFromResults(results, qubits) {
  // El simulador ideal de IonQ devuelve probabilidades con claves = índice decimal
  // de estado (qubit 0 = bit menos significativo). Un QPU devuelve `histogram`
  // con bitstrings. En ambos casos muestreamos UNA vez para colapsar.
  const hasHist = results.histogram && Object.keys(results.histogram).length;
  const entries = [];
  if (hasHist) {
    for (const [k, v] of Object.entries(results.histogram)) {
      if (typeof v !== 'number' || !/^[01]+$/.test(k)) continue;
      entries.push([parseInt(k, 2), v]);
    }
  } else {
    const src = results.probabilities && Object.keys(results.probabilities).length ? results.probabilities : results;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v !== 'number' || !/^\d+$/.test(k)) continue;
      const idx = Number(k);
      if (idx < (1 << qubits)) entries.push([idx, v]);
    }
  }
  if (!entries.length) throw new Error('IonQ: resultado sin distribución interpretable');

  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  let r = Math.random() * total, acc = 0, idx = entries[entries.length - 1][0];
  for (const [i, v] of entries) { acc += v; if (r < acc) { idx = i; break; } }
  return Array.from({ length: qubits }, (_, q) => (idx >> q) & 1);
}

// Mide el grupo una vez. target: 'simulator' (ideal) o un QPU (ej. 'qpu.aria-1').
export async function medirGrupo(group, { target = 'simulator', shots = 1, pollMs = 400, timeoutMs = 90000 } = {}) {
  const created = await (await fetch(`${base()}/v0.3/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, shots, input: toIonQCircuit(group) }),
  })).json();
  if (!created.id) throw new Error(`IonQ: no se creó el job (${created.error || JSON.stringify(created)})`);

  const t0 = Date.now();
  let status = created.status;
  while (status !== 'completed') {
    if (status === 'failed' || status === 'canceled') throw new Error(`IonQ: job ${status}`);
    if (Date.now() - t0 > timeoutMs) throw new Error('IonQ: timeout esperando el job');
    await new Promise(r => setTimeout(r, pollMs));
    status = (await (await fetch(`${base()}/v0.3/jobs/${created.id}`)).json()).status;
  }

  const results = await (await fetch(`${base()}/v0.3/jobs/${created.id}/results`)).json();
  return bitsFromResults(results, group.qubits);
}
