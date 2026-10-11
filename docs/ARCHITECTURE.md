# Quards — Arquitectura técnica

Documento técnico canónico del proyecto. Describe **cómo está construido y cómo funciona hoy**,
verificado contra el código. Los documentos [`idea.md`](idea.md), [`decisions.md`](decisions.md) y
[`plan.md`](plan.md) cubren producto, decisiones y estado; este cubre la implementación.

> Quards es un **UNO cuántico** 1v1 (humano vs IA). Cada carta es un qubit con dos resultados
> posibles (uno por cada cara `|0⟩` y `|1⟩`). Gana quien se queda **sin cartas en la mano**.
> JS puro (ES modules), **sin frameworks, sin bundler, sin dependencias de runtime**.

## Cómo leer este documento

Es un documento largo; usá este mapa para ir directo a lo que necesitás.

| Si necesitás… | Sección |
| :-- | :-- |
| Los principios y el diagrama general | §1 |
| Levantar la app y elegir motor | §2 |
| Ubicar un archivo | §3 · Apéndice A |
| El modelo de datos (`state`, carta, grupo) | §4 |
| La capa cuántica | §5 |
| Reglas y flujos (secuencias) | §6 |
| La IA | §7 |
| La interfaz | §8 |
| Empaquetar y testear | §9 · §10 |
| Deuda técnica | §11 |
| Glosario | §12 |

---

## 1. Visión de alto nivel

Tres ideas estructuran todo el código:

1. **El estado es un dato plano y serializable.** `back/estado.js` produce un objeto con solo
   números, strings, listas y objetos. Se puede clonar con `structuredClone`, guardar y reproducir
   con una semilla. Esto es lo que permite testear y simular.
2. **El motor no mide.** `back/estado.js` arma el estado y describe circuitos; **no tiene reglas ni
   azar de colapso**. Las reglas viven en `services/rules.js` y la medición en la capa cuántica.
   El flujo es `jugar → medir → resolver`.
3. **La cuántica es un puerto con adaptadores.** La UI nunca habla con Qiskit, IonQ ni el simulador
   directamente: solo con `services/quantum.js`. El adaptador se elige por entorno.

```
                         ┌──────────────────────────────────────────┐
   UI (ui/render.js) ──► │ services/rules.js   (reglas y turnos)     │
                         │ services/ai.js      (IA)                  │
                         │ services/engine.js  (fachada del back)    │
                         └───────────────┬──────────────────────────┘
                                         │ importa
                                         ▼
                         ┌──────────────────────────────────────────┐
                         │ back/estado.js   (motor puro, sin reglas) │
                         └──────────────────────────────────────────┘

   UI ──► services/quantum.js ──► ┌ back/quantum/referencia.js  (local, default)
                                  │ back/quantum/qiskit.js      (Qollab)
                                  └ services/ionq.js            (local, ?engine=ionq)
```

---

## 2. Cómo correr

Requisito: **Node.js 18+** (el dev-server usa `fetch` global y `node:http`). No hay `npm install`.

```bash
node front/quards/dev-server.mjs        # sirve el repo + proxya IonQ
# abrir http://localhost:8000
```

`/` redirige a `/index.html` (entry raíz), que monta la app de `front/quards/` en `#root`.

**Los tres motores cuánticos** (elegidos en `services/quantum.js`, ver §5.1):

| Motor | Cuándo se usa | Probabilidades | Medición (colapso) |
| :-- | :-- | :-- | :-- |
| `referencia` | local, **por defecto** | simulador JS exacto | muestreo local |
| `ionq` | local con `?engine=ionq` o `globalThis.QUARDS_ENGINE='ionq'` | igual (exacta, local) | API IonQ vía proxy del dev-server |
| `qiskit` | dentro de Qollab (`typeof backend !== 'undefined'`) | Qiskit Statevector | `backend.run` |

