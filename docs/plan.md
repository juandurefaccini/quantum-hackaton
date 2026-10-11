# Qards — Estado y plan

Estado actual del proyecto y roadmap. Especificación en [`idea.md`](idea.md), decisiones en
[`decisions.md`](decisions.md) y estructura/implementación en [`ARCHITECTURE.md`](ARCHITECTURE.md)
(mapa del repo en §3, deuda técnica en §11).

## Estado en una línea

**MVP funcional y jugable.** Motor, capa cuántica, reglas, IA, UI y tests (**15/15**) están listos;
lo que falta es **producto** (picker de color, IA difícil, validar Qollab, multijugador).

## Hecho

- ✅ **Motor del back** (`back/estado.js`): mazo de 108 cartas, grupos/circuitos, superposiciones
  `ry`, CNOT que fusiona grupos, `checkState` de coherencia.
- ✅ **Capa cuántica**: puerto (`quantum.js`) + referencia local + adaptador Qiskit + adaptador IonQ
  (vía proxy), con medición parcial condicionada y fallback a la referencia.
- ✅ **Reglas y turnos** (`services/rules.js`): jugabilidad, `play → medir → resolver`, preparación
  libre con cadencia/tope de puertas, efectos clásicos, espía, victoria por mano vacía.
- ✅ **IA** (`services/ai.js`): fácil / media / difícil con `bestPrep`.
- ✅ **UI** (`ui/render.js`): tablero, drag&drop, puertas, ojo, panel Info, animaciones (reparto,
  vuelo, colapso, FLIP), glitch, fondo WebGL, audio, debug.
- ✅ **Tests** (`npm test`): 7 tests verdes — coherencia, puertas, medición, y partidas IA vs IA
  completas en los 3 niveles.
- ✅ **Runtime y packaging**: entry raíz ejecutable, dev-server con proxy IonQ, `build.mjs`
  (`front/qards.zip` para Qollab), `utils/zip.js` (zip del repo).
- ✅ **Documentación**: `README.md`/`README.es.md`, `ARCHITECTURE.md`, `idea.md`, `decisions.md`,
  `plan.md`, `AGENTS.md`, `gates.md`, `quantum-concepts.md`, `determinism.md`, `engines.md`,
  `known-issues.md`, `roadmap.md`, `hackathon-brief.md`.
- ✅ **Ejemplo Qiskit**: `examples/qards_circuit.ipynb` (+ `.py`, `requirements.txt` fijados) —
  ejecutado con `qiskit 2.5.2` usando `Statevector` (sin Aer, corre también en Pyodide).

## Pendiente

| Tema | Detalle |
| :-- | :-- |
| **Picker de color** | Los comodines eligen color automáticamente; falta el selector. |
| **IA difícil real** | Hoy prueba puertas + mayor P; falta expectimax y estimación de la mano rival. |
| **Run en Qollab** | Verificar Qiskit/IonQ dentro de Qollab con un backend real. |
| **Multijugador** | Fase futura: requiere servidor que mantenga estado y manos. |

## Roadmap sugerido

1. Picker de color para comodines.
2. Limpiar la deuda técnica (detalle en `ARCHITECTURE.md` §11): borrar `utils/render.js`,
   `utils/rules.js` y `ui/circuit.js`.
3. IA difícil: expectimax + conteo de cartas del rival.
4. Validar el run en Qollab.
5. Multijugador (servidor).
