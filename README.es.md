<!--
Topics (configuración del repo): qiskit, quantum-game, ionq, quantum-computing, card-game, educational
-->

# Qards — juego de cartas cuántico

[English](README.md) · [Español](README.es.md)

**Cada carta es un qubit:** tiene dos caras posibles a la vez y colapsa a una sola recién cuando la jugás.

## Jugalo ahora

Un comando (Node.js 18+, sin `npm install`, sin build):

```bash
node front/qards/dev-server.mjs
```

Después abrí <http://localhost:8000>. El motor por defecto es un simulador local, así que **no
necesitás claves ni cuenta** para jugar.

## Cómo se juega

Vos vs. la IA, 1v1. **Gana quien se queda sin cartas en la mano** (las puertas no cuentan).

- Arrancás con **7 cartas**. Una carta es **clásica** (una sola cara — un color y un símbolo fijos) o
  **cuántica** (dos caras posibles, p. ej. *Rojo 5* / *Azul 2*).
- En tu turno podés **preparar gratis** y después **jugar una vez**:
  - **Preparar:** aplicar tus **puertas** — `X`, `Z`, `H` (a una carta) o `CNOT` (a dos). No cuesta
    nada y **no mide**.
  - **Jugar:** arrastrar una carta al descarte. **Esto la mide** — o **robar**, si no podés jugar.
- **Una carta es jugable** si *alguna* de sus caras posibles coincide con el descarte (mismo color o
  símbolo), o si es comodín.
- **Medir** colapsa la carta a una cara: si coincide, va al descarte y aplica su efecto; si no, la
  carta queda en tu mano (ya colapsada) y **robás 1**.
- **Las puertas se otorgan, no se roban:** recibís **1 puerta al azar cada 2 turnos tuyos**, con un
  tope de **3**. `CNOT` entrelaza dos cartas: al medir una, la otra queda fijada.
- **Efectos (2 jugadores):** skip/reverse → el rival pierde el turno; **+2** → el rival roba 2 y
  pierde el turno; **comodín** → elegís color; **+4** → elegís color y el rival roba 4 y pierde el turno.
- **Ojo (espía):** arrancás con **1** y ganás **1 cada 2 turnos** (tope **2**). Gastá una para espiar
  una carta cuántica del rival.

Reglas completas: [`docs/idea.md`](docs/idea.md).

## Mover las probabilidades: jugadas favorables con puertas

Antes de jugar una carta podés gastar puertas: son gratis y **no miden**. Cada una cambia el estado de
la carta, así que **la medición que estás por hacer cae más seguido en la cara que querés**. Hay tres
palancas:

| Palanca | Qué hace | Ejemplo (cara \|0⟩ / cara \|1⟩) |
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

## La parte cuántica

| Pieza del juego | Objeto cuántico | Dónde en el código |
| :-- | :-- | :-- |
| Carta clásica | Un estado base (`\|0⟩` o `\|1⟩` definido) | `back/estado.js` |
| Carta cuántica | Un qubit en **superposición** de dos caras | `back/estado.js`, preparada con `ry` |
| Grupo entrelazado | Dos o más qubits que comparten un circuito (**CNOT**) | `back/estado.js` (`aplicarCnot`) |
| Puerta X / Z / H | Puerta de un qubit: `X` (bit flip), `Z` (fase), `H` (fase↔probabilidad) | `back/quantum/referencia.js` |
| Puerta CNOT | Puerta entrelazante de dos qubits | `back/quantum/referencia.js` |
| Jugar una carta | **Medición** (colapso del grupo) | `front/qards/services/quantum.js` |

Efecto de cada puerta, verificado contra el simulador: [`docs/gates.md`](docs/gates.md). Conceptos en
lenguaje llano: [`docs/quantum-concepts.md`](docs/quantum-concepts.md).

## Correr el circuito con Qiskit

Las mismas tres operaciones (preparar, entrelazar, medir) como programa Qiskit independiente.
Ejecutable de punta a punta en [`examples/qards_circuit.ipynb`](examples/qards_circuit.ipynb) (o
[`examples/qards_circuit.py`](examples/qards_circuit.py)):