Las **probabilidades siempre son exactas** (Statevector o simulador de referencia). IonQ solo aporta
la **medición** (el colapso real). Si el motor remoto falla, se cae al simulador de referencia.

**Qollab:** se sube `front/quards.zip` (ver §9). Ahí `backend` existe y el puerto usa Qiskit.

---

## 3. Mapa del repositorio

```
.
├── index.html              entry HTML del repo · import map (qiskit → stub) · monta #root
├── main.js                 entry JS del repo · importa front/quards/main.js
├── main.css                estilos de la app (raíz)
├── README.md · README.es.md   portada del repo (inglés / español)
├── docs/                   toda la documentación (README · ARCHITECTURE · idea · decisions · plan · gates · quantum-concepts · determinism · engines · known-issues · roadmap · hackathon-brief · AGENTS)
├── examples/               notebook Qiskit ejecutable + requirements.txt
├── assets/                 demo.gif (placeholder)
├── back/                   MOTOR + capa cuántica (se importa desde el front)
│   ├── estado.js           motor puro: mazo, grupos/circuitos, createGame, checkState
│   └── quantum/
│       ├── util.js         helpers puros: condicionar, marginal, elegirIndice
│       ├── referencia.js   simulador de referencia (Node / local)
│       └── qiskit.js       adaptador Qiskit (solo Qollab)
├── front/quards/           APP PRINCIPAL
│   ├── index.html          fragmento que espera #root (base Qollab)
│   ├── dev.html            variante local standalone (trae su propio import map)
│   ├── main.js             boot: espera #root, monta, mantiene la sesión viva
│   ├── services/           ÚNICA capa que la UI conoce
│   │   ├── engine.js         fachada de back/estado.js + clone + MAX_QUBITS
│   │   ├── quantum.js        PUERTO cuántico (probabilidades + medición)
│   │   ├── rules.js          reglas y turnos sobre el modelo del back
│   │   ├── ai.js             IA (fácil/media/difícil)
│   │   └── ionq.js           adaptador IonQ (proxy local)
│   ├── ui/                 DOM y estética
│   │   ├── render.js         app completa (render, input, flujo de turnos)
│   │   ├── qard.js           carta del diseño de cards/ (escalable, em + aspect-ratio)
│   │   ├── collapse.js       animación de medición (colapso)
│   │   ├── entangle.js       agrupado visual de cartas entrelazadas en la mano
│   │   ├── circuit.js        SVG del circuito + tooltip  (huérfano, ver §11)
│   │   ├── background.js     fondo WebGL 320×180
│   │   ├── audio.js          SFX con osciladores (sin archivos)
│   │   └── debug.js          panel de diagnóstico on-screen
│   ├── quantum/qiskit-stub.js  stub de qiskit/qiskit.quantum_info (import map en dev)
│   ├── tests/              npm test (hook de resolución de qiskit; fuera del zip)
│   ├── dev-server.mjs      server local + proxy IonQ (fuera del zip)
│   ├── build.mjs           arma front/quards.zip (app plana + back/)
├── cards/                  prototipos de la carta (index · card_final) · qard.js reexporta
└── utils/
    ├── zip.js              empaquetador del repo (zip sin dependencias)
    ├── render.js           copia VIEJA y rota (ver §11)
    └── rules.js            copia VIEJA y rota (ver §11)
```

---

## 4. Modelo de dominio

### 4.1 Carta

Toda carta es un qubit. Dos formas (`back/estado.js:46-52`):

```js
// Clásica: qubit "sin grupo" con la cara ya fija.
{ id, group: null, qubit: null, outcomes: null, face: { color, symbol } }

// Cuántica: dos caras posibles (una por resultado); face = null hasta medir.
{ id, group, qubit, outcomes: [caraSiMide0, caraSiMide1], face: null }
```

Una **cara** es `{ color, symbol }`:
- `symbol`: `0`–`9`, o `'skip'` / `'reverse'` / `'draw2'` / `'wild'` / `'wild4'`.
- `color`: uno de `COLORS = ['red','blue','green','yellow']`, o `null` en comodines.

