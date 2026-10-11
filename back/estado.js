// ESTADO DEL JUEGO DE CARTAS CUÁNTICO
// Este archivo solo arma el estado inicial de una partida. No tiene reglas ni acciones:
// eso viene después. El estado es un objeto plano (solo números, textos, listas y objetos),
// así se puede guardar, copiar y reproducir sin sorpresas.

export const COLORS = ['red', 'blue', 'green', 'yellow'];

// ---------------------------------------------------------------------------
// CARAS
// Una cara es { color, symbol }.
//   symbol: un número del 0 al 9, o una acción: 'skip', 'reverse', 'draw2', 'wild', 'wild4'
//   color:  uno de COLORS, o null en los comodines ('wild' y 'wild4'), que no tienen color
// El efecto de una carta sale de su símbolo. En una carta cuántica, del símbolo de la cara que
// queda al colapsar: una superposición puede ser un 5 o un +4 según cómo mida.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Azar con semilla: la misma semilla da siempre la misma partida.
// Se usa para fabricar cartas, barajar y sortear puertas. El colapso de las cartas lo decide
// la medición cuántica, no esto.
// ---------------------------------------------------------------------------
function siguiente(seed) {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

export function barajar(items, seed) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const r = siguiente(seed);
    seed = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { items: a, seed };
}

// ---------------------------------------------------------------------------
// CARTAS
// Toda carta es un qubit. Tiene dos caras posibles, una por resultado de la medición (0 o 1).
// Una carta clásica es un qubit "sin grupo" cuya cara ya está fija: se trata como todas las demás.
// Las puertas cuánticas NO son cartas: van en un mazo aparte (ver PUERTAS).
// ---------------------------------------------------------------------------
function cartaClasica(id, color, symbol) {
  return { id, group: null, qubit: null, outcomes: null, face: { color, symbol } };
}

function carta(id, group, qubit, caraSiMide0, caraSiMide1) {
  return { id, group, qubit, outcomes: [caraSiMide0, caraSiMide1], face: null };
}

// ---------------------------------------------------------------------------
// GRUPOS
// Un grupo dice qué qubits comparten estado. El circuito es del grupo, no de la carta,
// porque el estado de dos qubits entrelazados es conjunto. Cada qubit del grupo es una carta.
//   ops:       lista de operaciones. Empieza con la preparación y después solo crece.
//   cards:     cartas que comparten ese circuito (cada carta sabe qué qubit le toca)
//   bits:      resultado de la medición por qubit: null mientras esa carta no se midió, 0 o 1 después.
//              La medición es PARCIAL: al jugar una carta solo se mide su qubit. Las demás cartas del
//              grupo siguen en superposición, condicionadas por los bits ya medidos (el estado que
//              queda es el del circuito `ops` filtrado por esos bits y renormalizado).
//   collapsed: true cuando TODOS los qubits del grupo ya se midieron
// ---------------------------------------------------------------------------
function grupo(id, qubits, ops, cards) {
  return { id, qubits, ops, cards, collapsed: false, bits: Array(qubits).fill(null) };
}

// Mueve una operación k qubits hacia arriba (para cuando se fusionan dos grupos).
function desplazar([gate, ...a], k) {
  if (gate === 'ry') return [gate, a[0], a[1] + k];
  if (gate === 'cx') return [gate, a[0] + k, a[1] + k];
  return [gate, a[0] + k]; // 'h', 'x', 'z'
}

// Aplica un CNOT entre dos cartas sin colapsar. Si están en grupos distintos, los fusiona: el grupo
// de la carta de control absorbe al otro (sus qubits pasan a numerarse a continuación) y después se
// agrega la puerta al circuito. Así es como se entrelaza. Se usa al armar el mazo y se va a usar
// igual cuando un jugador juegue un CNOT en partida. Modifica `cards` y `groups` directamente.
export function aplicarCnot(cards, groups, idControl, idTarget) {
  const cc = cards[idControl];
  const ct = cards[idTarget];
  if (idControl === idTarget) throw new Error('Control y target tienen que ser cartas distintas');
  if (!cc?.group || !ct?.group || cc.face || ct.face) {
    throw new Error('El CNOT solo se aplica a cartas sin colapsar');
  }
  const gc = groups[cc.group];
  if (ct.group !== cc.group) {
    const gt = groups[ct.group];
    const k = gc.qubits;
    gc.ops.push(...gt.ops.map((op) => desplazar(op, k)));
    gc.qubits += gt.qubits;
    gc.bits.push(...(gt.bits || Array(gt.qubits).fill(null))); // los qubits ya medidos conservan su bit
    for (const id of gt.cards) {
      cards[id].group = gc.id;
      cards[id].qubit += k;
      gc.cards.push(id);
    }
    delete groups[gt.id];
  }
  gc.ops.push(['cx', cc.qubit, ct.qubit]);
}

