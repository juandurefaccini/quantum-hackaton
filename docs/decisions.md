# Quards — Decisiones

Registro de las decisiones de diseño resueltas (fuente: `idea.md` + definiciones del equipo).
Cuando una decisión contradice a `idea.md`, la de acá gana y `idea.md` se anota.

> **Integración con el back (2026-10):** el juego final pasó a usar el **motor del back**
> (`back/estado.js` + `back/quantum/qiskit.js`) a través de una capa de **servicios**
> (`front/quards/services/`). Eso cambia el modelo respecto de lo de abajo: las puertas (X/Z/H/**CNOT**)
> **no son cartas** (van en `player.gates`, otorgadas por turno), el mazo es de **108 cartas** (con
> comodines), el entrelazamiento es un **CNOT**, y la **victoria es mano vacía**. Ver
> `front/quards/README.md` y `DESIGN.md`. Las filas siguientes quedan como registro histórico.

| Tema | Decisión | Consecuencia |
| :-- | :-- | :-- |
| Ubicación | App nueva en `front/quards/`, reusando `quantum/` y `collapse/` del probe `front/quards-quantum-lab/` | Los zips de Qollab son autocontenidos: no se comparte código entre apps |
| Base Qollab | `index.html` fragmento + `main.css` + `main.js` (espera `#root`, monta, `await new Promise(() => {})`) | Imports **estáticos** obligatorios (Qollab no empaqueta los dinámicos; falla contra `_nuxt/`) |
| Cartas de acción | Compuertas X/H/Z y entrelazamiento 2/3 **no están en el mazo**: se **otorgan** por turno | Se aplican como **preparación libre** (sin costo de turno, apilables) |
| Modelo de turno | El turno tiene **fase de preparación libre** (compuertas/entrelazamiento) y **fase de jugar** | La carta se **mide solo al jugarla**; aplicar compuertas registra el circuito sin medir |
| Otorgamiento | Al inicio del turno del activo: **1 compuerta** aleatoria (X/H/Z); **cada 2 turnos globales** (2, 4, 6…), además **1 entrelazamiento** aleatorio (2/3) | Van a la mano y se usan ese mismo turno (el turno 1 también otorga) |
| Estado inicial | Cada carta qubit arranca **definida** (|0⟩ o |1⟩) o en **50/50**, al azar por carta | Se reparten **7 qubit** por jugador |
| Jugada inválida | La carta jugada vuelve a tu mano **colapsada** + robás una carta **externa** del mazo, colapsada al vuelo | Termina el turno; la mano crece como castigo |
| Carta externa | Sale **del mazo**, colapsada al vuelo | No hay pila externa aparte |
| Colapso | Pasa por el **adaptador cuántico**: `backend` → `qiskit-source.js`; si no → `fake-source.js` (statevector local) | El reducer **no mide**: recibe el resultado y transiciona |
| Mazo | Caras 4 colores × 0–9. **38 qubit** + **12 acciones UNO** = **50** (sin compuertas/entrelazamiento) · **mano inicial 7 qubit** | Prototipo "UNO completo" |
| Acciones UNO | **Clásico 2p**: skip = el rival pierde su turno; reverse = en 2 jugadores equivale a skip; +2 = el rival roba 2 (colapsadas) y pierde el turno | Cartas de **color** (una sola cara), match por color o símbolo |
| Carta colapsada | Es una carta UNO normal: jugable si matchea; **no** recibe compuertas ni se entrelaza | Confirma puntos 1–2 de `idea.md` |
| Acciones consumen turno | Solo **jugar/robar** y las **acciones UNO** cierran el turno; compuertas y entrelazamiento son **preparación libre** | Reemplaza el punto 3 de `idea.md` |
| Alcance | **1v1 humano vs IA, sin servidor**. El motor queda desacoplado para moverlo a servidor | Multijugador = fase futura |
| IA | 3 niveles: fácil (jugada aleatoria), media (preparación + máx P(válida)), difícil (preparación + preferencia de acciones) | Info oculta: solo conoce sus propias distribuciones |
| Estética | Rica (WebGL 320×180, cartas CSS 3D, CRT overlay, Web Audio) + panel `debug` | Reusada del probe |
| Colapso válido | Al colapsar, si la cara sale y **coincide** con el descarte (color o número) → válida, va al descarte | — |
| Mazo agotado | Se re-mezcla el descarte (menos la carta de arriba) | — |
| Victoria | Gana quien se queda **sin cartas qubit** (las compuertas/entrelazamientos/acciones que queden no cuentan) | — |

## Pendientes / no decidido
- ¿Se puede jugar una acción UNO sobre un descarte de cualquier color o solo matcheando? (default: matchea color o símbolo).
- Regla de "cantar última carta" (UNO!): fuera de alcance por ahora.
- ¿La IA debería usar entrelazamiento además de compuertas? (hoy: solo si mejora la P(válida)).