Al medir, `face = outcomes[bit]` (la carta cuántica se vuelve "clásica": ya tiene cara).

### 4.2 Grupo y circuito

Un **grupo** es un circuito compartido por una o más cartas (`back/estado.js:66-68`):

```js
{ id, qubits, ops, cards: [ids], collapsed, bits: Array(qubits).fill(null) }
```

- `ops`: operaciones del circuito, en orden. Cada op es:
  - `['ry', theta, qubit]` — preparación de la superposición inicial.
  - `['h', qubit]`, `['x', qubit]`, `['z', qubit]` — puertas de un qubit.
  - `['cx', control, target]` — CNOT (entrelazado).
- `bits[q]`: `null` mientras el qubit `q` no se midió; `0`/`1` después. **La medición es parcial**
  (§5.6).
- `collapsed`: `true` cuando todos los `bits` están medidos.
- `cards` / `qubit`: cada carta del grupo sabe qué qubit le toca (`card.qubit`).

Construcción/modificación (`back/estado.js:81-112`):
- `aplicarCnot(cards, groups, controlId, targetId)`: si control y target están en grupos distintos,
  **fusiona** el grupo target dentro del del control (desplaza sus ops con `desplazar()`, reindexa
  sus qubits) y luego agrega `['cx', ...]`. Así se entrelaza sin colapsar.
- `aplicarPuerta1(cards, groups, id, gate)`: agrega `[gate, qubit]` al circuito del grupo.

### 4.3 La partida (`createGame`)

`back/estado.js:248` — `createGame({ players, seed, handSize = 7 })`:

```js
{
  phase: 'play' | 'measuring' | 'over',
  players: [{ id: 'p1'|'p2', name, hand: [cardIds], gates: [gateName] }],
  cards:   { [id]: Carta },
  groups:  { [id]: Grupo },
  deck:    [cardIds],          // el tope es el ÚLTIMO elemento
  discard: [cardIds],          // la primera es una clásica con número (sin efecto)
  activeColor: color,          // color que hay que seguir (lo elige el comodín)
  turn:  { current: 0|1, direction: 1 },
  pending: null | { cardId, player },  // jugada esperando medición
  winner: null | 'p1'|'p2',
  rng:   { seed },             // azar con semilla (mazo, barajar, puertas, espía)
}
```

`services/rules.js:newGame` agrega por jugador `spies` y `turns`, y `state.log` (historial de
texto). El primer jugador arranca con `turns = 1` y ya recibe una puerta.

### 4.4 Catálogo y armado del mazo

`CATALOGO` (`back/estado.js:118`):

| Campo | Valor | Qué hace |
| :-- | :-- | :-- |
| `porColor` | `0`×1, `1..9`×3, `skip/reverse/draw2`×3 por color | mazo base UNO (×4 colores = 148) |
| `comodines` | `wild`×4, `wild4`×4 | comodines sin color (8) |
| `superposiciones` | `48` | cuánticas fabricadas: combinan 2 cartas base (que desaparecen) |
| `sesgoMaximo` | `0.8` | tope del eje z → P(cara a favor) entre 10 % y 90 % |
| `entrelazados` | `0` | CNOTs al armar el mazo; `0` = nada nace entrelazado |
| `puertas` | `['x','z','h','cnot']` | mazo de puertas (todas con la misma chance) |

**Armado** (`armarMazo`, `back/estado.js:171`): mazo base 148 + 8 = **156**; al fabricar 48
superposiciones se consumen 96 cartas base → **60 clásicas + 48 cuánticas = 108 cartas**.

Cada superposición es un grupo de 1 qubit: se sortea `z` en `[-0.8, 0.8]`, `x = ±√(1−z²)`, y la
preparación es `ry(atan2(x, z))`. Con `entrelazados > 0` se aplican CNOTs entre cuánticas.