```python
import math
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

# Qiskit puro (Statevector) — sin backend ni Aer. Corre también en Pyodide (Qollab).
def measure(qc, shots=2000):
    return Statevector(qc).sample_counts(shots)   # muestrear el estado ES la medición

# Una carta cuántica: |0> con 80% de probabilidad (la cara que sale al medir).
theta = math.atan2(math.sqrt(1 - 0.6**2), 0.6)    # z = 0.6  ->  P(0) = (1+z)/2 = 0.8
card = QuantumCircuit(1)
card.ry(theta, 0)                                 # PREPARAR: superposición de las dos caras
print(measure(card))                              # MEDIR: colapsa a una cara

# Un par entrelazado: el CNOT une dos cartas (solo salen |00> y |11>).
pair = QuantumCircuit(2)
pair.ry(math.pi / 2, 0)                           # carta control en 50/50 exacto
pair.cx(0, 1)                                     # ENTRELAZAR: control -> target
print(measure(pair))
```

Dependencias fijadas: [`examples/requirements.txt`](examples/requirements.txt)
(`qiskit==2.5.2`, `qiskit-ionq==1.1.1`, Python 3.11). El ejemplo usa solo **Qiskit puro
(`Statevector`)**, así que no necesita wheels nativos — corre con un simple
`pip install -r examples/requirements.txt` **y** en el entorno Pyodide de Qollab.

**En Qollab:** el mismo circuito corre en el runtime Pyodide del navegador — armalo y enviálo a un
**simulador o QPU de IonQ** eligiendo el backend en *Select QPU* y apretando **Run**.

## Motores

El colapso pasa por un puerto (`front/qards/services/quantum.js`) con tres adaptadores:

| Motor | Cuándo | Probabilidades | Medición | Estado |
| :-- | :-- | :-- | :-- | :-- |
| `referencia` | local, **por defecto** | exactas (simulador JS) | muestreo local | **verificado** (corre acá, lo usan los tests) |
| `ionq` | local, `?engine=ionq` | exactas (local) | API REST de IonQ vía proxy del dev-server | **no verificado** (no hay key en este repo) |
| `qiskit` | dentro de Qollab | `Statevector` de Qiskit | `backend.run` | **no verificado** (requiere Qollab) |

Cambiar de motor: agregá `?engine=ionq` a la URL, o usá el selector **Motor** del header. Las
probabilidades siempre son exactas (Statevector / referencia). IonQ solo aporta la medición. Si un
motor remoto falla, cae al simulador de referencia. Detalle: [`docs/engines.md`](docs/engines.md).

## Estructura del repo

```
index.html  main.js  main.css   entry (raíz) — monta el juego en #root
back/                           motor puro + capa cuántica (sin reglas ni azar de colapso)
  estado.js                     mazo, cartas, grupos/circuitos, createGame, checkState
  quantum/{util,referencia,qiskit}.js
front/qards/                   la app
  services/                     la única capa que la UI conoce: engine, quantum (puerto), rules, ai, ionq
  ui/                           DOM, carta, animación de colapso, fondo, audio, debug
examples/                       notebook Qiskit ejecutable + requirements fijados
docs/                           toda la documentación
assets/                         notas para grabar el demo (ver assets/README.md; sin GIF)
utils/zip.js                    zip del repo entero (sin dependencias)
```

Docs: [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) (implementación canónica) ·
[`gates.md`](docs/gates.md) · [`quantum-concepts.md`](docs/quantum-concepts.md) ·
[`determinism.md`](docs/determinism.md) · [`engines.md`](docs/engines.md) ·
[`known-issues.md`](docs/known-issues.md) · [`roadmap.md`](docs/roadmap.md).

## Qué aprendimos

- Un juego es un lugar ideal para volver **tangibles** la superposición y la medición: las dos caras
  de una carta *son* los dos estados base, y "jugar" *es* medir.
- Mantener el motor como un **objeto plano y serializable** (`back/estado.js`), sin reglas ni azar de
  colapso, hizo todo testeable y el puerto cuántico intercambiable.
- La **medición parcial** es sutil: medir una carta de un grupo entrelazado condiciona a las demás,
  así que el simulador recalcula el resto del grupo a partir de los bits medidos.
- Publicar a Qollab condiciona el código: solo se empaquetan los imports **estáticos** de ES modules.

## Remixalo

- **IA más lista:** reemplazar la heurística por expectimax sobre las probabilidades ocultas.
- **Multijugador:** mover el motor a un servidor que guarde la mano de cada jugador.
- **Más contenido cuántico:** estados GHZ multi-qubit, puertas de fase, el oráculo de Grover como
  espía — ver [`docs/roadmap.md`](docs/roadmap.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

This effort is supported by Qollab & IonQ
