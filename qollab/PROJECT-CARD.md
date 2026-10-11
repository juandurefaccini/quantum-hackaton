# Qards — a quantum card game

**Every card is a qubit.** It holds two possible faces at once, and only collapses to one when you
play it.

**Theme:** Quantum Playground · **License:** MIT · **Tags:** `qiskit`, `ionq`, `game`,
`entanglement`, `superposition`

---

## What is Qards?

Qards is a shedding card game where part of the deck is quantum. You play heads-up against an AI;
first to empty their hand wins. **48 of its 108 cards are quantum**: a single qubit prepared in a
superposition of two *faces*, e.g. *Red 5* / *Blue 2*. You can bias a card with free gates (`X`, `Z`, `H`) and entangle two cards with a
`CNOT` before you play. Playing a card **measures** it: the collapse decides which face you actually
get, and whether the play is legal. You bet on the odds — but the odds are a state you can shape, not
a coin you can't see.

![A quantum card holds two faces at once and collapses when played](https://raw.githubusercontent.com/juandurefaccini/quantum-hackaton/main/assets/diagrams/measure-en.png)

## The quantum part

| Game piece | Quantum object | Where in the code |
| :-- | :-- | :-- |
| Classic card | A basis state (a definite $\lvert 0\rangle$ or $\lvert 1\rangle$) | `back/estado.js` |
| Quantum card | A qubit in **superposition** of two faces, prepared with $R_y(\theta)$ | `back/estado.js` |
| Entangled group | Two or more qubits sharing one circuit (**CNOT**) | `back/estado.js` (`aplicarCnot`) |
| Gate X / Z / H | Single-qubit gate: `X` (bit flip), `Z` (phase), `H` (phase ⇄ probability) | `back/quantum/referencia.js` |
| Gate CNOT | Two-qubit entangling gate (control → target) | `back/quantum/referencia.js` |
| Playing a card | **Measurement** (collapse of the group) | `back/quantum/qiskit.js`, `services/quantum.js` |

### The circuit, commented

A quantum card is a one-qubit circuit. Its bias along $z$ is chosen so $P(\lvert 0\rangle) = (1+z)/2$
stays between 10 % and 90 % (never a near-classical card):

```python
theta = atan2(sqrt(1 - z**2), z)   # z = 0.6  ->  P(0) = (1+z)/2 = 0.8
card  = QuantumCircuit(1)
card.ry(theta, 0)                  # PREPARE: the superposition of the two faces
# ...gates X / Z / H stay on the card without measuring...
card.measure(0, 0)                 # PLAY: the measurement collapses it to one face
```

A `CNOT` fuses two cards into one circuit, so their outcomes become correlated:

```python
pair = QuantumCircuit(2)
pair.ry(theta0, 0)   # control card: its own biased superposition
pair.ry(theta1, 1)   # target card: its own biased superposition
pair.cx(0, 1)        # ENTANGLE: a Bell-like pair, not independent
pair.measure([0, 1], [0, 1])
```

### Why measurement and entanglement are *essential* — not just randomness

- **Play = measure.** The central action of the game is a projective measurement: it collapses the
  card's group and the collapsed face decides the play. This is the game's mechanic, not a hidden RNG
  behind it.
- **The phase is the genuinely quantum part.** `Z` changes the relative phase ($\lvert + \rangle$ vs
  $\lvert - \rangle$) *without* changing the probabilities you can see; a following `H` maps that
  phase back into a probability, so `H·Z·H` acts exactly like `X`. The visible odds therefore depend on
  the *order* of gates — an interference effect with **no classical analogue**, which a fair coin
  cannot express. (Backed by a test that compares `H·Z·H` against Qiskit's `Statevector`: the test
  suite and `examples/qards_circuit.py`.)
- **Entanglement links outcomes.** Through a `CNOT`, measuring one card *conditions* the other: the
  group is post-selected on the measured bit and renormalized,
  $P(x_q \mid \text{measured bits}) = \dfrac{P(\text{joint state})}{\sum P(\text{compatible})}$, and the
  remaining cards keep a valid, adjusted distribution.

**Honest caveat.** The *correlations* of a `CNOT` pair, read only in the computational basis, can also
be produced by shared classical randomness (a local hidden-variable model for this restricted set of
measurements). What has no classical analogue here is the **phase**: `Z` changes the phase without
changing the visible probabilities, and a later `H` turns that phase into probability.

Probabilities are always computed exactly from the statevector; the backend only supplies the
*measurement* that collapses the state.

### Shaping the odds: favorable plays with gates

Before you play a card you can spend gates — they are free and they don't measure. Each one changes
the card's state, so the **measurement you are about to make lands on the face you want more often**.
There are three levers:

| Lever | What it does | Example (face $\lvert 0\rangle$ / face $\lvert 1\rangle$) |
| :-- | :-- | :-- |
| `X` | swaps the two faces | 20 % / 80 % → **80 % / 20 %** |
| `H` | turns the **phase** into probability, toward the face the **`Fase`** line shows | 50 % / 50 % (`Fase +`) → **≈100 % / 0 %** |
| `Z` | flips the phase (invisible on its own); it **picks the side** a later `H` sends it to | — |
| `CNOT` | **links two cards**: whatever one measures, the other follows | see play 3 |

Rule of thumb: **`X` to get the other face, `H` to commit, `Z` before `H` to pick the side, `CNOT` to
make a second card share the first card's fate.**

![Favorable plays: X to swap, H to commit, Z then H for the other face, CNOT to link](https://raw.githubusercontent.com/juandurefaccini/quantum-hackaton/main/assets/diagrams/plays-en.svg)

**Play 1 — rescue a bad card with `X`.** Your card reads *Red 5* 20 % / *Blue 2* 80 %, and *Blue 2* is
what matches the discard. Apply `X`: the faces swap, so *Blue 2* is now at 80 %. No luck involved.

**Play 2 — commit with `H`, reading the `Fase` line.** Hover the card: the Info panel shows `Fase +`
or `Fase −`. Applying `H` sends the card to the face the phase points to, with **at least 80 %** (a
plain 50 / 50 goes to ≈100 %):
- 80 % / 20 % with `Fase +` → `H` → **90 % / 10 %**
- 50 % / 50 % with `Fase +` → `H` → **≈100 % / 0 %**

Want the *other* face? Spend `Z` first — it flips the phase, then `H` lands on the opposite side
(80 % / 20 % `Fase +` → `Z` → `H` → **10 % / 90 %**). `Z` alone never changes the odds; it only aims
the `H`.

**Play 3 — tie two cards with `CNOT`.** `CNOT` doesn't push one card up; it **correlates** two. Entangle
a card you will read (the control) with a card you want to keep: a 90 % card linked to a 50 / 50
control becomes, once you measure the control, ~90 % in whichever bit the control collapsed (50 / 50
is a fair coin, but the linked card is then pinned). Use it to choose *when* a card's uncertainty
resolves. It can also entangle one of the opponent's cards (the control stays yours).

Cost: you get **1 gate every turn** but hold at most **3** — and **a card that
has been measured is classical: it takes no more gates.** Every move above is a real trade-off, not a
free reroll.

Every number here comes from the game's reference simulator; `H·Z·H ≡ X` is additionally checked
against Qiskit's `Statevector` (test suite and `examples/qards_circuit.py`).

## How to run it on Qollab

![The quantum port: probabilities are exact; only the measurement goes to the backend](https://raw.githubusercontent.com/juandurefaccini/quantum-hackaton/main/assets/diagrams/port-en.svg)

1. Open the project and **Select QPU → free local simulator** (IonQ simulator also works — see below).
2. Press **Run**. The board appears above the console.
3. Drag a card onto the discard pile (or click the pile), apply a gate, and play a quantum card to
   watch the **collapse** animation and the narration in the **Info** panel.

On the **local simulator** every collapse is a Qiskit job. On the **IonQ** simulator only **one job
is allowed per run**: the first collapse is measured with the IonQ backend, and the rest keep a
mathematically identical collapse computed from the exact statevector, so play never stalls.

**Verification status.** The pieces are verified locally — the reference simulator matches Qiskit's
`Statevector` (including `H·Z·H ≡ X`) and the test suite passes. **Execution inside Qollab was not
verified from the development environment** (no Qollab account here): the runtime `backend`, the
`qiskit` import and the IonQ one-job path depend on Qollab.

## Beyond the tutorial

Qards is a **novel application** (a card game as a quantum medium) *and* an **educational contribution**: it
turns superposition, gate order, entanglement, and partial measurement into things you *feel* in a
match. Concretely, beyond a textbook Bell circuit it implements:

- an **exact, per-player card state** built from a seeded deck (`back/estado.js`),
- **partial measurement with conditioning** of an entangled group (`group.bits`,
  `resolveMeasure`),
- **phase (`Z`) that changes a later `H`'s outcome**, and **`CNOT` that merges two groups** into one
  circuit,
- a **swappable quantum port** with an exact reference simulator, IonQ and Qiskit behind one interface
  (`services/quantum.js`); the AI plays the playable card with the highest exact match probability and,
  on *Hard*, first tries the gate (`X`/`Z`/`H`/`CNOT`) that most improves its best play.

## What existed before / credits

The build window opened on **2026-10-09 20:00 (-03)**. The repository's first commit is a base-repo
skeleton (`README.md`, `LICENSE`, `.gitignore`, committed 2026-10-09 20:22 -03); every game file was
written inside the window. The three root entry files (`index.html`, `main.js`, `main.css`) are
project code written during the window (2026-10-10 -03) and follow Qollab's required JS-project layout
(`index.html` + `main.js` at the top level). No code from before the window is included.

- **Third-party libraries** (`examples/requirements.txt`, Python 3.11): `qiskit==2.5.2`,
  `qiskit-ionq==1.1.1`. **No JavaScript runtime dependencies** — the DOM, WebGL and audio are
  hand-written.
- **AI tools used:** AI coding agents assisted with the code, tests and documentation during the
  window; the repository ships `docs/AGENTS.md` as their project brief.

## Known limits & Remix it

**Limits:** the AI "hard" level tests gates but is not full expectimax; wild color is chosen
automatically (no picker); the collapse uses `Math.random` for the final sample (the deck is seeded,
the collapse is not reproducible yet); Safari cannot run the project (no WASM JSPI).

**Remix it:** swap the heuristic AI for expectimax over hidden probabilities; move the engine to a
server for real multiplayer; add GHZ states, phase gates, or a Grover-powered "spy". See
`docs/roadmap.md`.

## Links

- **Repository:** <https://github.com/juandurefaccini/quantum-hackaton>
- **Demo video:** `<VIDEO_URL>`

_MIT License — see `LICENSE`._

This effort is supported by Qollab & IonQ