> **Por qué el plano x-z:** las únicas puertas del juego (H/X/Z/Ry/CX) tienen matrices **reales**,
> así que las amplitudes quedan reales y alcanza un número por estado (ver §5.3).

### 4.5 Invariantes (`checkState`)

`back/estado.js:294` devuelve una lista de problemas (vacía si el estado es coherente). Verifica:
que cada carta esté en exactamente un lugar (mazo/descarte/mano), que cartas y grupos se apunten
correctamente, que `card.face` coincida con el bit medido, que `collapsed` coincida con `bits`, que
las ops no usen qubits inexistentes, y la coherencia de fase (`pending` ⇔ `measuring`, `over` ⇒
`winner`). Los tests lo corren después de cada acción.

---

## 5. Capa cuántica

### 5.1 El puerto (`front/quards/services/quantum.js`)

Una sola interfaz; varios adaptadores. La elección del motor:

```js
const hasQollab = typeof backend !== 'undefined';                       // Qollab define `backend`
let engine = hasQollab ? 'qiskit'
           : (configuredEngine() === 'ionq' ? 'ionq' : 'referencia');   // ?engine= o globalThis.QUARDS_ENGINE
```

- **Probabilidades** (nunca por IonQ, son exactas):
  `probabilidadCarta`, `probabilidadesGrupo`, `probabilidadesFaseGrupo` → qiskit si Qollab, si no
  referencia.
- **Medición** (`medirGrupo`): intenta qiskit/ionq y, ante cualquier error (red, timeout, job
  fallido), **cae al simulador de referencia**. El juego nunca queda esperando una medición.
- `setEngine(name)` permite cambiarlo en caliente (selector "Motor" de la UI); en Qollab queda fijo
  en `qiskit`.

`services/engine.js` es la fachada del back: re-exporta `createGame`, `checkState`,
`aplicarPuerta1`, `aplicarCnot`, `otorgarPuerta`, `sortearPuerta`, `barajar`, `CATALOGO`, `COLORS`,
y agrega `clone` (`structuredClone`) y `MAX_QUBITS = 8`.

### 5.2 Helpers puros (`back/quantum/util.js`)

Sin simulación. Una distribución conjunta del grupo es un arreglo de `2^n` probabilidades, con el
qubit `q` en el bit `q` del índice.

- `condicionar(p, bits)`: filtra por los bits ya medidos y **renormaliza**.
- `marginal(p, q)`: `[P(0), P(1)]` del qubit `q`.
- `elegirIndice(p, r)`: muestrea un índice según `p` (nunca uno imposible por redondeo).

### 5.3 Simulador de referencia (`back/quantum/referencia.js`)

Motor local (tests en Node y juego sin Qollab). Amplitudes en `Float64Array` de `2^n`, arrancando en
`|0…0⟩`, aplicando las matrices reales de H/X/Z/Ry/CX. `distribucion = amplitudes²`.
Expone `distribucionCondicionada`, `probabilidadQubit`, `probabilidadFaseQubit` (agrega una H y mide
en base X → es lo que cambia la puerta Z), `muestrear` y `probabilidadCarta`.

### 5.4 Adaptador Qiskit (`back/quantum/qiskit.js`)

Corre solo en Qollab (en Node `import 'qiskit'` se resuelve a un stub, ver §9).

- `construirCircuito({qubits, ops}, {medir})`: traduce `ops` a `QuantumCircuit`. `ry(ángulo, q)`,
  `cx(control, target)`.
- `distribucionGrupo`: `Statevector` + `condicionar` por `group.bits`.
- `probabilidadCarta / probabilidadesGrupo / probabilidadesFaseGrupo`.
- `medirGrupo(group, backend)`: `backend.run` con `shots = 1` (o `512` si hay qubits ya medidos),
  y **post-selecciona** los resultados compatibles con los bits fijos; si ninguno coincide, muestrea
  la distribución exacta. **Ojo con el bit order:** Qiskit escribe el qubit 0 a la **derecha**
  (`'10'` = qubit1 en 1, qubit0 en 0).