// Aplica una puerta de un solo qubit (x, z o h) a una carta sin colapsar: agrega la operación al
// circuito de su grupo, sobre el qubit de esa carta. Modifica `cards` y `groups` directamente.
export function aplicarPuerta1(cards, groups, idCarta, gate) {
  if (!['x', 'z', 'h'].includes(gate)) throw new Error(`Puerta de un qubit desconocida: ${gate}`);
  const c = cards[idCarta];
  if (!c?.group || c.face) throw new Error('La puerta solo se aplica a cartas sin colapsar');
  groups[c.group].ops.push([gate, c.qubit]);
}

// Pone una carta FIJA (en estado definido, con cara) en SUPERPOSICIÓN: la "reabre" (borra su cara y
// el bit del grupo) y le aplica la puerta `sup` (matriz de Hadamard), que sobre |0⟩ deja 50/50 entre
// sus dos caras. Solo vale para cartas con cara: una ya superpuesta se prepara con H/X/Z comunes.
export function aplicarSuperponer(cards, groups, idCarta, gate = 'sup') {
  const c = cards[idCarta];
  if (!c?.group) throw new Error('La carta no es cuántica');
  if (!c.face) throw new Error('La carta ya está en superposición');
  const g = groups[c.group];
  c.face = null;
  g.bits[c.qubit] = null;
  g.collapsed = false;
  g.ops.push([gate, c.qubit]);
}

// ---------------------------------------------------------------------------
// CATÁLOGO
// Es el lugar donde se ajusta el balance.
// ---------------------------------------------------------------------------
export const CATALOGO = {
  // Mazo base de 156 cartas: el juego de descarte clásico con 3 copias (en vez de 2) de cada número y de cada
  // acción, un solo cero por color y los 8 comodines de siempre. De acá salen las cartas con las que se
  // fabrican las cuánticas: el mazo final queda con 48 cartas EN SUPERPOSICIÓN + 60 cartas FIJAS (qubits
  // en un estado definido, que se ven de una cara pero guardan una cara oculta) = 108.
  // Cada entrada es [símbolo, copias por color].
  porColor: [
    [0, 1],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
    ['skip', 3], ['reverse', 3], ['draw2', 3],
  ],
  // Comodines: sin color. Cada entrada es [símbolo, copias en total].
  comodines: [['wild', 4], ['wild4', 4]],

  // Cartas cuánticas: cuántas se fabrican. Cada una sale de combinar dos cartas del mazo base
  // (esas dos desaparecen).
  superposiciones: 48,
  // Tope del eje z de las superposiciones: 0.8 -> ninguna carta pasa de 90 % a favor de una cara.
  // Con 1 podrían salir cartas casi clásicas; con 0 todas serían 50/50.
  sesgoMaximo: 0.8,
  // Cuántos CNOT se aplican al armar el mazo. Cada uno une dos cartas cuánticas en un par entrelazado.
  // 0 = ninguna carta nace entrelazada: el entrelazamiento solo aparece cuando un jugador juega un CNOT.
  // (Con 24 quedarían las 48 cartas cuánticas emparejadas.)
  entrelazados: 0,

  // Mazo de puertas, aparte del de cartas. Cada entrada repetida suma chance: X y CNOT salen seguido,
  // H y Z menos (Z sola no cambia probabilidades y H deja la carta casi clásica), y 'sup' (superposición)
  // es la puerta que reabre una carta fija. 'x', 'z', 'h' y 'sup' se aplican a una carta; 'cnot' a dos.
  puertas: ['x', 'x', 'cnot', 'cnot', 'h', 'z', 'sup', 'sup'],
};

