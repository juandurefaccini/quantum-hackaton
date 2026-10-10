# Quards

**Quards** es un **UNO cuántico**: un juego de cartas donde cada carta es un qubit en superposición. Gana quien se queda **sin cartas qubit** antes que el rival (las compuertas/entrelazamientos/acciones que le queden no cuentan). Persona vs. IA, y luego multijugador.

## Tipos de cartas

| Carta | Qué es | Equivalente real |
| :---- | :---- | :---- |
| **Carta qubit** | Carta tipo UNO con **dos caras posibles** (por ejemplo Rojo 5 y Azul 2), una por cada estado |0⟩ y |1⟩. Cada carta es un qubit aislado. | Qubit |
| **Carta de compuerta** | Se aplica sobre una carta qubit propia y cambia su estado: **X** intercambia las probabilidades de sus caras, **H** la deja en superposición 50/50, **Z** cambia la fase (solo se nota combinada con H). *(Se otorga por turno; no está en el mazo.)* | Compuertas de un qubit |
| **Carta de entrelazamiento (2 o 3\)** | Une 2 o 3 cartas qubit de tu mano: sus resultados quedan correlacionados. *(Se otorga cada 2 turnos; no está en el mazo.)* | Par de Bell / GHZ |

## Reglas

1. Cada jugador arranca con **7 cartas qubit** ("normales"), cada una **definida** (|0⟩ o |1⟩) **o en superposición 50/50**, al azar; su estado solo lo conoce su dueño. *(Ver `decisions.md`.)*  
2. En tu turno tenés **dos fases**:  
   - **Preparar (libre):** aplicás **cuantas compuertas y entrelazamientos quieras** (incluso varias compuertas a la misma carta). No cuesta turno y **no mide** la carta.  
   - **Jugar (una):** **jugar una carta qubit** sobre el descarte (se mide/colapsa), **jugar una acción UNO**, o **robar** (solo si no podés jugar). Cierra el turno.  
3. **Una carta qubit es jugable si al menos una de sus caras posibles** (con probabilidad mayor que 0\) coincide con el descarte, por color o número.  
4. Al jugarla, **colapsa**: sale una cara según las probabilidades.  
   - Si la cara coincide con el descarte, la carta es **válida** y va al descarte.  
   - Si **no** coincide, es inválida: la carta jugada queda **colapsada** y **vuelve a tu mano**, y además robás una **carta externa del mazo** que queda colapsada al vuelo (fija en la cara que salió, sin superposición). Termina el turno.  
5. Si la carta estaba **entrelazada**, al colapsar se fijan también las cartas con las que estaba unida, correlacionadas con el resultado.

## Otorgamiento por turno

Las compuertas y el entrelazamiento **no están en el mazo**: se otorgan.

- Al inicio de tu turno recibís **1 compuerta aleatoria** (X, H o Z).
- **Cada 2 turnos globales** (turno 2, 4, 6…), además, **1 entrelazamiento aleatorio** (2 o 3 cartas).
- Van a tu mano y podés usarlas ese mismo turno (el turno 1 también otorga).

## Acciones de UNO (mapeo clásico 2p)

El mazo incluye, además de las cartas qubit, cartas de acción **de color** (una sola cara), que se
juegan matcheando color o símbolo:

| Acción | Efecto (2 jugadores) |
| :-- | :-- |
| **Skip** | El rival pierde su turno. |
| **Reverse** | En 2 jugadores equivale a **Skip** (volvés a jugar). |
| **+2** | El rival roba 2 cartas (colapsadas del mazo). |

## Dónde está la estrategia

- **Apostar**: una carta con 50% de ser válida es jugable, pero puede costarte una carta de penalización.  
- **Ahorrar jugadas**: una carta de entrelazamiento puede dejar 2 o 3 cartas listas con una sola acción, en lugar de gastar una compuerta por cada una. Esa es la mecánica de "ahorrar compuertas".  
- **Riesgo del entrelazamiento**: si jugás una carta entrelazada y sale mal, arrastrás a las otras al mismo resultado.  
- **Preparación gratis**: compuertas y entrelazamiento no cuestan turno; el costo es que **no avanzás** hasta que jugás. Podés apilar varias compuertas en una misma carta para maximizar la chance de que el colapso sea válido.  

## La IA

El simulador es trivial: cada carta tiene como mucho 2 amplitudes. Es un juego de información oculta.

- **Fácil**: juega cualquier carta jugable.  
- **Media**: elige la carta con mayor probabilidad de ser válida.  
- **Difícil**: *expectimax* sobre las probabilidades; decide si conviene preparar (compuertas o entrelazamiento) o jugar ya, y estima las manos del rival.

## Implementación

- **JS puro (ES modules), app en Qollab** (`index.html` + `main.css` + `main.js`), sin frameworks ni bundler.  
- Motor de juego separado de la UI; el colapso pasa por un **adaptador**: Qiskit sobre el backend de Qollab, o un sampler de statevector local para desarrollo.  
- Para el hackathon: ejecutar los colapsos con un generador cuántico real (simulador o hardware de IonQ) en lugar de un número aleatorio común.  
- Imports **estáticos** únicamente (Qollab no empaqueta los dinámicos).

## Puntos resueltos

Todos confirmados; el detalle vive en `decisions.md`:

1. "Queda colapsada" aplica a la carta jugada (vuelve a la mano) **y** a la carta externa (sale del mazo).  
2. Una carta colapsada no puede recibir compuertas ni entrelazarse, porque ya es clásica.  
3. Compuertas y entrelazamiento **no** consumen turno (preparación libre); solo jugar/robar y las acciones UNO cierran el turno.  
4. Conjunto de caras: **4 colores × 0–9** (UNO completo).
5. La victoria es **sin cartas qubit**; las compuertas/entrelazamientos/acciones que queden no cuentan.

## Alcance de la primera entrega

- **1v1 humano vs IA**, sin servidor. El motor queda desacoplado para poder moverlo a servidor.  
- IA con 3 niveles (fácil / media / difícil).

## Multijugador (fase futura)

Separación por turnos, con un servidor que mantiene el estado de las cartas y las manos de cada jugador. No entra en la primera entrega.