### 5.5 Adaptador IonQ (`front/quards/services/ionq.js`)

Solo para pruebas locales. `toIonQCircuit` traduce `ops` a `ionq.circuit.v0` (gateset `qis`);
`medirGrupo` crea un job (`POST /v0.3/jobs`), hace polling hasta `completed` y lee
`histogram` (QPU) o `probabilities` (simulador ideal), muestreando **una vez** para colapsar,
filtrando por los bits ya medidos. Todo pasa por el **proxy del dev-server**: la API key queda
server-side (`process.env.IONQ_API_KEY` o `.env`), nunca en el browser ni en el repo.

### 5.6 Medición parcial condicionada

Al jugar una carta cuántica **no se mide todo el grupo**: solo su qubit. El resto sigue en
superposición, **condicionado** por lo ya medido. `group.bits` fija el bit medido y las
probabilidades de los demás se recalculan como `condicionar(distribucion, bits)` (filtrado +
renormalización). Es exacto porque las puertas posteriores solo tocan qubits sin medir y conmutan
con la proyección de los medidos (`referencia.js:64-69`).

---

## 6. Reglas y turnos (`front/quards/services/rules.js`)

Todo **muta** `state` (como el motor del back). Constantes ajustables al inicio del archivo:

```js
export const ESPIAR = { inicial: 1, cadaTurnos: 2, maximo: 2 };  // cargas del "ojo"
export const PUERTAS = { cadaTurnos: 2, maximo: 3 };             // cadencia y tope de puertas
export const CNOT_SOBRE_RIVAL = true;                            // el target del CNOT puede ser del rival
```

**Jugabilidad** — `canPlay(state, id)`: la carta es jugable si alguna cara posible matchea el color
vigente o el símbolo del descarte; los comodines siempre son jugables.

**Puertas** (`applyGate`) — preparación **libre** (no cierra el turno): X/Z/H a una carta propia, o
CNOT (control propio → target propio **o del rival**). Error si la carta ya colapsó, si el grupo
superaría `MAX_QUBITS`, etc.

**Turno** — `play` (carta clásica o ya colapsada → `resolvePlay` directo; cuántica → `phase =
'measuring'` y devuelve el grupo a medir). `resolveMeasure(state, bits)` fija `face` de la carta
jugada, actualiza `bits`/`collapsed` del grupo y llama a `resolvePlay`:

- **válida** (matchea o comodín): va al descarte, se aplica el efecto, y gana si la mano queda vacía.
- **inválida**: la carta queda en la mano **colapsada** y el jugador **roba 1** (penalización).

**Efectos UNO** (2 jugadores): `skip`/`reverse` = el rival pierde el turno; `draw2` = roba 2 y pierde
el turno; `wild` = elegís color; `wild4` = elegís color + el rival roba 4 y pierde el turno. El color
del comodín lo elige `chooseWildColor` (el más frecuente en tu mano; todavía no hay picker).

**Avance** (`advance`): rota el turno (salvo `skip`), recarga el espía (`recargarEspia`) y otorga
puerta por cadencia (`darPuerta`, respetando el tope). `draw` solo si no hay jugada posible. Sin
mazo, `reshuffle` re-mezcla el descarte (menos la carta de arriba).

**Espía** (`spyCard`, mecánica extra): gasta una carga y revela **al azar** uno de los dos estados
posibles de una carta cuántica rival, junto con la cara asociada. No mide ni modifica la carta.

### 6.1 Secuencia: jugar → medir → resolver