// ---------------------------------------------------------------------------
// PUERTAS
// No son cartas: no tienen color ni símbolo, y no van al descarte. Cada jugador guarda en
// `gates` las que tiene, y se acumulan. Se sortean con el azar con semilla, todas con la misma chance.
// ---------------------------------------------------------------------------
export function sortearPuerta(seed, puertas = CATALOGO.puertas) {
  const r = siguiente(seed);
  return { gate: puertas[Math.floor(r.value * puertas.length)], seed: r.seed };
}

// Le da una puerta al azar al jugador del turno actual. Modifica `state` directamente. Cuándo darla
// (cadencia y tope) lo decide quien la llama: ver PUERTAS en front/qards/services/rules.js.
export function otorgarPuerta(state) {
  const jugador = state.players[state.turn.current];
  const s = sortearPuerta(state.rng.seed);
  state.rng.seed = s.seed;
  jugador.gates.push(s.gate);
  return s.gate;
}

// ---------------------------------------------------------------------------
// MAZO: convierte el catálogo en cartas y grupos con sus ids. El azar (con semilla) se usa para
// fabricar las superposiciones y los pares. Devuelve también la semilla ya avanzada.
// ---------------------------------------------------------------------------
export function armarMazo(catalogo = CATALOGO, seed = 1) {
  const cards = {};
  const groups = {};
  let nCarta = 0, nGrupo = 0;
  const nuevaCarta = () => `c${++nCarta}`;
  const nuevoGrupo = () => `g${++nGrupo}`;

  // 1) Clásicas con color
  for (const color of COLORS) {
    for (const [symbol, copias] of catalogo.porColor) {
      for (let i = 0; i < copias; i++) {
        const id = nuevaCarta();
        cards[id] = cartaClasica(id, color, symbol);
      }
    }
  }

  // 2) Comodines (sin color)
  for (const [symbol, copias] of catalogo.comodines) {
    for (let i = 0; i < copias; i++) {
      const id = nuevaCarta();
      cards[id] = cartaClasica(id, null, symbol);
    }
  }

  // Caras base del mazo: se usan (duplicadas) para darle a cada carta fija su cara OCULTA.
  const carasBase = Object.values(cards).map((c) => c.face);

  // 3) Superposiciones: se fabrican "por detrás" combinando dos cartas clásicas del mazo.
  //    Las dos cartas desaparecen y sus caras pasan a ser las dos caras posibles de una carta nueva
  //    (cara si mide 0, cara si mide 1). Es un grupo de 1 qubit.
  //    El estado es un vector sobre los ejes z y x (plano x-z de la esfera de Bloch). Un estado
  //    puro solo tiene un grado de libertad ahí, así que se sortea z entre -sesgoMaximo y +sesgoMaximo
  //    (a favor de la primera cara si es positivo, de la segunda si es negativo) y x sale de que el
  //    vector tenga largo 1. La preparación es ry(theta) con theta = atan2(x, z), y queda
  //    P(primera cara) = (1 + z) / 2, repartido parejo entre 10 % y 90 %.
  const azar = () => { const r = siguiente(seed); seed = r.seed; return r.value; };
  const mezcla = barajar(Object.keys(cards), seed);
  seed = mezcla.seed;
  const pool = mezcla.items;
  const mismaCara = (p, q) => p.color === q.color && p.symbol === q.symbol;
  const superposiciones = [];
  for (let n = 0; n < catalogo.superposiciones; n++) {
    const idA = pool.pop();
    const j = pool.findIndex((id) => !mismaCara(cards[id].face, cards[idA].face)); // dos caras distintas
    if (j < 0) throw new Error('No quedan cartas distintas para combinar');
    const [idB] = pool.splice(j, 1);
    const caraA = cards[idA].face;
    const caraB = cards[idB].face;
    delete cards[idA];
    delete cards[idB];

    const z = catalogo.sesgoMaximo * (2 * azar() - 1);
    const signo = azar() < 0.5 ? -1 : 1; // fase: x positivo = ket +, x negativo = ket −
    const x = signo * Math.sqrt(1 - z * z);
    const gid = nuevoGrupo();
    const cid = nuevaCarta();
    groups[gid] = grupo(gid, 1, [['ry', Math.atan2(x, z), 0]], [cid]);
    cards[cid] = carta(cid, gid, 0, caraA, caraB);
    superposiciones.push(cid);
  }

  // 3.b) Cartas FIJAS: las que sobraron del pool son qubits en un estado DEFINIDO. Se siguen viendo
  //      como una carta de una sola cara (outcomes[0] = cara visible) pero guardan una segunda cara
  //      OCULTA (outcomes[1]) tomada de un pool DUPLICADO de caras base. Nacen en |0⟩ con el bit ya
  //      medido (bits=[0], collapsed), así una puerta de superposición ('sup') las puede reabrir.
  const dup = barajar(carasBase, seed);
  seed = dup.seed;
  const dupPool = dup.items;
  let dip = 0;
  for (const idV of pool) {
    const visible = cards[idV].face;
    let partner = visible;
    while (dip < dupPool.length) { // primera cara del pool duplicado distinta de la visible
      const f = dupPool[dip++];
      if (!mismaCara(f, visible)) { partner = { ...f }; break; }
    }
    const gid = nuevoGrupo();
    const g = grupo(gid, 1, [], [idV]);
    g.bits = [0];         // ya "midió" 0: su cara visible es outcomes[0]
    g.collapsed = true;
    groups[gid] = g;
    cards[idV] = { id: idV, group: gid, qubit: 0, outcomes: [visible, partner], face: visible };
  }

  // 4) Pares entrelazados: se aplica un CNOT entre dos cartas cuánticas (control y target al azar).
  //    Los dos grupos se fusionan en uno de 2 qubits. Como el target tiene su propia superposición,
  //    el entrelazamiento no es "perfecto": el control condiciona al target sin decidirlo del todo.
  if (catalogo.entrelazados * 2 > superposiciones.length) {
    throw new Error('Hay más pares entrelazados que cartas cuánticas disponibles');
  }
  const mezclaPares = barajar(superposiciones, seed);
  seed = mezclaPares.seed;
  for (let n = 0; n < catalogo.entrelazados; n++) {
    aplicarCnot(cards, groups, mezclaPares.items[2 * n], mezclaPares.items[2 * n + 1]);
  }

  return { cards, groups, ids: Object.keys(cards), seed };
}

