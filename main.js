// BANCO DE PRUEBAS: comprueba el estado del juego y la parte cuántica con Qiskit.
// No es el juego todavía (no hay turnos ni reglas): sirve para ver que Qiskit responde bien.
import { createGame, checkState, aplicarPuerta1, aplicarCnot } from './estado.js';
import * as qiskitJuego from './quantum/qiskit.js';
import { autotest } from './quantum/autotest.js';

const { probabilidadesGrupo, probabilidadesFaseGrupo, medirGrupo } = qiskitJuego;

const $ = (id) => document.getElementById(id);
const COLOR = { red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo' };
const SIMBOLO = { skip: 'salta', reverse: 'reversa', draw2: '+2', wild: 'comodín', wild4: '+4' };
const cara = (f) => (f.color ? `${COLOR[f.color]} ${SIMBOLO[f.symbol] ?? f.symbol}` : SIMBOLO[f.symbol]);
const pct = (p) => `${(p * 100).toFixed(1)}%`;

// `backend` lo inyecta Qollab.
const elBackend = typeof backend !== 'undefined' ? backend : null;

const MAX_QUBITS = 8; // tope del banco de pruebas: cada qubit duplica el cálculo
let state = null;

function log(texto) {
  $('log').textContent = `${texto}\n${$('log').textContent}`;
}

// Cualquier error se muestra en pantalla y en la consola.
function seguro(fn) {
  return async (...args) => {
    const botones = document.querySelectorAll('button');
    botones.forEach((b) => (b.disabled = true));
    try {
      await fn(...args);
    } catch (err) {
      console.error(err);
      log(`ERROR: ${err?.message ?? err}`);
    } finally {
      botones.forEach((b) => (b.disabled = false));
    }
  };
}

// ---------- Lógica provisoria: la va a reemplazar el motor ----------
// Reparte el resultado de una medición entre todas las cartas del grupo (colapso doble).
function colapsar(groupId, bits) {
  const g = state.groups[groupId];
  g.collapsed = true;
  g.bits = bits;
  for (const id of g.cards) {
    const c = state.cards[id];
    c.face = c.outcomes[bits[c.qubit]];
  }
}

function ubicacion(id) {
  if (state.deck.includes(id)) return 'mazo';
  if (state.discard.includes(id)) return 'mesa';
  const j = state.players.find((p) => p.hand.includes(id));
  return j ? `mano de ${j.name}` : '?';
}

const cuanticas = () => Object.values(state.cards).filter((c) => c.group);

// ---------- Dibujo ----------
async function render() {
  const todas = cuanticas();

  // Estado general
  const grupos = Object.values(state.groups);
  const porTam = {};
  for (const g of grupos) porTam[g.qubits] = (porTam[g.qubits] ?? 0) + 1;
  const problemas = checkState(state);
  const lineas = [
    `Cartas: ${Object.keys(state.cards).length} (${Object.keys(state.cards).length - todas.length} normales, ${todas.length} cuánticas)`,
    `Grupos: ${grupos.length} (${Object.entries(porTam).map(([q, n]) => `${n} de ${q} qubits`).join(', ')})`,
    `Mazo: ${state.deck.length} · Mesa: ${cara(state.cards[state.discard.at(-1)].face)} · Color vigente: ${COLOR[state.activeColor]}`,
    ...state.players.map((p) => `${p.name}: ${p.hand.length} cartas (${p.hand.filter((id) => state.cards[id].group).length} cuánticas) · puertas: [${p.gates.join(', ')}]`),
    problemas.length ? `Coherencia: ${problemas.length} problema(s)\n  - ${problemas.join('\n  - ')}` : 'Coherencia: OK',
  ];
  $('estadoOut').textContent = lineas.join('\n');

  // Probabilidades con Qiskit: una vez por grupo
  const prob = {};
  for (const g of grupos) {
    prob[g.id] = g.collapsed ? g.bits.map((b) => (b === 0 ? [1, 0] : [0, 1])) : await probabilidadesGrupo(g);
  }

  // Fase (P(+) y P(−)) con Qiskit: una vez por grupo. Una carta colapsada ya no tiene fase.
  const fase = {};
  for (const g of grupos) fase[g.id] = g.collapsed ? null : await probabilidadesFaseGrupo(g);

  // Selectores (conservan lo elegido si la carta sigue existiendo)
  for (const [selId, def] of [['cartaA', 0], ['cartaB', 1]]) {
    const sel = $(selId);
    const previo = sel.value;
    sel.replaceChildren(...todas.map((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `${c.id} · ${c.face ? cara(c.face) + ' (colapsada)' : cara(c.outcomes[0]) + ' / ' + cara(c.outcomes[1])}`;
      return o;
    }));
    sel.value = todas.some((c) => c.id === previo) ? previo : todas[def]?.id ?? '';
  }

  // Tabla
  const filas = todas
    .sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }) || a.qubit - b.qubit)
    .map((c) => {
      const [p0, p1] = prob[c.group][c.qubit];
      const g = state.groups[c.group];
      const f = fase[c.group]?.[c.qubit];
      const dif = f ? f[0] - f[1] : 0;
      const signo = !f ? '' : dif > 0.05 ? '+' : dif < -0.05 ? '−' : 'indefinida';
      return `<tr class="${c.face ? 'colapsada' : ''}">
        <td>${c.id}</td><td>${ubicacion(c.id)}</td><td>${g.id} (${g.qubits}q, ${g.ops.length} ops)</td>
        <td>${cara(c.outcomes[0])}</td><td>${pct(p0)}</td><td>${cara(c.outcomes[1])}</td><td>${pct(p1)}</td>
        <td>${f ? pct(f[0]) : ''}</td><td>${f ? pct(f[1]) : ''}</td><td>${signo}</td>
        <td>${c.face ? 'colapsó: ' + cara(c.face) : ''}</td></tr>`;
    });
  $('tabla').innerHTML = `<thead><tr><th>Carta</th><th>Dónde</th><th>Grupo</th><th>Cara si 0</th><th>P(0)</th><th>Cara si 1</th><th>P(1)</th><th>P(+)</th><th>P(−)</th><th>Fase</th><th>Estado</th></tr></thead><tbody>${filas.join('')}</tbody>`;
}