```
UI (render.js)   rules.js                      quantum.js              motor (remoto)
   │
   │ play(id) ──────►│
   │                 │ ¿clásica o ya colapsada? ──► resolvePlay ──► fin (sin medir)
   │                 │ si no: pending={cardId}; phase='measuring'
   │◄── { needsMeasure: group }
   │
   │ medirGrupo(group) ──────────────────────►│
   │                 │                         │ qiskit/ionq ──────►│  (backend.run / IonQ job)
   │                 │                         │  ×  error / timeout → referencia (fallback local)
   │◄─────────────────────────────────── bits[q]│
   │
   │ playCollapse(...)  ── animación (corre en paralelo a la medición; no bloquea)
   │
   │ resolveMeasure(state, bits) ──►│  fija face=outcomes[bit]; bits[q]=bit; collapsed=…
   │                 │ resolvePlay: ¿la cara matchea el descarte?
   │                 │   sí → descarte + efecto (skip/+2/wild4…) → ¿mano vacía? → winner
   │                 │   no → queda colapsada en la mano + roba 1 (penalización)
   │◄── { valid } / { valid:false } / { valid:true, won:true }
```

### 6.2 Secuencia: CNOT (entrelazar)

```
UI (applyGate 'cnot', control, target) ──► rules.applyGate ──► back.aplicarCnot
   ├─ control y target en grupos distintos → FUSIONA:
   │     ops del target se desplazan k = qubits(control); qubits del target se reindexan a +k
   ├─ agrega ['cx', qubit(control), qubit(target)] al circuito del grupo fusionado
   └─ el grupo pasa a (N+M) qubits; el target puede ser una carta del rival (CNOT_SOBRE_RIVAL)
```

---

## 7. IA (`front/quards/services/ai.js`)

`chooseAction(state, player, level)` devuelve un descriptor que el driver aplica; puede devolver
**preparación** (gate), y el driver repite hasta que la IA juega o roba:

- `easy`: juega cualquier carta jugable al azar.
- `medium`: juega la carta con mayor `matchProbability` (P de que su cara medida matchee).
- `hard`: primero `bestPrep` (prueba, clonando el estado, si alguna puerta o CNOT mejora la mejor
  P de partido) y después la mejor jugada por probabilidad.

La IA **solo conoce sus propias distribuciones** (información oculta).

---

## 8. Interfaz (`front/quards/ui/`)

`render.js` es la app completa (~800 líneas): construye el DOM del tablero, maneja el input y
orquesta el flujo de turnos (incluida la IA con pausas para que se siga la partida).

- **Boot** (`main.js`): espera `#root`, llama a `mount(root)` y termina en
  `await new Promise(() => {})` — mantiene viva la sesión (IonQ solo es alcanzable mientras corre).
- **Input:** seleccionar y **arrastrar** la carta al descarte (o clickear el descarte). Las cartas
  cuánticas muestran sus probabilidades y fase; el panel **Info** resume la carta bajo el mouse.
- **Puertas:** chips en la fila inferior; se elige la puerta y luego el/los targets.
- **Ojo:** espía una carta rival; el resultado aparece en un cartel y queda marcado con 👁.
- **Animaciones:** reparto inicial, vuelo de cartas robadas y jugadas, FLIP al reordenar la mano,
  y la **medición** (`collapse.js`: barrido → colapso → resultado). Todo respeta
  `prefers-reduced-motion`.
- **Estética:** `qard.js` (carta escalable con `--qard-w` + `aspect-ratio`, split diagonal + kets),
  `background.js` (WebGL 320×180), `audio.js` (SFX sin archivos), `entangle.js` (cartas de un mismo
  grupo contiguas y enmarcadas), `debug.js` (panel oculto que se destapa ante un error real).
- **Re-render serializado:** `render()` encola una sola ejecución (evita duplicar cartas si dos
  llamadas se solapan).
- **Narración (panel Info):** al resolverse una jugada/medición, `render.js` guarda una línea con la
  cara que salió, su probabilidad y el veredicto (jugador **y** IA) en un historial `recent` (últimas
  **3** líneas); cada línea va también al panel Debug. El historial se reinicia con "Nueva partida".
- **Comodín en el descarte:** se pinta con el `activeColor` vigente (un comodín no tiene color propio),
  para que se vea qué hay que matchear.