// ---------------------------------------------------------------------------
// PARTIDA NUEVA
// ---------------------------------------------------------------------------
export function createGame({ players, seed = 1, handSize = 7 }) {
  if (players.length < 2) throw new Error('Hacen falta al menos 2 jugadores');

  const mazo = armarMazo(CATALOGO, seed | 0);
  const barajado = barajar(mazo.ids, mazo.seed);
  const deck = barajado.items; // el tope es el último

  // La primera carta de la mesa es una carta FIJA con número (visible, sin efecto).
  const i = deck.findIndex((id) => {
    const c = mazo.cards[id];
    return c.face && typeof c.face.symbol === 'number';
  });
  const [primera] = deck.splice(i, 1);

  const state = {
    phase: 'play',                       // 'play' | 'measuring' | 'choosing' | 'over'
    players: players.map((name, n) => ({ id: `p${n + 1}`, name, hand: [], gates: [] })),
    cards: mazo.cards,
    groups: mazo.groups,
    deck,
    discard: [primera],
    // Color que hay que seguir. Casi siempre es el de la carta de arriba, pero un comodín
    // no tiene color propio: quien lo juega elige uno, y queda guardado acá.
    activeColor: mazo.cards[primera].face.color,
    turn: { current: 0, direction: 1 },
    pending: null,                       // jugada esperando una medición ('measuring') o un color ('choosing')
    winner: null,
    rng: { seed: barajado.seed },
  };

  for (let r = 0; r < handSize; r++) {
    for (const p of state.players) p.hand.push(state.deck.pop());
  }

  // Empieza el turno del primer jugador: recibe su puerta. Los demás reciben la suya al llegarles el turno.
  otorgarPuerta(state);
  return state;
}

