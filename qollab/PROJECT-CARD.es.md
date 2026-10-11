# Qards — juego de cartas cuántico

**Cada carta es un qubit.** Sostiene dos caras posibles a la vez y colapsa a una sola recién al
jugarla.

**Tema:** Quantum Playground · **Licencia:** MIT · **Tags:** `qiskit`, `ionq`, `game`,
`entanglement`, `superposition`

---

## ¿Qué es Qards?

Qards es un juego de descarte donde parte del mazo es cuántico. Se juega 1v1 contra una IA; gana quien
se queda sin cartas. **48 de las 108 cartas son cuánticas**: un solo qubit preparado en superposición
de dos *caras*, por ejemplo *Rojo 5* / *Azul 2*. Antes de jugar se puede sesgar una carta con puertas gratis (`X`, `Z`, `H`) y
entrelazar dos cartas con un `CNOT`. Jugar una carta la **mide**: el colapso decide qué cara sale y si
la jugada es válida. Se apuesta a las probabilidades, pero esas probabilidades son un estado que se
puede modelar, no una moneda oculta.

## La parte cuántica

| Pieza del juego | Objeto cuántico | Dónde en el código |
| :-- | :-- | :-- |
| Carta clásica | Un estado base (un $\lvert 0\rangle$ o $\lvert 1\rangle$ definido) | `back/estado.js` |
| Carta cuántica | Un qubit en **superposición** de dos caras, preparado con $R_y(\theta)$ | `back/estado.js` |
| Grupo entrelazado | Dos o más qubits que comparten un circuito (**CNOT**) | `back/estado.js` (`aplicarCnot`) |
| Puerta X / Z / H | Puerta de un qubit: `X` (intercambio de bits), `Z` (fase), `H` (fase ⇄ probabilidad) | `back/quantum/referencia.js` |
| Puerta CNOT | Puerta entrelazante de dos qubits (control → objetivo) | `back/quantum/referencia.js` |
| Jugar una carta | **Medición** (colapso del grupo) | `back/quantum/qiskit.js`, `services/quantum.js` |

### El circuito, comentado

Una carta cuántica es un circuito de un qubit. Su sesgo en $z$ se elige para que
$P(\lvert 0\rangle) = (1+z)/2$ quede entre 10 % y 90 % (nunca una carta casi clásica):

```python
theta = atan2(sqrt(1 - z**2), z)   # z = 0.6  ->  P(0) = (1+z)/2 = 0.8
card  = QuantumCircuit(1)
card.ry(theta, 0)                  # PREPARAR: la superposición de las dos caras
# ...las puertas X / Z / H se aplican sin medir...
card.measure(0, 0)                 # JUGAR: la medición colapsa a una cara
```

Un `CNOT` fusiona dos cartas en un mismo circuito, así sus resultados quedan correlacionados:

```python
pair = QuantumCircuit(2)
pair.ry(theta0, 0)   # carta control: su propia superposición sesgada
pair.ry(theta1, 1)   # carta target: su propia superposición sesgada
pair.cx(0, 1)        # ENTRELAZAR: un par tipo Bell, no independientes
pair.measure([0, 1], [0, 1])
```

### Por qué la medición y el entrelazado son *esenciales* — no solo azar

- **Jugar = medir.** La acción central del juego es una medición proyectiva: colapsa el grupo de la
  carta y la cara resultante decide la jugada. Es la mecánica del juego, no un generador de azar
  escondido detrás.
- **La fase es la parte genuinamente cuántica.** `Z` cambia la fase relativa ($\lvert + \rangle$ vs
  $\lvert - \rangle$) *sin* cambiar las probabilidades que se ven; una `H` posterior convierte esa fase
  otra vez en probabilidad, así que `H·Z·H` actúa igual que `X`. Las probabilidades visibles dependen
  del *orden* de las puertas: un efecto de interferencia **sin análogo clásico** que una moneda justa
  no puede expresar. (Respaldado por un test que compara `H·Z·H` contra el `Statevector` de Qiskit: la
  suite de tests y `examples/qards_circuit.py`.)
