# Qards — juego de cartas cuántico

Juego de cartas donde cada carta es un **qubit** con dos caras posibles (una por cada estado
`|0⟩` y `|1⟩`). Gana quien se queda sin cartas antes que el rival: **persona vs. IA**.

El juego vive en **JS puro (ES modules)**, sin frameworks, sin bundler y sin dependencias. El
motor de reglas está desacoplado de la UI, y el colapso de las cartas pasa por un **adaptador
cuántico** (simulador local, Qiskit o IonQ).

## Arranque rápido

```bash
node front/qards/dev-server.mjs        # 1. levantá el server (puerto 8000)
```

2. Abrí `http://localhost:8000`.
3. Deberías ver el tablero y `Tu turno`.

El motor por defecto es el **simulador local**, así que no necesita backend ni claves.

**Verificación:** el tablero carga · podés arrastrar una carta al descarte · `cd front/qards && npm test` pasa (15/15).

## ¿Qué leer según lo que buscás?

| Si querés… | Leé |
| :-- | :-- |
| Levantar, empaquetar o testear | este README |
| Entender la implementación | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Las reglas del juego | [`idea.md`](idea.md) |
| Por qué se decidió algo | [`decisions.md`](decisions.md) |
| Qué falta y hacia dónde va | [`plan.md`](plan.md) · [`roadmap.md`](roadmap.md) |
| Los efectos de cada puerta | [`gates.md`](gates.md) |
| Los conceptos cuánticos | [`quantum-concepts.md`](quantum-concepts.md) |
| Reproducir una partida (semilla) | [`determinism.md`](determinism.md) |
| Los motores cuánticos | [`engines.md`](engines.md) |
| Problemas conocidos / deuda | [`known-issues.md`](known-issues.md) |
| El pedido del hackathon | [`hackathon-brief.md`](hackathon-brief.md) |
| Que un agente de IA trabaje en el repo | [`AGENTS.md`](AGENTS.md) |

## Requisitos

- **Node.js 18+** (el dev-server usa `fetch` global y `node:http`). No hay `npm install`:
  el proyecto no tiene dependencias.
- Un navegador moderno (ES modules + import maps).

## Cómo levantar la app

El **punto de entrada está en la raíz**: `index.html` + `main.js` montan la app (que vive en
`front/qards/`) dentro de `#root`. Se sirve con un **dev-server** incluido que, además de servir
el repo, **proxya IonQ** (para que el browser no llame directo a la API ni exponga la key).

Desde la raíz del repo:

```bash
node front/qards/dev-server.mjs
```

Luego abrir:

```
http://localhost:8000
```

`/` redirige a `/index.html`, el entry raíz, que monta el juego.

El server también acepta:

```bash
node front/qards/dev-server.mjs --port 8000          # puerto (default 8000)
node front/qards/dev-server.mjs --env /ruta/a/.env   # archivo .env con la key de IonQ
node front/qards/dev-server.mjs --key TU_IONQ_KEY    # key directa
```

> Alternativa: `cd front/qards && npm run dev`.

> El dev-server sirve **todo el repo** (no solo la app) para que `services/` pueda importar
> `../../../back/` y para poder abrir los prototipos de cartas con el mismo server.

### Motor cuántico

El puerto cuántico (`front/qards/services/quantum.js`) elige el adaptador según el entorno:

| Motor | Cuándo | Qué usa |
| :-- | :-- | :-- |
| **referencia** | local, **por defecto** | Simulador JS (`back/quantum/referencia.js`) |
| **IonQ** | local con `?engine=ionq` | `services/ionq.js` vía el proxy del dev-server |
| **Qiskit** | dentro de Qollab | `back/quantum/qiskit.js` (Statevector) |

Las **probabilidades** siempre son exactas (Statevector en Qollab, referencia en local). IonQ solo
aporta la **medición** (el colapso real).

### IonQ (opcional)

Para usar el simulador de IonQ en local:

1. Copiá `front/qards/.env.example` a `front/qards/.env` y completá `IONQ_API_KEY`.
   (También podés pasar la key con `--key` o `--env <ruta>`.)
