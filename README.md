# Quards — UNO cuántico

Juego de cartas donde cada carta es un **qubit** con dos caras posibles (una por cada estado
`|0⟩` y `|1⟩`). Gana quien se queda sin cartas antes que el rival: **persona vs. IA**.

El juego vive en **JS puro (ES modules)**, sin frameworks, sin bundler y sin dependencias. El
motor de reglas está desacoplado de la UI, y el colapso de las cartas pasa por un **adaptador
cuántico** (simulador local, Qiskit o IonQ).

- Especificación: [`docs/idea.md`](docs/idea.md)
- Decisiones de diseño: [`docs/decisions.md`](docs/decisions.md)
- Plan de implementación: [`docs/plan.md`](docs/plan.md)
- Detalle de la app: [`front/quards/README.md`](front/quards/README.md) y
  [`front/quards/DESIGN.md`](front/quards/DESIGN.md)

## Requisitos

- **Node.js 18+** (el dev-server usa `fetch` global y `node:http`). No hay `npm install`:
  el proyecto no tiene dependencias.
- Un navegador moderno (ES modules + import maps).

## Cómo levantar la app

La app principal está en `front/quards/`. Se sirve con un **dev-server** incluido que, además de
servir el repo, **proxya IonQ** (para que el browser no llame directo a la API ni exponga la key).

Desde la raíz del repo:

```bash
node front/quards/dev-server.mjs
```

Luego abrir:

```
http://localhost:8000
```

`/` redirige a `http://localhost:8000/front/quards/dev.html`, que monta el juego.

El server también acepta:

```bash
node front/quards/dev-server.mjs --port 8000          # puerto (default 8000)
node front/quards/dev-server.mjs --env /ruta/a/.env   # archivo .env con la key de IonQ
node front/quards/dev-server.mjs --key TU_IONQ_KEY    # key directa
```

> Alternativa: `cd front/quards && npm run dev`.

> El dev-server sirve **todo el repo** (no solo la app) para que `services/` pueda importar
> `../../../back/` y para poder abrir los prototipos de cartas con el mismo server.

### Motor cuántico

El puerto cuántico (`front/quards/services/quantum.js`) elige el adaptador según el entorno:

| Motor | Cuándo | Qué usa |
| :-- | :-- | :-- |
| **referencia** | local, **por defecto** | Simulador JS (`back/quantum/referencia.js`) |
| **IonQ** | local con `?engine=ionq` | `services/ionq.js` vía el proxy del dev-server |
| **Qiskit** | dentro de Qollab | `back/quantum/qiskit.js` (Statevector) |

Las **probabilidades** siempre son exactas (Statevector en Qollab, referencia en local). IonQ solo
aporta la **medición** (el colapso real).

### IonQ (opcional)

Para usar el simulador de IonQ en local:

1. Copiá `front/quards/.env.example` a `front/quards/.env` y completá `IONQ_API_KEY`.
   (También podés pasar la key con `--key` o `--env <ruta>`.)
2. Levantá el dev-server.
3. Abrí el juego con `?engine=ionq`:

   ```
   http://localhost:8000/front/quards/dev.html?engine=ionq
   ```

La key **nunca va al browser ni al repo**: `.env` está en `.gitignore` y el dev-server la usa
server-side. Para el backend Qiskit en **Qollab**, ver `front/quards/README.md`.

## Prototipos de cartas

Con el dev-server levantado, los prototipos visuales quedan accesibles en:

```
http://localhost:8000/cards/index.html            # cartas cuánticas + clásicas (hover)
```

> Se sirven por HTTP (no abrir con `file://`): al usar ES modules, el navegador bloquea los
> imports por CORS sobre el sistema de archivos.

## Tests

Desde la raíz del repo:

```bash
node --import ./front/quards/tests/qiskit-hooks.mjs --test front/quards/tests/services.test.js
```

O, desde `front/quards/`:

```bash
cd front/quards
npm test
```

El motor del back hace `import ... from 'qiskit'`. En el navegador esa import se resuelve con un
**import map** a `quantum/qiskit-stub.js`; como Node no tiene import maps, `qiskit-hooks.mjs`
registra un **hook de resolución** que mapea `qiskit` y `qiskit.quantum_info` al mismo stub. Los
tests corren con el motor de referencia local, así que el stub (que lanza) nunca se invoca.

## Estructura

```
.
├── README.md
├── docs/               idea · decisions · plan
├── back/               motor del juego (estado.js) + capa cuántica (quantum/)
│   ├── estado.js
│   └── quantum/        qiskit.js · referencia.js
├── front/
│   └── quards/         APP PRINCIPAL (dev-server, tests, ui, services)
└── cards/              prototipos de cartas (index · card_final)
```

## Licencia

MIT — ver [LICENSE](LICENSE).