- **El entrelazado liga los resultados.** Con un `CNOT`, medir una carta *condiciona* a la otra: el
  grupo se post-selecciona según el bit medido y se renormaliza,
  $P(x_q \mid \text{bits medidos}) = \dfrac{P(\text{estado conjunto})}{\sum P(\text{compatible})}$, y
  las otras cartas conservan una distribución válida y ajustada.

**Aclaración honesta.** Las *correlaciones* de un par `CNOT`, leídas solo en la base computacional,
también se pueden reproducir con azar clásico compartido (un modelo de variables ocultas para ese
conjunto restringido de mediciones). Lo que acá no tiene análogo clásico es la **fase**: `Z` cambia la
fase sin cambiar las probabilidades visibles, y una `H` posterior convierte esa fase en probabilidad.

Las probabilidades se calculan siempre de forma exacta a partir del vector de estado; el backend solo
aporta la *medición* que colapsa el estado.

### Mover las probabilidades: jugadas favorables con puertas

Antes de jugar una carta podés gastar puertas: son gratis y **no miden**. Cada una cambia el estado de
la carta, así que **la medición que estás por hacer cae más seguido en la cara que querés**. Hay tres
palancas:

| Palanca | Qué hace | Ejemplo (cara $\lvert 0\rangle$ / cara $\lvert 1\rangle$) |
| :-- | :-- | :-- |
| `X` | intercambia las dos caras | 20 % / 80 % → **80 % / 20 %** |
| `H` | convierte la **fase** en probabilidad, hacia la cara que indica la línea **`Fase`** | 50 % / 50 % (`Fase +`) → **≈100 % / 0 %** |
| `Z` | invierte la fase (invisible sola); **elige hacia qué lado** la manda una `H` posterior | — |
| `CNOT` | **liga dos cartas**: lo que mide una, lo sigue la otra | ver jugada 3 |

Regla práctica: **`X` para quedarte con la otra cara, `H` para comprometerte, `Z` antes de `H` para
elegir el lado, `CNOT` para que una segunda carta comparta la suerte de la primera.**

**Jugada 1 — rescatar una carta mala con `X`.** Tu carta dice *Rojo 5* 20 % / *Azul 2* 80 %, y *Azul 2*
es lo que matchea el descarte. Aplicás `X`: las caras se dan vuelta y *Azul 2* queda al 80 %. Sin azar.

**Jugada 2 — comprometerse con `H`, leyendo la línea `Fase`.** Pasá el mouse por la carta: el panel
Info muestra `Fase +` o `Fase −`. Aplicar `H` manda la carta a la cara que apunta la fase, con **al
menos 80 %** (una 50 / 50 lisa va a ≈100 %):
- 80 % / 20 % con `Fase +` → `H` → **90 % / 10 %**
- 50 % / 50 % con `Fase +` → `H` → **≈100 % / 0 %**

¿Querés la *otra* cara? Gastá `Z` primero: invierte la fase, y después `H` cae del lado opuesto
(80 % / 20 % `Fase +` → `Z` → `H` → **10 % / 90 %**). `Z` sola nunca cambia las probabilidades: solo
apunta la `H`.

**Jugada 3 — ligar dos cartas con `CNOT`.** El `CNOT` no sube una carta: **correlaciona** dos. Entrelazá
una carta que vas a leer (el control) con una que querés conservar: una carta al 90 % ligada a un
control 50 / 50 pasa a medir, apenas medís el control, ~90 % en el bit que sacó el control (50 / 50 es
una moneda justa, pero la carta ligada queda fijada). Sirve para elegir *cuándo* se define una carta.
También puede entrelazar una carta del rival (el control sigue siendo tuyo).

Costo: las puertas escasean — recibís **1 cada 2 turnos tuyos** y guardás hasta **3** — y **una carta
ya medida es clásica: no acepta más puertas.** Cada jugada de arriba es un trueque real, no un reroll
gratis.

Todos los números salen del simulador de referencia del juego; además, `H·Z·H ≡ X` se contrasta contra
el `Statevector` de Qiskit (la suite de tests y `examples/qards_circuit.py`).

## Cómo correrlo en Qollab