// ---------- Acciones ----------
async function probCarta(id) {
  const c = state.cards[id];
  return (await probabilidadesGrupo(state.groups[c.group]))[c.qubit];
}

const cartaElegida = (selId, nombre) => {
  const id = $(selId).value;
  if (!state.cards[id]) throw new Error(`Elegí la carta ${nombre} en la lista`);
  return id;
};

const puerta = seguro(async (gate) => {
  const a = cartaElegida('cartaA', 'A');
  if (state.cards[a].face) throw new Error(`${a} ya colapsó: no se le puede aplicar una puerta`);

  if (gate === 'cnot') {
    const b = cartaElegida('cartaB', 'B');
    if (a === b) throw new Error('Control y target tienen que ser cartas distintas');
    if (state.cards[b].face) throw new Error(`${b} ya colapsó`);
    const ga = state.groups[state.cards[a].group], gb = state.groups[state.cards[b].group];
    if (ga !== gb && ga.qubits + gb.qubits > MAX_QUBITS) throw new Error(`El grupo resultante tendría más de ${MAX_QUBITS} qubits`);
    const antes = await probCarta(b);
    const desc = ga === gb ? `mismo grupo ${ga.id}` : `${ga.id} (${ga.qubits}q) + ${gb.id} (${gb.qubits}q)`;
    aplicarCnot(state.cards, state.groups, a, b);
    const despues = await probCarta(b);
    log(`CNOT ${a} → ${b} (${desc}): P(0) de ${b} ${pct(antes[0])} → ${pct(despues[0])}`);
  } else {
    const antes = await probCarta(a);
    aplicarPuerta1(state.cards, state.groups, a, gate);
    const despues = await probCarta(a);
    log(`${gate.toUpperCase()} sobre ${a}: P(0) ${pct(antes[0])} → ${pct(despues[0])}`);
  }
  await render();
});

const medir = seguro(async () => {
  const a = cartaElegida('cartaA', 'A');
  const g = state.groups[state.cards[a].group];
  if (g.collapsed) throw new Error(`El grupo ${g.id} ya está colapsado`);
  if (!elBackend) throw new Error('No hay `backend` en este entorno: esto solo funciona dentro de Qollab');
  const bits = await medirGrupo(g, elBackend);
  colapsar(g.id, bits);
  const resultado = g.cards.map((id) => `${id}: ${cara(state.cards[id].face)}`).join(' · ');
  log(`Medido ${g.id} con Qiskit, bits [${bits}] → ${resultado}`);
  await render();
});

const correrAutoprueba = seguro(async () => {
  if (!elBackend) throw new Error('No hay `backend` en este entorno: la autoprueba solo funciona dentro de Qollab');
  $('autoOut').textContent = 'Corriendo…';
  const texto = await autotest(elBackend);
  $('autoOut').textContent = texto;
  log(texto.includes('FALLA') ? 'Autoprueba: HAY FALLAS (ver arriba)' : 'Autoprueba: todo OK');
});

const nueva = seguro(async () => {
  const seed = Number($('seed').value) || 1;
  state = createGame({ players: ['Jugador 1', 'Jugador 2'], seed });
  log(`Partida nueva, semilla ${seed}.`);
  await render();
});

// ---------- Inicio ----------
document.querySelectorAll('[data-puerta]').forEach((b) => b.addEventListener('click', () => puerta(b.dataset.puerta)));
$('btnMedir').addEventListener('click', medir);
$('btnAuto').addEventListener('click', correrAutoprueba);
$('btnNueva').addEventListener('click', nueva);

const faltan = ['probabilidadesGrupo', 'probabilidadesFaseGrupo', 'medirGrupo', 'construirCircuito'].filter((n) => typeof qiskitJuego[n] !== 'function');
if (faltan.length) {
  log(`ERROR: tu quantum/qiskit.js está desactualizado: le falta ${faltan.join(', ')}. Subí de nuevo la versión más reciente.`);
  throw new Error('quantum/qiskit.js desactualizado');
}

$('seed').value = String(Date.now() % 100000);
if (!elBackend) log('Aviso: no hay `backend` en este entorno. Las probabilidades se calculan igual, pero medir y la autoprueba necesitan Qollab.');
await nueva();