- **Debug:** el panel arranca **apagado** (no persiste) y **colapsado** (solo la barra), para no tapar
  la mano; se expande con su botón o ante un error. El checkbox del header se sincroniza en cada render.

### 8.1 Secuencia: boot

```
index.html (raíz) ──► <script type="module" src="./main.js">
   └─ main.js (raíz) ──► import './front/quards/main.js'
        └─ front/quards/main.js: initDebug(); boot()
             boot(): ¿existe #root? ── no ──► reintenta (setTimeout 150 ms)
                                     └─ sí ──► mount(root)
                                                ├─ initDebug · startBackground (WebGL) · armAudio
                                                ├─ ionqHealth() (¿proxy IonQ disponible?)
                                                ├─ state = rules.newGame(...); render()
                                                ├─ dealAnimation(); scheduleAI()
                                                └─ await new Promise(() => {})  // mantiene la sesión viva (IonQ)
```

---

## 9. Runtime y empaquetado

- **Import maps:** `qiskit` y `qiskit.quantum_info` se mapean a `quantum/qiskit-stub.js` (que
  **lanza** si se construye algo). En el root `index.html` y en `dev.html`. Así `back/quantum/qiskit.js`
  se puede importar estáticamente en dev sin tener Qiskit.
- **Por qué no hay imports dinámicos:** Qollab empaqueta solo los archivos alcanzables por imports
  **estáticos**; un `import()` dinámico resuelve contra la base `_nuxt/` de Qollab y falla. Por eso
  `services/quantum.js` importa los adaptadores de forma estática y elige en runtime.
- **`front/quards/build.mjs`** → `front/quards.zip` para Qollab: copia la app **plana** en la raíz
  (`index.html`, `main.css`, `main.js`, `services/`, `ui/`, `quantum/`, `back/`) y reescribe en
  `services/` las rutas `../../../back/` → `../back/`.
- **`utils/zip.js`** → zip del repo entero (sin dependencias: contenedor ZIP escrito con
  `node:zlib` + CRC32). Ignora `node_modules`, `.git`, `.atl`, `dist`, `build`, `.venv`, etc.

---

## 10. Tests

```bash
node --import ./front/quards/tests/qiskit-hooks.mjs --test front/quards/tests/services.test.js
# o, desde front/quards/:
npm test
```

Node no tiene import maps, así que `tests/qiskit-hooks.mjs` registra un **hook de resolución**
(`qiskit-resolver.mjs`) que mapea `qiskit` / `qiskit.quantum_info` al mismo stub. Los tests corren
con el **motor de referencia**, por lo que el stub (que lanza) nunca se invoca.

Cobertura actual (`tests/services.test.js`, 7 tests, todos verdes):
- `newGame`: 7 cartas por jugador, una puerta para el primero, `checkState` limpio.
- Aplicar una puerta no cierra el turno y la consume; una puerta que no tenés falla.
- Jugar una carta mide y mantiene la coherencia.
- Partidas **IA vs IA** (easy/medium/hard) terminan con ganador y `checkState` limpio, para varias
  semillas.

---

## 11. Problemas conocidos / deuda técnica

- **`ui/circuit.js` está huérfano:** nadie lo importa (el tooltip de circuito se removió del flujo
  actual). Es código muerto.
- **`utils/render.js` y `utils/rules.js` son copias viejas y rotas:** importan `../services/` y
  `./engine.js`, rutas que **no existen** en `utils/`. Versión previa al refactor a `front/quards/`.
- **`front/quards/front - Acceso directo.lnk`** es un acceso directo de Windows sin valor.
- **Comodines:** el color se elige automáticamente (el más frecuente en la mano); falta el picker.
- **IA difícil:** no es expectimax completo ni estima la mano rival (ver `plan.md`).
- **`turn.direction`** existe en el estado pero las reglas 2p no lo usan.
- **`state.log`** se escribe en `rules.js` (historial de texto) pero la UI actual
  (`front/quards/ui/render.js`) **no lo muestra**: la narración nueva usa `lastEvent`, no el log (el
  viejo `utils/render.js` sí lo renderizaba).
