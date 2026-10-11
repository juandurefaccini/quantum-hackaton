# Guion del video de demo (2–3 min) — Qards

Grabación de pantalla con **voz en off** (no hace falta aparecer). Duración objetivo: **2:45**.

> Las **líneas de voz van en inglés** (los jueces son internacionales); las instrucciones para grabar
> están en español. Objetivo: 2:45 con voz al ritmo de ~130–140 palabras por minuto.

## Antes de grabar — preparación

- **Navegador:** Chrome/Edge/Brave/Opera (Safari no ejecuta Qollab).
- **Ventana:** pantalla completa del juego; **panel Debug apagado** (checkbox del header).
- **Resolución:** 1440×900 o 1920×1080. Cursor visible, movimientos lentos.
- **Ten a mano 3 momentos** (no hace falta forzar nada raro; si no aparecen, empezá una partida nueva
  hasta conseguirlos):
  1. **Una carta cuántica jugable** con probabilidad intermedia (ej. ~70/30) para narrar el colapso.
  2. **Un `CNOT` en la mano** para entrelazar dos cartas propias (si no lo tenés al inicio, jugá 2–3
     turnos: las puertas se otorgan cada 2 turnos propios).
  3. **Una `H` sobre una carta ya marcada con `Z`** (o cualquier carta) para explicar que la fase se
     convierte en probabilidad.
- **Qollab abierto** en otra pestaña, con el proyecto cargado y el simulador local seleccionado,
  listo para **Run**.
- **`examples/qards_circuit.py`** (o el notebook) abierto en el editor.

## Tomas y tiempos

### Toma 1 — Gancho (0:00–0:15) · pantalla: tablero recién repartido

> **VO:** "This is Qards — a card game where every card is a qubit. Each card holds two possible faces at
> once, and it only collapses to one when you play it."

### Toma 2 — El juego en 15 s (0:15–0:35) · tablero, pasá el mouse por tus cartas

Mostrá el panel **Info** al pasar el mouse por una carta cuántica (probabilidades y fase).

> **VO:** "You start with seven cards. About half of the deck is quantum. Before playing, you can apply
> free gates to change the odds. Playing a card measures it: the collapse decides which face you get —
> and whether the play is legal."

### Toma 3 — Una medición, narrada (0:35–1:10) · jugá la carta cuántica preparada

Arrastrá la carta al descarte; dejá correr **toda** la animación de colapso. Señalá con el cursor la
línea del panel **Info** cuando aparece el resultado.

> **VO:** "Watch this card. It's prepared with a rotation — here, about an eighty percent chance of the
> red five. I play it. That play is a measurement: the state collapses, and I get exactly one face.
> The Info panel reads back what collapsed and whether the play was valid."

### Toma 4 — Entrelazamiento (1:10–1:45) · aplicá el `CNOT` a dos cartas propias

Seleccioná `CNOT`, hacé clic en control y target. Mostrá el marco **⚛ entrelazadas**. Jugá una de las
dos y mostrá que la otra queda condicionada (el Info cambia su probabilidad).

> **VO:** "Now I entangle two cards with a CNOT. They now share a single circuit — a Bell-like pair.
> When I measure one, the other is no longer independent: it becomes conditioned on the result. This
> is partial measurement, and you can feel it in the game."

### Toma 5 — Fase y probabilidad (1:45–2:05) · aplicá `Z` y después `H` a una carta

Pasá el mouse antes y después para mostrar cómo cambian las probabilidades.

> **VO:** "The Z gate only changes the phase — the probabilities stay the same. But add an H, and that
> phase turns back into probability. The order of the gates is what shapes the outcome."

### Toma 6 — El lado Qiskit (2:05–2:30) · `examples/qards_circuit.py`

Mostrá el código: `ry(theta)` para preparar, `cx` para entrelazar, y la medición. Si usás el notebook,
ejecutá una celda.

> **VO:** "Under the hood it's Qiskit. The exact same three operations — prepare with an Ry, entangle
> with a CX, measure — are right here. Probabilities come from the statevector; the backend supplies
> the measurement."

### Toma 7 — Qollab y cierre (2:30–2:45) · pestaña Qollab, **Select QPU → local** y **Run**

Mostrá el tablero levantando en Qollab. Cerrá con el pie de atribución visible.

> **VO:** "It runs on Qollab's free local simulator — just press Run. Everything is MIT-licensed. This
> effort is supported by Qollab and IonQ."

## Plan B si algo falla

- **No juega una carta:** verificá que sea jugable (marcada por el contorno dorado). Si no, **Robar**.
- **No aparece el `CNOT`:** seguí jugando hasta recibirlo (se otorga cada 2 turnos propios) o grabá el
  entrelazado en una segunda pasada y unilo en la edición.
- **IonQ elegido por error:** volvé a **Select QPU → simulador local**; en IonQ solo hay **un job por
  ejecución**.

## Después de grabar

- Subí el video a YouTube/Loom/Vimeo/Drive **público, sin login** (requisito del hackathon).
- Reemplazá `<VIDEO_URL>` en `PROJECT-CARD.md` y `PROJECT-CARD.es.md`.
