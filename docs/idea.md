# Qards — Concepto y especificación funcional

**Qards** es un **juego de cartas cuántico**: cada carta es un qubit con dos caras
posibles, una por cada estado `|0⟩` y `|1⟩`. Es 1v1 (**persona vs. IA**). Gana quien se queda
**sin cartas en la mano**.

> Documento de **producto/spec**. Para la implementación ver [`ARCHITECTURE.md`](ARCHITECTURE.md);
> para las decisiones y su motivo, [`decisions.md`](decisions.md); para el estado del trabajo,
> [`plan.md`](plan.md).

---

## 1. Idea

En un juego de descarte clásico, una carta tiene un color y un símbolo, y la jugás si matchea el descarte. Acá una
carta puede estar en **superposición**: sus dos caras son dos cartas posibles a la vez. Recién al
**jugarla se mide** y sale una de las dos. El jugador apuesta: una carta con 50 % de ser jugable
*puede* servir, pero si sale mal paga una penalización.

La capa cuántica se usa de verdad: la superposición la prepara un circuito (`ry`), el entrelazado es
un **CNOT** y el colapso lo decide un **motor cuántico** (simulador local, IonQ o Qiskit).

## 2. Piezas del juego

| Pieza | Qué es | Equivalente cuántico |
| :-- | :-- | :-- |
| **Carta fija** | Se ve como la carta clásica común (color + número/acción, o comodín): una sola cara. Por dentro es un qubit en un **estado definido** con una **cara oculta**; la puerta **SUP** la reabre. | Qubit en `\|0⟩` |
| **Carta cuántica** | Carta con **dos caras posibles** visibles (p. ej. Rojo 5 / Azul 2), una por estado `\|0⟩` y `\|1⟩`. Su estado solo lo conoce su dueño. | Qubit en superposición |
| **Grupo entrelazado** | Dos o más cartas cuánticas unidas por un **CNOT**: sus resultados quedan correlacionados. | Par de Bell / GHZ |
| **Puerta** | Operación cuántica: **X** (intercambia probabilidades), **H** (las convierte en fase), **Z** (invierte la fase), **SUP** (reabre una carta fija), **CNOT** (entrelaza dos cartas). **No es una carta.** | Compuertas |

## 3. Reglas

1. Cada jugador arranca con **7 cartas** (clásicas o cuánticas, al azar).
2. En tu turno:
  - **Preparar (libre):** aplicás las puertas de tu mano que quieras (X/Z/H/SUP a una carta, CNOT a
    dos). **No cuesta turno y no mide.**
   - **Jugar (una):** jugás una carta (arrastrándola al descarte) o **robás** (solo si no podés
     jugar). Esto **cierra el turno**.
3. Una carta es **jugable** si **alguna de sus caras posibles** coincide con el descarte (por color
   o símbolo), o si es comodín.
4. Al jugarla, **se mide** (colapsa el grupo):
   - Si la cara sale **coincidiendo** con el descarte → **válida**: va al descarte y aplica su efecto.
   - Si **no** coincide → **inválida**: la carta queda en tu mano **colapsada** y **robás 1**. Termina
     el turno.
5. Si la carta estaba **entrelazada**, al medir su qubit las demás cartas del grupo quedan
   **condicionadas** por ese resultado (siguen en superposición, pero con las probabilidades
   ajustadas).

## 4. Puertas (se otorgan, no están en el mazo)

- Recibís **1 puerta aleatoria** (X/Z/H/SUP/CNOT) cada **2 turnos propios** (turno 1, 3, 5…), con un
  **tope de 3** en la mano.
- Se acumulan y se aplican **gratis** (no cierran el turno). La carta se mide **recién al jugarla**.

## 5. Efectos de carta (clásicos, 2 jugadores)

| Carta | Efecto |
| :-- | :-- |
| **Skip** | El rival pierde su turno. |
| **Reverse** | En 2 jugadores equivale a **skip** (volvés a jugar). |
| **+2** | El rival roba 2 y pierde el turno. |
| **Comodín** | Elegís color (hoy: se elige automáticamente el más frecuente de tu mano). |
| **+4** | Elegís color y el rival roba 4 y pierde el turno. |

## 6. Mecánica extra: el ojo (espía)

Cada jugador tiene **cargas de espía** (arranca con 1, se recarga cada 2 turnos propios, tope 2).
Gastar una revela **uno de los dos estados posibles** de una carta cuántica del rival (al azar),
junto con la cara asociada. No mide ni modifica la carta.

## 7. La IA

- **Fácil:** juega cualquier carta jugable.
- **Media:** elige la de mayor probabilidad de ser válida.
- **Difícil:** además prueba si una puerta/CNOT mejora la mejor probabilidad antes de jugar.
  (Objetivo a futuro: expectimax completo + estimación de la mano rival.)

## 8. Alcance y motores

- **Alcance:** 1v1 humano vs IA, sin servidor. El motor queda desacoplado para poder moverlo a
  servidor; **multijugador** es fase futura.
- **Motores de colapso:** el juego corre en JS puro; el colapso pasa por un **puerto cuántico** con
  tres adaptadores (`referencia` local, `ionq`, `qiskit`). Detalle en `ARCHITECTURE.md` §2 y §5.