1. Abrir el proyecto y elegir **Select QPU → simulador local** gratuito (el simulador de IonQ también
   sirve — ver abajo).
2. Presionar **Run**. El tablero aparece arriba de la consola.
3. Arrastrar una carta al descarte (o hacer clic en el descarte), aplicar una puerta y jugar una carta
   cuántica para ver la animación de **colapso** y la narración en el panel **Info**.

En el **simulador local**, CADA colapso es un job de Qiskit. En el **simulador de IonQ** se permite
**un solo job por ejecución**: el primer colapso se mide con el backend de IonQ, y el resto mantiene un
colapso matemáticamente idéntico calculado desde el vector de estado exacto, así la partida nunca se
traba.

**Estado de verificación.** Las piezas están verificadas en local — el simulador de referencia coincide
con el `Statevector` de Qiskit (incluido `H·Z·H ≡ X`) y la suite de tests pasa. **La ejecución dentro
de Qollab no se verificó desde el entorno de desarrollo** (no hay cuenta de Qollab acá): el `backend`
del runtime, el import `qiskit` y el camino de un solo job de IonQ dependen de Qollab.

## Más allá del tutorial

Qards es una **aplicación novedosa** (un juego de cartas como medio cuántico) *y* un **aporte educativo**: convierte
la superposición, el orden de las puertas, el entrelazado y la medición parcial en algo que se
*siente* durante una partida. Más allá de un circuito de Bell de manual, implementa:

- un **estado de carta exacto y por jugador** armado desde un mazo con semilla (`back/estado.js`),
- **medición parcial con condicionamiento** de un grupo entrelazado (`group.bits`, `resolveMeasure`),
- **fase (`Z`) que cambia el resultado de una `H` posterior**, y **`CNOT` que fusiona dos grupos** en
  un circuito,
- un **puerto cuántico intercambiable** con simulador de referencia exacto, IonQ y Qiskit detrás de una
  sola interfaz (`services/quantum.js`); la IA juega la carta jugable de mayor probabilidad exacta de
  coincidir y, en *Difícil*, prueba primero la puerta (`X`/`Z`/`H`/`CNOT`) que más mejora su mejor
  jugada.

## Qué existía antes / créditos

La ventana del hackathon abrió el **2026-10-09 20:00 (-03)**. El primer commit del repositorio es un
esqueleto base (`README.md`, `LICENSE`, `.gitignore`, del 2026-10-09 20:22 -03); todo el código del
juego se escribió dentro de la ventana. Los tres archivos de entrada de la raíz (`index.html`,
`main.js`, `main.css`) son código del proyecto escrito durante la ventana (2026-10-10 -03) y siguen el
layout que Qollab exige para un proyecto JS (`index.html` + `main.js` en la raíz). No se incluye código
previo a la ventana.

- **Librerías de terceros** (`examples/requirements.txt`, Python 3.11): `qiskit==2.5.2`,
  `qiskit-ionq==1.1.1`. **Sin dependencias de runtime en JavaScript**: el DOM, WebGL y el audio están
  escritos a mano.
- **Herramientas de IA usadas:** agentes de código con IA asistieron el código, los tests y la
  documentación durante la ventana; el repositorio incluye `docs/AGENTS.md` como su brief del proyecto.

## Límites conocidos y Remixéalo

**Límites:** la IA en "difícil" prueba puertas pero no es expectimax completo; el color de los
comodines se elige automáticamente (sin picker); el colapso usa `Math.random` para la muestra final
(el mazo tiene semilla, el colapso todavía no es reproducible); Safari no puede correr el proyecto (le
falta WASM JSPI).

**Remix:** reemplazar la heurística de la IA por expectimax sobre las probabilidades ocultas; mover el
motor a un servidor para multijugador real; agregar estados GHZ, puertas de fase o un "espía" con
Grover. Ver `docs/roadmap.md`.

## Enlaces

- **Repositorio:** <https://github.com/juandurefaccini/quantum-hackaton>
- **Video de demo:** `<VIDEO_URL>`

_Licencia MIT — ver `LICENSE`._

This effort is supported by Qollab & IonQ
