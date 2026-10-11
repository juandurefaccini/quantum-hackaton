# Qards — Puertas

Las **puertas** son operaciones cuánticas que se aplican a tus cartas **antes de jugarlas**. No
miden: la carta se queda en superposición (con otras probabilidades y/o fase) hasta que la jugás.
No son cartas: se otorgan por turno (ver [`idea.md`](idea.md) §4).

> Todas las filas de abajo están **verificadas contra el simulador de referencia**
> (`back/quantum/referencia.js`). El comando de verificación está al final.

## Tabla rápida

| Puerta | Matriz (base Z) | Qué le hace a las probabilidades | Qué le hace a la fase |
| :-- | :-- | :-- | :-- |
| **X** | `[[0,1],[1,0]]` | **Intercambia** P(0) ↔ P(1) | No cambia la fase |
| **Z** | `[[1,0],[0,-1]]` | **No cambia** P(0)/P(1) | **Invierte** la fase (`+` ↔ `−`) |
| **H** | `1/√2 · [[1,1],[1,-1]]` | **Convierte** la fase en probabilidad | **Convierte** la probabilidad en fase |
| **SUP** | `1/√2 · [[1,1],[1,-1]]` (igual que H) | **Reabre** una carta fija: la deja **50/50** | — |
| **CNOT** | 2 qubits: `control → target` | **Entrelaza**: corrige el target según el control | — |

## Estado antes → después (manual)

Ejemplos concretos, todos medidos con el simulador. `P(0)` es la probabilidad de que la carta salga
con su primera cara (`|0⟩`).

| Puerta | Estado antes | Estado después | Lectura |
| :-- | :-- | :-- | :-- |
| — (inicio) | `\|0⟩` | `\|0⟩` (P(0) = 100%) | Toda carta parte de `\|0⟩` y se sesga con `ry` |
| **X** | `\|0⟩` | `\|1⟩` (P(1) = 100%) | Voltea el bit |
| **X** | `ry` con P(0) = 90% | P(0) = 10% | Intercambia las dos caras |
| **Z** | `\|0⟩` | `\|0⟩` (sin cambio) | En `\|0⟩` no se nota |
| **Z** | `ry` con P(0) = 90%, fase `+` | P(0) = 90%, fase `−` | Mismas probabilidades, fase dada vuelta |
| **H** | `\|0⟩` | 50% / 50% | Superposición exacta |
| **SUP** | carta **fija** (P(0) = 100%, cara oculta) | 50% / 50% | Reabre una carta fija: le da superposición |
| **H** | `ry` con P(0) = 90%, fase `+` | P(0) = 80% | La fase se vuelve probabilidad |
| **H Z H** | `\|0⟩` | `\|1⟩` | `HZH` = `X` |
| **H X H** | `\|0⟩` | `\|0⟩` | `HXH` = `Z` |
| **CNOT** | `\|0⟩` control, `\|0⟩` target | `\|00⟩` | El control en 0 no toca el target |
| **CNOT** | `\|+⟩` control (50/50), `\|0⟩` target | 50% `\|00⟩` + 50% `\|11⟩` | **Solo** salen correlaciones: nunca `\|01⟩` ni `\|10⟩` |

## Cómo leerlas en el juego

- **X** sirve para **invertir una apuesta**: una carta con 90% de una cara pasa a 10%.
- **Z** no cambia lo que ves en probabilidades, pero **cambia la fase**; recién se nota si después
  aplicás una **H** (que traduce la fase a probabilidad). Por eso en el panel Info se muestra la
  línea "Fase".
- **H** es la que **reorienta** la carta: pone las probabilidades en función de la fase actual.
- **SUP** (superposición) **reabre una carta fija**: toda carta nace siendo un qubit, pero las fijas
  se ven de una sola cara (estado definido con una **cara oculta**). La SUP las deja 50/50 entre sus dos caras.
- **CNOT** **entrelaza** dos cartas: al medir una, la otra queda fijada por la correlación. En la
  mano se muestran juntas, enmarcadas como "⚛ entrelazadas".

## Verificación

Los números de las tablas se generaron ejecutando el simulador de referencia:

```bash
node --input-type=module <<'EOF'
import { distribucion, marginal, probabilidadFaseQubit } from './back/quantum/referencia.js';
const G = (ops) => ({ qubits: 1, ops, bits: [null] });
const P = (ops) => marginal(distribucion(G(ops)), 0);
const ph = (ops) => probabilidadFaseQubit(G(ops), 0);
const z = 0.8, th = Math.atan2(Math.sqrt(1 - z*z), z);
console.log('ry(z=+0.8)      ', P([['ry',th,0]]).map(x=>x.toFixed(2)), ph([['ry',th,0]]).map(x=>x.toFixed(2)));
console.log('  + X           ', P([['ry',th,0],['x',0]]).map(x=>x.toFixed(2)));
console.log('  + H           ', P([['ry',th,0],['h',0]]).map(x=>x.toFixed(2)));
console.log('  + Z           ', P([['ry',th,0],['z',0]]).map(x=>x.toFixed(2)), ph([['ry',th,0],['z',0]]).map(x=>x.toFixed(2)));
EOF
```

Salida esperada: `ry` → `[0.90, 0.10]` con fase `[0.80, 0.20]`; `+X` → `[0.10, 0.90]`; `+H` →
`[0.80, 0.20]`; `+Z` → `[0.90, 0.10]` con fase `[0.20, 0.80]`.

> Para ver las mismas operaciones en Qiskit (que es el backend real del juego en Qollab), corré
> [`../examples/qards_circuit.ipynb`](../examples/qards_circuit.ipynb).
