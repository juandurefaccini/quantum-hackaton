# Quards — Roadmap

Qué falta, en orden de impacto. Estado actual en [`plan.md`](plan.md); ideas cuánticas más grandes en
[`mejoras/`](mejoras/).

## Corto plazo (producto)

| # | Tema | Detalle |
| :- | :-- | :-- |
| 1 | **Picker de color** | Los comodines eligen el color automáticamente; falta el selector del jugador. |
| 2 | **Semilla reproducible** | Hilar un RNG sembrado a la **medición** y exponer un campo de semilla en la UI (ver [`determinism.md`](determinism.md)). |
| 3 | **IA difícil real** | Expectimax sobre las probabilidades + estimación de la mano rival. |
| 4 | **Validar motores remotos** | Correr `ionq` con una key real y `qiskit` dentro de Qollab; documentar resultados (hoy **no verificado**). |

## Mediano plazo

| # | Tema | Detalle |
| :- | :-- | :-- |
| 5 | **Limpieza de deuda** | Borrar `utils/render.js`, `utils/rules.js` y `ui/circuit.js` (ver [`known-issues.md`](known-issues.md)). |
| 6 | **Más feedback de medición** | Mostrar cómo queda el **grupo entrelazado** tras una medición parcial (hoy solo la carta jugada). |
| 7 | **Accesibilidad** | Revisar contraste y etiquetas ARIA del arrastre. |

## Largo plazo

| # | Tema | Detalle |
| :- | :-- | :-- |
| 8 | **Multijugador** | Mover el motor a un servidor que guarde la mano de cada jugador (el motor ya está desacoplado y es serializable). |
| 9 | **Replay** | Guardar la secuencia de acciones + semilla para reproducir una partida. |

## Ideas cuánticas (propuestas)

Están en [`mejoras/`](mejoras/README.md), con diseño y riesgos cada una: amplitudes complejas,
puertas de fase (S/T/Y/CZ/SWAP), entrelazamiento GHZ/W, visualizador de circuitos, oráculo + Grover
como el "ojo", teleportación y ruido/decoherencia.