2. Levantá el dev-server.
3. Abrí el juego con `?engine=ionq`:

   ```
   http://localhost:8000/front/qards/dev.html?engine=ionq
   ```

La key **nunca va al browser ni al repo**: `.env` está en `.gitignore` y el dev-server la usa
server-side.

### Qollab

Para correr con el backend **Qiskit** en Qollab:

1. Empaquetá la app plana: `node front/qards/build.mjs` → `front/qards.zip`.
2. Subí ese zip como proyecto **JS/Qiskit**, elegí el backend en *Select QPU* y **Run**.

Ahí `backend` existe, así que el puerto cuántico usa Qiskit (`back/quantum/qiskit.js`).

## Prototipos de cartas

Con el dev-server levantado, los prototipos visuales quedan accesibles en:

```
http://localhost:8000/cards/index.html            # cartas cuánticas + clásicas (hover)
```

> Se sirven por HTTP (no abrir con `file://`): al usar ES modules, el navegador bloquea los
> imports por CORS sobre el sistema de archivos.

## Empaquetar el proyecto

`utils/zip.js` arma un zip con **todo el proyecto**. No tiene dependencias: el contenedor ZIP se
escribe con `node:zlib` (deflate crudo) + CRC32, así que no necesita el binario `zip` ni
`npm install`.

```bash
node utils/zip.js                      # -> quantum-hackaton.zip en la raíz del repo
node utils/zip.js --out dist/app.zip   # elegir la ruta de salida
```

- Busca la raíz con `git rev-parse --show-toplevel` (si no hay git, usa el directorio actual).
- Ignora `node_modules`, `.git`, `.atl`, `dist`, `build`, `.venv`, `venv`, `.idea`, `.vscode`, y
  los archivos `.DS_Store`, `*.log` y `*.zip`.
- Salida por defecto: `quantum-hackaton.zip` en la raíz del repo.

> Para el bundle de **solo la app** en formato plano de Qollab (`front/qards.zip`) usá
> `node front/qards/build.mjs`.

## Tests

Desde la raíz del repo:

```bash
node --import ./front/qards/tests/qiskit-hooks.mjs --test front/qards/tests/services.test.js
```

O, desde `front/qards/`:

```bash
cd front/qards
npm test
```

El motor del back hace `import ... from 'qiskit'`. En el navegador esa import se resuelve con un
**import map** a `quantum/qiskit-stub.js`; como Node no tiene import maps, `qiskit-hooks.mjs`
registra un **hook de resolución** que mapea `qiskit` y `qiskit.quantum_info` al mismo stub. Los
tests corren con el motor de referencia local, así que el stub (que lanza) nunca se invoca.

## Estructura

```
.
├── index.html          ENTRY del repo (raíz) · monta el juego en #root
├── main.css            estilos del juego (raíz)
├── main.js             ENTRY del repo (raíz) · importa front/qards/main.js
├── README.md           portada (inglés) · README.es.md (español)
├── docs/               toda la documentación
│   ├── README.md           este archivo (guía del proyecto)
│   ├── ARCHITECTURE.md     doc técnica canónica
│   ├── idea.md · decisions.md · plan.md
│   ├── gates.md · quantum-concepts.md · determinism.md · engines.md
│   ├── known-issues.md · roadmap.md · hackathon-brief.md
│   └── AGENTS.md           contexto para agentes de IA
├── examples/           notebook Qiskit ejecutable + requirements
├── assets/             notas para grabar el demo (sin GIF)
├── back/               motor del juego (estado.js) + capa cuántica (quantum/)
│   ├── estado.js
│   └── quantum/        util.js · qiskit.js · referencia.js
├── front/
│   └── qards/         APP PRINCIPAL (dev-server, tests, ui, services)
├── cards/              prototipos de cartas (index · card_final)
└── utils/zip.js        empaquetador del proyecto (zip sin dependencias)
```

## Créditos

Base de Qollab (fragmento `index.html` + `main.css` + `main.js`) según `app/00` y `app/02` de
Qubitle. Sin frameworks, sin CDN, sin bundler: solo ES modules.

## Licencia

MIT — ver [LICENSE](../LICENSE).
