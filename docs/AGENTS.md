# AGENTS.md — Contexto para agentes de IA

Resumen de contexto para trabajar en este repo. **Leelo antes de tocar código.**
Doc técnica completa: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## TL;DR

- **Qué:** Qards, un juego de cartas cuántico 1v1 (humano vs IA). JS puro, sin dependencias.
- **Correr:** `node front/qards/dev-server.mjs` → `http://localhost:8000`.
- **Verificar:** `cd front/qards && npm test` (15/15). No hay lint ni typecheck.
- **Regla de oro:** toda mutación de `state` debe dejar `checkState(state)` vacío.
- **No rompas:** imports estáticos (Qollab) y la UI solo importa `services/*`.

Detalle: [Arquitectura](#arquitectura-en-una-pasada) · [Invariantes](#invariantes-y-reglas-que-no-hay-que-romper) · [Gotchas](#gotchas--deuda-técnica).

## Qué es

**Qards**, un "juego de cartas cuántico" 1v1 (humano vs IA). Cada carta es un qubit con dos caras posibles
(`|0⟩`/`|1⟩`); se mide al jugarla. Gana quien se queda **sin cartas en la mano**. JS puro (ES
modules), **sin frameworks, sin bundler, sin dependencias de runtime**. Todo el código y la
documentación están en **español**.

## Comandos

```bash
node front/qards/dev-server.mjs          # servidor local (http://localhost:8000) + proxy IonQ
cd front/qards && npm test               # tests (node --test)
node front/qards/build.mjs               # -> front/qards.zip (para Qollab)
node utils/zip.js                         # -> quantum-hackaton.zip (repo entero)
```

No hay lint ni typecheck ni `npm install`. La verificación es **correr los tests**.

## Arquitectura en una pasada

- `back/estado.js` — **motor puro**: arma el `state` (mazo, cartas, grupos/circuitos), `createGame`,
  `checkState`. **No tiene reglas ni mide.**
- `back/quantum/` — `util.js` (helpers puros), `referencia.js` (simulador local), `qiskit.js`
  (solo Qollab).
- `front/qards/services/` — **la única capa que la UI conoce**:
  `engine.js` (fachada del back), `quantum.js` (**puerto cuántico**), `rules.js` (reglas/turnos),
  `ai.js`, `ionq.js`.
- `front/qards/ui/` — `render.js` (la app), `qard.js` (carta), `collapse.js` (animación de
  medición), `entangle.js`, `background.js`, `audio.js`, `debug.js`.
- `index.html` + `main.js` (raíz) — entry ejecutable que monta la app en `#root`.

**Flujo de una jugada:** `rules.play` → (si es cuántica) `phase='measuring'` y devuelve el grupo →
`quantum.medirGrupo` → `rules.resolveMeasure(state, bits)` → válida (descarte + efecto) o inválida
(queda colapsada + roba 1).

## Invariantes y reglas que NO hay que romper

- **El estado es un objeto plano serializable.** Nada de clases, funciones ni ciclos. `clone` usa
  `structuredClone`. Si agregás campos, mantené esa propiedad.
- **El motor (`back/estado.js`) no mide ni tiene reglas.** El azar de colapso nunca usa la semilla.
- **Toda mutación de `state`** debe seguir dejando `checkState(state)` vacío. Los tests lo verifican
  tras cada acción: si tocás reglas/motor, corré `npm test`.
- **La UI no importa `back/quantum/*`, IonQ ni Qiskit**: solo `services/*`.
- **Imports estáticos únicamente.** Qollab no empaqueta lo referido solo por `import()` dinámico.
- Los índices de qubit usan **qubit `q` en el bit `q`** (`util.js`, `referencia.js`). Qiskit escribe
  el qubit 0 a la **derecha**: cuidado al leer counts en `qiskit.js`.

## Motor cuántico (puerto con adaptadores)

`services/quantum.js` elige el motor: `qiskit` si `typeof backend !== 'undefined'` (Qollab), `ionq`
si `?engine=ionq` / `globalThis.QARDS_ENGINE`, si no `referencia`. Las **probabilidades** siempre
son exactas; IonQ solo aporta la **medición**; si el motor remoto falla, **cae a la referencia**.

## Decisiones clave (ver [`decisions.md`](decisions.md))

- Las puertas (X/Z/H/CNOT) **no son cartas**: se otorgan por turno y son preparación libre.
- Entrelazar = **CNOT que fusiona grupos**.
- **Medición parcial**: al jugar una carta se mide solo su qubit; el resto del grupo queda
  condicionado (`group.bits`).
- Mazo de **108 cartas** (60 clásicas + 48 cuánticas). Mano inicial 7.
- Victoria = **mano vacía** (las puertas no cuentan).

## Gotchas / deuda técnica

- `ui/circuit.js` está **huérfano** (nadie lo importa).
- `utils/render.js` y `utils/rules.js` son **copias viejas y rotas** (NO son la app real; la app
  está en `front/qards/`).
- Los comodines eligen color automáticamente (no hay picker).
- IonQ tarda ~3.6 s por medición (simulador); hay timeouts y fallback.

## Convenciones

- **Commits** en español, conventional commits con scope (`feat(qards): ...`, `docs: ...`). Sin
  atribución de IA.
- Separar cambios en **work units atómicas** (una idea por commit).
- Documentación en español; los identificadores del código también.

## Documentación

| Archivo | Rol |
| :-- | :-- |
| `docs/ARCHITECTURE.md` | **Doc técnica canónica** (implementación) |
| `docs/idea.md` | Concepto y spec funcional |
| `docs/decisions.md` | Registro de decisiones + dónde viven |
| `docs/plan.md` | Estado y roadmap |
| `docs/gates.md` · `quantum-concepts.md` · `determinism.md` · `engines.md` | Puertas, conceptos, semilla, motores |
| `docs/known-issues.md` · `roadmap.md` · `hackathon-brief.md` | Problemas, pendientes, brief del hackathon |
| `docs/mejoras/` | Propuestas cuánticas (un doc por idea) |
| `README.md` · `README.es.md` | Portada (inglés / español) + ejemplo Qiskit |

## Checklist antes de cerrar un cambio

- [ ] `cd front/qards && npm test` pasa (15/15).
- [ ] El estado queda coherente (`checkState` vacío) tras cada acción.
- [ ] No agregué imports dinámicos (Qollab no los empaqueta).
- [ ] La UI no importa `back/quantum/*` ni `ionq.js`.
- [ ] Docs e identificadores en español; commits con scope (`feat(qards): …`).