- **Motores remotos (`ionq`, `qiskit`):** **no verificados** en este repo (sin key ni Qollab). Ver
  [`engines.md`](engines.md).
- **IonQ (simulador):** ~3.6 s por medición; hay timeouts y fallback a la referencia.
- **Sandbox de Qollab:** el fondo WebGL o las animaciones (rAF) pueden no pintar; el resto sigue.

---

## 12. Glosario

- **Qubit / carta cuántica:** carta con dos `outcomes` (una por estado `|0⟩`/`|1⟩`); se mide al
  jugarla.
- **Carta clásica:** carta sin grupo, con `face` fija (los números/acciones y los comodines).
- **Grupo:** circuito compartido por una o más cartas (1 qubit = superposición; 2+ = entrelazado).
- **Colapso:** la medición que fija `face` a partir de un bit.
- **Medición parcial:** medir solo el qubit de la carta jugada y condicionar el resto del grupo.
- **Puerta:** operación cuántica (X/Z/H/CNOT) que **no** es carta; se otorga por turno y es
  preparación libre.
- **Motor:** el adaptador cuántico activo (`referencia` / `ionq` / `qiskit`).
- **Qollab:** el entorno de ejecución Python+Qiskit donde corre el juego con `backend`.

---

## Apéndice A · Dependencias entre módulos

Quién importa a quién (regla clave: **la UI nunca importa `back/quantum/*` ni `ionq.js`**; solo
`services/*`).

| Módulo | Importa |
| :-- | :-- |
| `index.html` · `main.js` (raíz) | `front/quards/main.js` |
| `front/quards/main.js` | `ui/render.js`, `ui/debug.js` |
| `ui/render.js` | `services/{quantum,rules,ai}.js`, `ui/{background,audio,debug,entangle,qard,collapse}.js` |
| `services/rules.js` | `services/engine.js` |
| `services/engine.js` | `back/estado.js` (`../../../back/`) |
| `services/quantum.js` | `back/quantum/{qiskit,referencia}.js`, `services/ionq.js` |
| `services/ai.js` | `services/{quantum,engine,rules}.js` |
| `services/ionq.js` | (nada interno; `fetch` al proxy) |
| `back/estado.js` | — (hoja) |
| `back/quantum/referencia.js` | `back/quantum/util.js` |
| `back/quantum/qiskit.js` | `qiskit`, `qiskit.quantum_info`, `back/quantum/util.js` |

## Apéndice B · Contratos de retorno

Las funciones de dominio **mutan `state`** y devuelven un resultado (no lanzan por reglas
inválidas):

| Función | Devuelve |
| :-- | :-- |
| `rules.play(state, id)` | `{ needsMeasure: group }` (cuántica) · `{ valid, won? }` · `{ valid: false }` · `{ error }` |
| `rules.resolveMeasure(state, bits)` | `{ valid, won? }` · `{ valid: false }` |
| `rules.applyGate(state, gate, a, b)` | `{ ok: true }` · `{ error }` |
| `rules.spyCard(state, id)` | `{ ok, id, k, face }` · `{ error }` |
| `rules.draw(state)` | `{ ok: true }` · `{ error }` |
| `quantum.medirGrupo(group)` | `bits[]` — **nunca lanza**: ante fallo remoto cae a la referencia |
| `quantum.probabilidadesGrupo(group)` | `[[P(0),P(1)], …]` por qubit |
| `quantum.probabilidadCarta(state, id)` | `[P(0),P(1)]` · `null` (carta clásica) |
| `ai.chooseAction(state, player, level)` | `{ type: 'gate', gate, a, b? }` · `{ type: 'draw' }` · `{ type: 'play', cardId }` · `null` |
| `checkState(state)` | `string[]` — vacío = estado coherente |
