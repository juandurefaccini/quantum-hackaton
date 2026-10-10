# Quards

**UNO cuántico**: cada carta es un qubit con dos caras posibles, una por cada estado |0⟩ y |1⟩.
Gana quien se queda sin cartas antes que el rival (vos vs. IA). El motor es el del **back**
(`back/estado.js` + `back/quantum/qiskit.js`); el front lo consume vía **servicios**. Las puertas
(X/Z/H y CNOT) **no son cartas**: se otorgan al inicio de cada turno.

Especificación en `docs/idea.md`, decisiones resueltas en `docs/decisions.md`, plan en
`docs/plan.md`.

## Cómo corre

- **Local (dev-server):** `node front/quards/dev-server.mjs` y abrir
  `http://localhost:8000/front/quards/dev.html`. El server sirve el repo (para que `services/` pueda
  importar `../../../back/`) y **proxya IonQ**. `dev.html` trae un **import map** que mapea `qiskit` y
  `qiskit.quantum_info` a stubs (no hay Qiskit en local).
- **Motor cuántico (puerto `services/quantum.js`):**
  - **Qollab** → Qiskit (`back/quantum/qiskit.js`).
  - **IonQ** (local) → `services/ionq.js` vía el proxy del dev-server. Activá con `?engine=ionq` en la
    URL (o `globalThis.QUARDS_ENGINE='ionq'`). La key la lee el dev-server de `process.env.IONQ_API_KEY`,
    de un `.env` (copiá `front/quards/.env.example` → `front/quards/.env`) o de `--env <ruta>` / `--key`.
    **La key nunca va al browser ni al repo** (`.env` está gitignored).
  - **referencia** (local, por defecto) → simulador JS (`back/quantum/referencia.js`).
  - Las **probabilidades** siempre son exactas (Qiskit Statevector en Qollab, referencia en local);
    IonQ aporta la **medición** (el colapso).
- **Qollab:** subir el zip como proyecto JS / Qiskit, elegir backend en Select QPU, **Run**, y jugar.
  Ahí el puerto usa `back/quantum/qiskit.js`.

`index.html` es el fragmento que Qollab sirve; `main.js` espera `#root`, monta y termina en
`await new Promise(() => {})` para mantener viva la sesión (IonQ solo es alcanzable mientras corre).

### Por qué no hay imports dinámicos

Qollab empaqueta los archivos alcanzables por imports **estáticos**; un archivo referenciado solo
por `import()` dinámico no se emite y el `import()` resuelve contra la base `_nuxt/` de Qollab y
falla. Por eso `services/quantum.js` importa los adaptadores de forma estática y elige en runtime.

## Reglas

- Mano inicial **7 cartas** (clásicas o cuánticas) por jugador.
- **Las puertas no son cartas**: al inicio de tu turno recibís **1 puerta aleatoria** (X, Z, H o CNOT).
  Se acumulan en tu mano de puertas y se aplican **gratis** (sin cerrar el turno).
- **Aplicar una puerta** modifica el circuito de la carta (X/Z/H a una; **CNOT entrelaza dos**) y la
  carta se **mide recién al jugarla**.
- Una carta es jugable si **alguna de sus caras posibles** coincide con el descarte (color o símbolo),
  o si es comodín. Al jugarla se **mide** (colapsa el grupo): si la cara coincide es **válida** (va al
  descarte y aplica su efecto); si no, es **inválida** (queda en tu mano colapsada y robás una).
- Cerrás el turno al **jugar** una carta; **robás** solo si no podés jugar.
- **Efectos**: skip/reverse (el rival pierde el turno), +2 (el rival roba 2 y pierde el turno), comodín (elegís color),
  +4 (elegís color y el rival roba 4 y pierde el turno).
- Para jugar: **seleccioná** la carta y **arrastrala al descarte** (o clickeá el descarte).
- Gana quien se queda **sin cartas**. El colapso lo decide el motor cuántico.

## Layout

| Ruta | Rol |
| :-- | :-- |
| `main.js` | boot: espera `#root`, monta, mantiene la sesión viva |
| `services/` | puertos/adaptadores: `engine.js` (fachada del back), `quantum.js` (puerto cuántico), `rules.js` (turnos/reglas), `ai.js`, `ionq.js` |
| `back/` | MOTOR del back (se importa): `estado.js`, `quantum/qiskit.js`, `quantum/referencia.js` |
| `ui/` | `render.js` (DOM), `entangle.js` (líneas), `background.js` (WebGL 320×180), `audio.js`, `debug.js` |
| `quantum/qiskit-stub.js` | stub de `qiskit`/`qiskit.quantum_info` para dev (import map) |
| `tests/` | `node --test tests/services.test.js` (fuera del zip) |
| `dev-server.mjs` | server local + proxy IonQ (fuera del zip) |
| `build.mjs` | arma `quards.zip` (app plana + `back/`, reescribe `../../../back/`→`../back/`) |

## Debug

Panel `debug` abajo a la izquierda con cada paso (boot, adaptador, acciones) y errores globales.
Si el montaje falla, se muestra el stack en el lugar de la app. Si el adaptador de Qiskit no
carga, cae a Math.random con un aviso.

## Límites conocidos

- El **motor de reglas** (`services/rules.js`) se construyó sobre el modelo del back, que no trae
  reglas. Los efectos de comodín eligen el color más frecuente de tu mano (no hay picker todavía).
- **IonQ** (simulador) devuelve probabilidades ideales; el adaptador muestrea local. El muestreo
  cuántico real ocurre en un QPU. ~3.6 s por medición.
- En el sandbox de Qollab el fondo WebGL o las animaciones (rAF) pueden no pintar; el resto sigue.
- `package.json`, `dev.html`, `dev-server.mjs`, `build.mjs` y `tests/` quedan fuera del zip.

## Créditos

Base de Qollab (fragmento `index.html` + `main.css` + `main.js`) según `app/00` y
`app/02` de Qubitle. Sin frameworks, sin CDN, sin bundler: solo ES modules.