// ---------------------------------------------------------------------------
// CONTROL DE COHERENCIA
// Devuelve una lista de problemas (vacía si el estado está bien). Útil para tests:
// después de cada acción debería seguir vacía.
// ---------------------------------------------------------------------------
const indicesDe = ([gate, ...a]) => (gate === 'ry' ? [a[1]] : gate === 'cx' ? [a[0], a[1]] : [a[0]]);

export function checkState(state) {
  const problemas = [];

  // Cada carta está en exactamente un lugar: mazo, descarte o la mano de un jugador
  const lugares = [...state.deck, ...state.discard, ...state.players.flatMap((p) => p.hand)];
  const ids = Object.keys(state.cards);
  if (lugares.length !== ids.length) problemas.push(`hay ${lugares.length} ubicaciones para ${ids.length} cartas`);
  if (new Set(lugares).size !== lugares.length) problemas.push('una carta aparece en más de un lugar');
  for (const id of lugares) if (!state.cards[id]) problemas.push(`id inexistente: ${id}`);

  // Cartas y grupos se apuntan entre sí correctamente
  for (const c of Object.values(state.cards)) {
    if (c.group) {
      const g = state.groups[c.group];
      if (!g) problemas.push(`${c.id}: grupo ${c.group} no existe`);
      else {
        if (!g.cards.includes(c.id)) problemas.push(`${c.id}: no figura en su grupo ${g.id}`);
        if (c.qubit >= g.qubits) problemas.push(`${c.id}: qubit ${c.qubit} fuera del grupo ${g.id}`);
        const medida = g.bits?.[c.qubit] != null;
        if (medida !== (c.face !== null)) problemas.push(`${c.id}: su cara no coincide con el bit medido en el grupo ${g.id}`);
      }
    }
  }
  for (const g of Object.values(state.groups)) {
    for (const id of g.cards) if (state.cards[id]?.group !== g.id) problemas.push(`grupo ${g.id}: la carta ${id} no apunta de vuelta`);
    // Cada qubit del grupo es una carta, y el circuito no puede usar qubits que no existen
    if (g.cards.length !== g.qubits) problemas.push(`grupo ${g.id}: ${g.qubits} qubits y ${g.cards.length} cartas`);
    if (!Array.isArray(g.bits) || g.bits.length !== g.qubits) problemas.push(`grupo ${g.id}: bits no tiene un lugar por qubit`);
    else if (g.collapsed !== g.bits.every((b) => b !== null)) problemas.push(`grupo ${g.id}: collapsed no coincide con los bits medidos`);
    const qubitsDeCartas = g.cards.map((id) => state.cards[id]?.qubit).sort();
    if (qubitsDeCartas.some((q, n) => q !== n)) problemas.push(`grupo ${g.id}: los qubits de sus cartas no son 0..${g.qubits - 1}`);
    for (const op of g.ops) {
      if (indicesDe(op).some((q) => !(q >= 0 && q < g.qubits))) problemas.push(`grupo ${g.id}: la operación ${JSON.stringify(op)} usa un qubit inexistente`);
    }
  }

  // Puertas de los jugadores
  for (const p of state.players) {
    for (const gate of p.gates) if (!CATALOGO.puertas.includes(gate)) problemas.push(`${p.id}: puerta desconocida ${gate}`);
  }

  // Coherencia de fase
  if (state.phase === 'measuring' && !state.pending) problemas.push('fase measuring sin jugada pendiente');
  if (state.phase === 'choosing' && !state.pending) problemas.push('fase choosing sin comodín pendiente');
  if (state.phase !== 'measuring' && state.phase !== 'choosing' && state.pending) problemas.push('hay jugada pendiente fuera de las fases measuring/choosing');
  if (state.phase === 'over' && !state.winner) problemas.push('partida terminada sin ganador');

  // Mesa: la carta de arriba tiene cara, y hay un color vigente válido
  const top = state.cards[state.discard[state.discard.length - 1]];
  if (!top || !top.face) problemas.push('la carta de arriba del descarte no tiene cara fija');
  if (!COLORS.includes(state.activeColor)) problemas.push(`color vigente inválido: ${state.activeColor}`);

  return problemas;
}
