<!--
Topics (configuración del repo): qiskit, quantum-game, ionq, quantum-computing, unocards, educational
-->

# Quards — UNO cuántico

**Cada carta es un qubit:** tiene dos caras posibles a la vez y colapsa a una sola recién cuando la jugás.

![Una jugada midiéndose](assets/demo.gif)

> **Placeholder del GIF.** Grabá ~10s de un turno normal (robar → aplicar una puerta → jugar una
> carta → la animación de colapso) y guardalo como `assets/demo.gif`. Ver [`assets/`](assets/).

## Jugalo ahora

Un comando (Node.js 18+, sin `npm install`, sin build):

```bash
node front/quards/dev-server.mjs
```

Después abrí <http://localhost:8000>. El motor por defecto es un simulador local, así que **no
necesitás claves ni cuenta** para jugar.

## Cómo se juega

Vos vs. la IA, 1v1. **Gana quien se queda sin cartas en la mano** (las puertas no cuentan).

- Arrancás con **7 cartas**. Una carta es **clásica** (una sola cara — los colores/números de UNO) o
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

## La parte cuántica

| Pieza del juego | Objeto cuántico | Dónde en el código |
| :-- | :-- | :-- |
| Carta clásica | Un estado base (`\|0⟩` o `\|1⟩` definido) | `back/estado.js` |
| Carta cuántica | Un qubit en **superposición** de dos caras | `back/estado.js`, preparada con `ry` |
| Grupo entrelazado | Dos o más qubits que comparten un circuito (**CNOT**) | `back/estado.js` (`aplicarCnot`) |
| Puerta X / Z / H | Puerta de un qubit: `X` (bit flip), `Z` (fase), `H` (fase↔probabilidad) | `back/quantum/referencia.js` |
| Puerta CNOT | Puerta entrelazante de dos qubits | `back/quantum/referencia.js` |
| Jugar una carta | **Medición** (colapso del grupo) | `front/quards/services/quantum.js` |

Efecto de cada puerta, verificado contra el simulador: [`docs/gates.md`](docs/gates.md). Conceptos en
lenguaje llano: [`docs/quantum-concepts.md`](docs/quantum-concepts.md).

## Correr el circuito con Qiskit

Las mismas tres operaciones (preparar, entrelazar, medir) como programa Qiskit independiente.
Ejecutable de punta a punta en [`examples/quards_circuit.ipynb`](examples/quards_circuit.ipynb) (o
[`examples/quards_circuit.py`](examples/quards_circuit.py)):

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

El colapso pasa por un puerto (`front/quards/services/quantum.js`) con tres adaptadores:

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
front/quards/                   la app
  services/                     la única capa que la UI conoce: engine, quantum (puerto), rules, ai, ionq
  ui/                           DOM, carta, animación de colapso, fondo, audio, debug
examples/                       notebook Qiskit ejecutable + requirements fijados
docs/                           toda la documentación
assets/                         demo.gif
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
  espía — ver las propuestas en [`docs/mejoras/`](docs/mejoras/) y [`docs/roadmap.md`](docs/roadmap.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

This effort is supported via compute credits from Qollab and IonQ.
