# Qards — Registro de decisiones

Decisiones de diseño, con el **motivo** y **dónde vive cada una en el código**. Cuando una decisión
contradice a `idea.md`, gana la de acá. Ver también [`ARCHITECTURE.md`](ARCHITECTURE.md).

> Las primeras versiones modelaban las puertas y el entrelazamiento como **cartas del mazo**; ese
> modelo quedó descartado. Hoy el juego usa el **motor del back** (`back/estado.js`) y las puertas
> son un recurso aparte. Este documento refleja el estado actual.

## Motor y modelo

| Decisión | Motivo | Dónde |
| :-- | :-- | :-- |
| El **motor del back** (`back/estado.js`) es la fuente de verdad | Estado plano y serializable, sin reglas ni azar de colapso: clonable y reproducible | `back/estado.js` · `services/engine.js` |
| El motor **no trae reglas**: las reglas viven en el front | Separar dominio (qué es) de política (cómo se juega) | `services/rules.js` |
| Toda carta es un qubit; la clásica es un qubit "sin grupo" con cara fija | Un solo modelo para todo; el colapso y la jugabilidad son uniformes | `back/estado.js:46-52` |
| El circuito es del **grupo**, no de la carta | El estado de dos qubits entrelazados es conjunto | `back/estado.js:66-68` |
| Azar **con semilla** para fabricar/barajar/sortear; el colapso no usa esa semilla | Partidas reproducibles para tests; el colapso lo decide la cuántica | `back/estado.js:22-38` |

## Cuántica

| Decisión | Motivo | Dónde |
| :-- | :-- | :-- |
| El colapso pasa por un **puerto con adaptadores** (`referencia`/`ionq`/`qiskit`) | La UI no conoce el backend; el motor se elige por entorno | `services/quantum.js` |
| Las **probabilidades son exactas** (Statevector/referencia); IonQ solo mide | El simulador ideal de IonQ devuelve probabilidades, no muestrea | `services/quantum.js` · `services/ionq.js` |
| **Medición remota con fallback** a la referencia | El juego nunca queda esperando una medición que no llega | `services/quantum.js:47-55` |
| La **medición es parcial** y condiciona el resto del grupo | Al jugar una carta solo se revela su qubit; el resto sigue en superposición | `services/rules.js:118` · `util.js:condicionar` |
| Superposiciones preparadas con **`ry` en el plano x-z** (`sesgoMaximo 0.8`) | Las puertas H/X/Z/Ry/CX tienen matrices reales → amplitudes reales, un número por estado | `back/estado.js:196-228` · `referencia.js` |
| **Entrelazar = CNOT que fusiona grupos** | Un solo mecanismo para armar pares y para jugar un CNOT | `back/estado.js:aplicarCnot` |
| El **target de un CNOT puede ser del rival** (control propio) | Da una jugada ofensiva; el mensaje de error es neutro para no filtrar info | `rules.js:CNOT_SOBRE_RIVAL` |
| La API key de IonQ queda **server-side** (proxy del dev-server) | El browser no puede llamar a `api.ionq.co` (CORS) ni conviene exponer la key | `dev-server.mjs` · `services/ionq.js` |

## Reglas y turnos

| Decisión | Motivo | Dónde |
| :-- | :-- | :-- |
| Puertas X/Z/H/CNOT **no son cartas**: se otorgan por turno y son **preparación libre** | Modelo "cartas = qubits"; las operaciones son gratis y no cierran el turno | `rules.js:PUERTAS` · `estado.js:otorgarPuerta` |
| Cadencia de puerta: **1 por turno propio**, tope 3 en mano | Balance | `rules.js:PUERTAS = { cadaTurnos: 1, maximo: 3 }` |
| Jugada **inválida**: la carta queda colapsada en la mano + robás 1 | Castigo que hace crecer la mano | `rules.js:resolvePlay` |
| Efectos clásicos 2p: skip/reverse = pierde turno, +2, comodín, +4 | Fidelidad al clásico | `rules.js:resolvePlay` |
| Comodín: color **automático** (el más frecuente de tu mano) | No hay picker todavía | `rules.js:chooseWildColor` |
| **Victoria = mano vacía** | Las puertas están aparte, no cuentan | `rules.js:resolvePlay` |
| **Espía (ojo)**: cargas {inicial 1, cada 2 turnos, tope 2}; revela un estado al azar | Mecánica de información oculta (no cuántica) | `rules.js:ESPIAR` · `spyCard` |
| Mazo agotado → re-mezclar el descarte (menos la de arriba) | Continuidad de la partida | `rules.js:reshuffle` |

## Arquitectura y packaging

| Decisión | Motivo | Dónde |
| :-- | :-- | :-- |
| **Imports estáticos** + import map (dev) para `qiskit` | Qollab no empaqueta lo referido solo por `import()` dinámico | `index.html` · `services/quantum.js` |
| El repo **importa `../../../back/`**; el build del zip lo aplana a `../back/` | No vendorizar el motor en el front, pero Qollab necesita estructura plana | `services/*.js` · `build.mjs` |
| La **carta** vive en `front/qards/ui/qard.js` (fuente única, escalable) | El zip se empaqueta plano; `cards/qard.js` la re-exporta | `ui/qard.js` · `cards/qard.js` |
| **Entry raíz** ejecutable (`index.html` + `main.js`) | El repo debe poder levantarse desde la raíz | `index.html` · `main.js` |
| `main.js` termina en `await new Promise(() => {})` | Mantener viva la sesión: IonQ solo es alcanzable mientras corre | `front/qards/main.js` |
| Panel de **debug oculto por defecto**, se destapa ante un error real | Nunca una pantalla negra silenciosa | `ui/debug.js` |

## UX (2026-10)

Hallazgos de las revisiones, resueltos.

| Decisión | Motivo | Dónde |
| :-- | :-- | :-- |
| **Narrar la medición** (cara, probabilidad, veredicto) para jugador e IA | Antes solo decía "Midiendo…": no se veía el resultado | `ui/render.js` (`describeResult`) |
| La narración va al panel **Debug**; el panel **Info** muestra solo info de las cartas | El centro no debe mostrar jugadas anteriores, solo info de cartas (probabilidades/fase al hover) | `ui/render.js` (`pushEvent`, `renderState`) |
| Pintar el **comodín del descarte** con el color vigente (`activeColor`) | Un comodín no tiene color propio → no se sabía qué matchear | `ui/render.js` |
| **Panel Debug apagado** por defecto (sin persistir) + checkbox sincronizado | No arrancar tildado; reflejar el estado real del panel | `ui/debug.js`, `ui/render.js` |

## Alternativas descartadas

- **Imports dinámicos** (como Qubitle): descartados — Qollab no empaqueta los archivos referidos
  solo por `import()`. Se usan imports **estáticos** + import map (dev) para `qiskit`.
- **Vendorizar `back/` dentro del front**: descartado en el repo (se importa `../../../back/`); el
  **build del zip** sí lo empaqueta y reescribe la ruta a `../back/`.
- **Medir todo con IonQ (probabilidades incluidas)**: descartado — el simulador ideal devuelve
  probabilidades (no muestrea). Las probabilidades se calculan exactas (Statevector/referencia) y
  IonQ solo aporta la medición; en un QPU el muestreo es real (`histogram`).

## Pendientes / no decidido

- **Picker de color** para comodines (hoy es automático).
- **IA difícil**: expectimax real + estimación de la mano rival.
- **Verificar Qiskit/IonQ dentro de Qollab** en un run real.
- **Multijugador**: requiere servidor (fase futura).
- `turn.direction` está en el estado pero las reglas 2p no lo usan.
