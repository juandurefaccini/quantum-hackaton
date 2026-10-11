# Qards — Conceptos cuánticos

Un paseo por las cuatro ideas cuánticas que Qards usa, con el lenguaje del juego.

> **Jugá unas rondas antes de leer esto.** Se entiende mucho mejor si ya mediste unas cartas y viste
> el colapso. Volvé acá cuando te preguntes *por qué* una carta se comporta como se comporta.
>
> Reglas: [`idea.md`](idea.md) · Efecto de cada puerta: [`gates.md`](gates.md) · Implementación:
> [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.

## 1. Superposición: la carta que es dos cartas

En un juego de descarte clásico una carta **es** un color y un número. En Qards una **carta cuántica** tiene **dos caras
posibles** a la vez: por ejemplo, *Rojo 5* y *Azul 2*. No es que "todavía no sabés cuál es" — la
carta realmente **es las dos**, con un peso (una probabilidad) para cada cara.

- Ese peso lo ves en el juego: al pasar el mouse por una carta, el panel **Info** muestra `|0⟩` con un
  porcentaje y `|1⟩` con el resto.
- El reparto elige ese peso al azar: las cartas nacen entre **10% y 90%** a favor de una cara (nunca
  son casi-clásicas, nunca son 50/50 exacto salvo que lo busques).
- En física esto es `ry(θ)`: una rotación que inclina el qubit. Ver [`gates.md`](gates.md).

## 2. Medición: por qué no podés saber y jugar a la vez

**Medir** una carta la **colapsa**: de las dos caras posibles queda **una**, y recién ahí vale como
carta clásica. En Qards, medir = **jugar la carta** (al descarte).

- Si la cara que salió **coincide** con el descarte, la jugada fue **válida**.
- Si **no** coincide, fue **inválida**: la carta ahora tiene esa cara fija (ya no es "dos cartas") y
  encima **robás 1**.
- **Una vez medida, la carta es clásica**: no recibe más puertas ni se puede entrelazar. Ya "salió
  del mundo cuántico".

Por eso Qards es un juego de **apuestas**: una carta 50/50 *puede* servir, pero te arriesgás a la
penalización. Las puertas existen para **mover esas probabilidades** antes de medir.

## 3. Entrelazado: cartas que comparten su suerte

Un **CNOT** une dos cartas en un **grupo entrelazado**. A partir de ahí sus resultados **están
correlacionados**: no importa qué le pase a una sin arrastrar a la otra.

- En el juego se ven **juntas y enmarcadas** ("⚛ entrelazadas").
- Al medir **una** carta del grupo, la otra **no se mide**, pero queda **condicionada** por el
  resultado: su probabilidad cambia según lo que salió.
- Ejemplo verificado: si el control está 50/50 y el target en `|0⟩`, el CNOT deja 50% `|00⟩` + 50%
  `|11⟩`. Nunca salen `|01⟩` ni `|10⟩`. Ver [`gates.md`](gates.md).
- **Sin exagerar:** esas correlaciones, leídas solo en la base computacional (`|0⟩`/`|1⟩`), también se
  podrían reproducir con **azar clásico compartido** (un modelo de variables ocultas para ese conjunto
  restringido de mediciones). Lo que el juego sí explota y no tiene análogo clásico es la **fase**
  (sección 4).

Estratégicamente, un **CNOT** puede preparar **dos** cartas con una sola jugada — el "ahorro" que
menciona la spec.

## 4. Fase: la información invisible

La **fase** es **la parte genuinamente cuántica del juego**: información que **no cambia las
probabilidades** por sí sola, así que "no se ve" al medir mirando `|0⟩`/`|1⟩`, pero **sí** se ve cuando
la combinás con una compuerta **H** (interferencia, sin análogo clásico).

- En el panel Info de las cartas cuánticas hay una línea **Fase** (`+` o `−`).
- **Z** invierte la fase. En una carta sola no parece hacer nada... hasta que aplicás **H**, y ahí la
  fase se convierte en probabilidad.
- Por eso `H` + `Z` + `H` = `X`: la fase acumulada reaparece como probabilidades invertidas.
- **Verificado:** un test compara `H·Z·H` contra el `Statevector` de Qiskit y contra el simulador de
  referencia del juego (una carta al 80% pasa a 20%; ambas dan `[0.2, 0.8]`). Ver la suite de tests
  (`front/qards/tests/services.test.js`) y [`../examples/qards_circuit.py`](../examples/qards_circuit.py).

## Resumen para jugar

| Concepto | En el juego | En física |
| :-- | :-- | :-- |
| Superposición | Carta con dos caras y sus % | `ry(θ)` |
| Medición | Jugar la carta (colapsa) | Proyección / colapso |
| Entrelazado | Grupo unido por CNOT | Par de Bell / GHZ |
| Fase | Línea "Fase" (`+`/`−`), se revela con `H` | Fase relativa |
| Puerta | X/Z/H/CNOT aplicadas antes de jugar | Compuertas unitarias |
