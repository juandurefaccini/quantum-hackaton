# Qards — Motores cuánticos

El colapso de las cartas es lo único que necesita un motor cuántico. Todo pasa por **un puerto** con
tres adaptadores, elegidos por entorno: `front/qards/services/quantum.js`.

## El puerto

`services/quantum.js` expone una sola interfaz:

| Función | Qué hace | Quién la resuelve |
| :-- | :-- | :-- |
| `probabilidadCarta(state, id)` | `[P(0), P(1)]` de una carta (lo que ve su dueño) | qiskit (Qollab) / referencia (local) |
| `probabilidadesGrupo(group)` | probabilidades de todos los qubits del grupo | ídem |
| `probabilidadesFaseGrupo(group)` | `[P(+), P(−)]` (base X; cambia con `Z`) | ídem |
| `medirGrupo(group)` | **mide** (colapsa): devuelve los bits | qiskit / ionq / referencia (con **fallback**) |
| `setEngine(name)` / `kind()` | cambiar / consultar el motor | UI (selector "Motor") |

Selección del motor:

```js
const hasQollab = typeof backend !== 'undefined';                    // Qollab define `backend`
let engine = hasQollab ? 'qiskit'
           : (configuredEngine() === 'ionq' ? 'ionq' : 'referencia'); // ?engine=ionq o QARDS_ENGINE
```

Dos reglas de oro:

1. **Las probabilidades siempre son exactas** (Statevector en Qollab, simulador en local). IonQ **no**
   se usa para probabilidades, solo para la medición.
2. **Si el motor remoto falla, cae al simulador de referencia.** El juego nunca queda esperando una
   medición que no llega.

## Los tres adaptadores

### `referencia` — local, por defecto · **verificado**

Simulador en JS puro (`back/quantum/referencia.js`). Amplitudes **reales** en un `Float64Array` de
`2^n`, arrancando de `|0…0⟩` y aplicando las matrices de H/X/Z/Ry/CX. `distribucion = amplitudes²`.
Mide con `muestrear()`. Es el motor de los tests y del juego local.

### `ionq` — local con `?engine=ionq` · **no verificado en este repo**

Adaptador `services/ionq.js`. Traduce `ops` a `ionq.circuit.v0` (gateset `qis`) y usa la **API REST**
de IonQ (`POST /v0.3/jobs`, polling hasta `completed`, luego `results`), leyendo `histogram` (QPU) o
`probabilities` (simulador ideal) y muestreando una vez para colapsar.

- **La key nunca va al navegador:** el `dev-server.mjs` **proxya** `/ionq/* → https://api.ionq.co`
  con la key **server-side** (`IONQ_API_KEY`, `.env`, `--key` o `--env`).
- Target por defecto `simulator` (ideal). Para hardware hay que pasar un QPU (p. ej. `qpu.aria-1`);
  hoy **no está expuesto en la UI**.
- **No verificado acá:** no hay key ni se corrió contra IonQ al escribir este documento. Queda como
  **laguna** hasta que se pruebe con una key real.

### `qiskit` — dentro de Qollab · **no verificado acá**

Adaptador `back/quantum/qiskit.js`. Traduce `ops` a un `QuantumCircuit`; calcula probabilidades con
`Statevector` y mide con `backend.run`. En Node, `import 'qiskit'` se resuelve a un **stub** (import
map / hook), así que **solo corre en Qollab**.

- **Ojo con el bit order:** Qiskit escribe el qubit 0 a la **derecha** (`'10'` = qubit1 en 1, qubit0
  en 0). El adaptador lo tiene en cuenta.
- Con qubits ya medidos en el grupo, pide más shots y **post-selecciona** los resultados compatibles.
- **Un job por ejecución en IonQ:** los backends de IonQ admiten **un solo** `backend.run` por *Run*;
  los simuladores locales, los que hagan falta. El puerto lo maneja: el **primer** colapso se mide con
  el backend real y, si el runtime rechaza el segundo job, el resto de la partida se mide con el
  simulador de referencia (el vector de estado ya da la distribución exacta, el colapso es idéntico en
  ley). Ver `front/qards/services/quantum.js` (`remoteJobsExhausted`).
- **No verificado acá:** requiere el entorno Qollab. Queda como **laguna**.

## ¿Qué falta para correr en IonQ real?

Hay **dos caminos**, y conviene no mezclarlos:

| Camino | Cómo | Qué falta |
| :-- | :-- | :-- |
| **A. App local + IonQ (REST)** | `?engine=ionq` → `services/ionq.js` → proxy del dev-server | Una `IONQ_API_KEY`; verificar un run; opcional: exponer el `target` (simulator/QPU) en la UI |
| **B. Qollab + IonQ (Qiskit)** | Generar el bundle (`node qollab/build.mjs`), subir `qollab/app/` a Qollab, motor `qiskit`, elegir backend en *Select QPU* | Ejecutar un run real en Qollab y validar el bit order/histograma (ver `qollab/README-SUBIDA.md`) |

En ambos casos, IonQ aporta **la medición** (el colapso). Las probabilidades siguen siendo exactas y
locales.

> Estado honesto: **`referencia` verificado**; **`ionq` y `qiskit` no verificados** en este repo. Ver
> [`known-issues.md`](known-issues.md).
