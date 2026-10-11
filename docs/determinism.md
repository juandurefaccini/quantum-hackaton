# Qards — Determinismo y semilla

Qards usa **dos fuentes de azar distintas**, y hoy **solo una es reproducible**. Este documento dice
cuál es cuál, qué se puede repetir y qué **no** (para no prometer de más).

## Qué está sembrado (reproducible)

La partida se arma con una **semilla** (`seed`). Con la misma semilla se repite **exactamente**:

| Qué | Función | Dónde |
| :-- | :-- | :-- |
| Fabricación del mazo (qué caras se combinan en cada cuántica, sesgos `ry`) | `armarMazo` | `back/estado.js` |
| Barajado del mazo y reparto | `barajar` | `back/estado.js` |
| Qué puerta se otorga (y en qué orden) | `sortearPuerta` / `otorgarPuerta` | `back/estado.js`, `services/rules.js` |
| Qué estado revela el **ojo** al espiar | `sortearPuerta(state.rng.seed, [0, 1])` | `services/rules.js` |
| Re-mezclado cuando se agota el mazo | `reshuffle` → `barajar` | `services/rules.js` |

El generador es un PRNG con semilla (`siguiente()` en `back/estado.js`), no `Math.random`. La semilla
viva se guarda en `state.rng.seed` y avanza con cada uso.

## Qué NO está sembrado (no reproducible)

**El colapso (la medición) NO usa la semilla.** Lo decide el motor cuántico:

| Motor | Cómo elige el resultado |
| :-- | :-- |
| `referencia` | `muestrear(group)` → por defecto `Math.random()` (`back/quantum/referencia.js`) |
| `qiskit` | `backend.run(...)` + post-selección con `Math.random` (`back/quantum/qiskit.js`) |
| `ionq` | el job remoto; el muestreo usa `Math.random` (`services/ionq.js`) |

Es **a propósito**: el colapso es el evento cuántico, no un `Math.random` disfrazado. La consecuencia
es que, con la misma semilla, dos partidas **coinciden en el armado y en las puertas**, pero **pueden
divergir en qué cara sale al medir**.

## Entonces, ¿se puede reproducir una partida?

- **Hasta la primera medición, sí.** Con `rules.newGame({ seed })` el estado inicial es idéntico.
- **De punta a punta, no** (hoy). Al medir entra el azar cuántico y la partida puede cambiar de rumbo.
- **Desde la UI no hay control de semilla:** el juego arranca con `seed = Date.now() % 100000`
  (`front/qards/ui/render.js`). No hay forma de fijarla sin tocar código.

En los **tests** (`front/qards/tests/services.test.js`) se fija la semilla (`newGame({ seed })`) y se
verifica que la partida **termina con un ganador** y que el estado queda **coherente** (`checkState`).
**No** se verifica una jugada concreta: eso sería frágil justamente por el colapso no sembrado.

## Cómo reproducir hoy (desde código)

```js
import { newGame } from './front/qards/services/rules.js';
const a = newGame({ seed: 12345 });
const b = newGame({ seed: 12345 });
// a.cards, a.deck, a.players[].hand y a.players[].gates son idénticos.
// Las mediciones, en cambio, no.
```

## Propuesta (ver [`roadmap.md`](roadmap.md))

Para que una partida sea **100% reproducible** (útil para tests, replays y bug reports):

1. Hilar un RNG sembrado hacia la medición: pasar un `r()` determinista a `referencia.muestrear`, y
   equivalente en los adaptadores remotos (post-selección determinista).
2. Exponer un campo de **semilla** en la UI y guardarla en el estado.

Hasta que eso exista, esta página describe el comportamiento **actual**, no una promesa.
