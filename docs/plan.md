# Quards — Plan de implementación

Plan del juego final (1v1 humano vs IA). Decisiones resueltas en `decisions.md`; spec en `idea.md`.

## Ubicación y reuso
App nueva en `front/quards/`. Se **copian** desde `front/quards-quantum-lab/` los módulos
`quantum/` (complex, rng, statevector, qiskit-stub) y `collapse/` (source, qiskit-source,
fake-source, pool), más la estética (`background`, `audio`, `debug`). Los zips de Qollab son
autocontenidos: no se comparte código entre apps. Imports **estáticos** siempre.

Base Qollab: `index.html` fragmento + `main.css` + `main.js` (espera `#root`, monta,
`await new Promise(() => {})`).

## Estructura
```
front/quards/
  index.html  main.css  main.js
  game/      cards.js · deck.js · rules.js · reducer.js   (lógica pura, sin DOM)
  ai/        ai.js                                        (fácil / media / difícil)
  collapse/  source.js · qiskit-source.js · fake-source.js · pool.js   (reuso)
  quantum/   complex.js · rng.js · statevector.js · qiskit-stub.js     (reuso)
  ui/        render.js · cards.js · entangle.js · background.js · audio.js · animations.js · debug.js
  README.md  DESIGN.md
  dev.html  tests/   (fuera del zip)
```

## Dominio
- `Face{color, number}` — 4 colores × 0–9.
- `QubitCard{faces[2], amps[2], collapsed, collapsedIndex, groupId}` — arranca con probabilidades
  aleatorias; caras distintas del pool.
- `GateCard{X|H|Z}`, `EntangleCard{2|3}`, `ActionCard{skip|reverse|draw2, color}`.
- Compuertas sobre amplitudes: **X** swap, **H** `(a0+a1)/√2,(a0−a1)/√2`, **Z** `(a0,−a1)`.
  Target no colapsado ni entrelazado.
- Entrelazado: 2 → Bell, 3 → GHZ; mismo `groupId`; al colapsar una se fija la rama de todas.

## Mazo
Caras 4×0–9 (76). **38 qubit** (2 caras c/u) · **18 compuertas** (6 X, 6 H, 6 Z) · **8
entrelazamiento** (4 de 2, 4 de 3) · acciones UNO · **mano inicial 7**. Penalización: roba del
mazo y colapsa al vuelo.

## Reglas
- Turno = **una** acción: jugar qubit / compuerta / entrelazamiento / acción UNO / robar (solo si
  no hay jugada).
- Qubit jugable si alguna cara con p>0 matchea el descarte (color o número). Colapsa → **válida**
  (al descarte) o **inválida** (vuelve a tu mano colapsada + robás del mazo colapsada; termina el
  turno).
- Colapsada = UNO normal: jugable si matchea; no recibe compuertas ni se entrelaza.
- Victoria: mano vacía. Mazo agotado → re-mezclar el descarte.

## Colapso (adaptador)
`collapse/source.js` (estático): `backend` → `qiskit-source.js`; si no → `fake-source.js`. El
**reducer no mide**: recibe el resultado y transiciona (serializable y testeable).

## IA
Fácil: cualquiera jugable · Media: máx P(válida) · Difícil: expectimax (preparar vs jugar) +
conteo de cartas del rival. Solo conoce sus propias distribuciones.

## UI y estética
Mano abajo (caras + % + parpadeo + links), rival arriba boca abajo (count), descarte + mazo al
centro, estado y log. Compuerta/entrelazamiento → modo selección de targets. Juice: squash &
stretch, screen shake al colapsar, floating text, audio. Panel `debug`.

## Testing
`node --test`: compuertas (X/H/Z/HZH), distribución, reglas (jugabilidad, penalización,
entrelazado, victoria), reducer determinista con seed, IA. Smoke test de `mount`.

## Fases
1. `game/` (cards, deck, rules, reducer) + tests — loop por consola.
2. `ai/` (3 niveles) + tests.
3. `ui/` (render, cartas, entrelazado) + estética.
4. `qiskit-source` real + README/DESIGN + zip.
