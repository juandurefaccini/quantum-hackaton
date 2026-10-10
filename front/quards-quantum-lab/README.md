# Quards · Quantum Lab (probe)

Banco de pruebas para las primitivas que va a necesitar **Quards** (UNO cuántico). No es el
juego: es una app web que arma circuitos de 1–3 qubits, aplica compuertas, entrelaza, mide y
muestra la distribución — todo corriendo con el **mismo código** en local (simulador en JS) y en
Qollab (Qiskit sobre el backend elegido).

Prueba, de punta a punta: statevector general, compuertas X/Y/Z/H/S/T, CNOT, Bell/GHZ,
medición por shots, y el patrón de **adaptadores** (`collapse/source.js`).

## Cómo corre

- **Local:** `python3 -m http.server 8000` y abrir `http://localhost:8000/dev.html`. `dev.html` trae
  un **import map** que mapea `qiskit` a `quantum/qiskit-stub.js`, así el grafo de módulos carga
  aunque no haya Qiskit. Sin Qollab no existe `backend`, así que usa el sampler de statevector en
  JS (el badge lo aclara).
- **Qollab:** subir el zip como proyecto JS / Qiskit, elegir backend en Select QPU, **Run**, y en
  la página armar un circuito y presionar **Medir**. Ahí `collapse/source.js` usa el adaptador de
  Qiskit (`qiskit-source.js`, el único archivo que importa `qiskit`).

`index.html` es el fragmento (`<div id="root"></div>`) que Qollab sirve; `main.js` espera a
`#root`, monta y termina en `await new Promise(() => {})` para mantener viva la sesión (IonQ solo
es alcanzable mientras `main.js` corre).

### Por qué no hay imports dinámicos

Qollab empaqueta los archivos alcanzables por imports **estáticos**; un archivo referenciado solo
por `import()` dinámico no se emite, y el `import()` resuelve contra la base `_nuxt/` de Qollab y
falla (`Failed to fetch dynamically imported module`). Por eso `collapse/source.js` importa los dos
adaptadores de forma estática y elige en runtime.


## Debug

Si algo falla, **no hay pantalla negra**: hay un panel `debug` abajo a la izquierda con cada paso
(boot, adaptador, ops, counts) y cualquier error global (`error` / `unhandledrejection`). Si el
montaje falla, se muestra el stack completo en el lugar de la app. Además:

- Si no hay `backend` (local), usa el sampler fake y el badge/panel lo indican.
- Si el fondo WebGL no está disponible, se avisa y el resto sigue igual.


## Layout

| Ruta | Rol |
| :-- | :-- |
| `main.js` | boot: espera `#root`, monta, mantiene la sesión viva |
| `quantum/` | dominio puro: `complex.js`, `rng.js`, `statevector.js` (simulador 1–4 qubits), `qiskit-stub.js` (solo dev, vía import map) |
| `collapse/` | el adaptador: `source.js` elige (imports estáticos), `fake-source.js` (JS local), `qiskit-source.js` (único import de `qiskit`), `pool.js` (parseo little-endian) |
| `ui/` | `render.js` (DOM), `background.js` (WebGL 320×180), `audio.js` (WebAudio), `debug.js` (panel en pantalla) |
| `main.css` | estilos + CRT overlay + cartas/tiles 3D |
| `tests/` | `node --test tests/statevector.test.js` (fuera del zip) |
| `dev.html` | página completa para desarrollo local (fuera del zip) |

## Primitivas que verifica

- `|amp|²` con amplitudes complejas; H·Z·H = X (la fase solo importa combinada con H).
- Bell `00`/`11` y GHZ `000`/`111` con correlación total.
- Orden de bits little-endian, igual que las claves de counts de Qiskit.

## Límites conocidos

- En Qollab el sandbox es restrictivo: si el fondo WebGL o las animaciones (rAF) no pintan, el
  resto de la app sigue igual. Es justamente lo que la prueba quiere detectar.
- Los tests de `node --test` necesitan el `package.json` (`"type": "module"`), que no va al zip.
- `package.json`, `dev.html` y `tests/` quedan fuera del zip de Qollab.

## Créditos

Base de Qollab (fragmento `index.html` + `main.css` + `main.js` con `await new Promise`) según
`app/00` y `app/02` de Qubitle. Sin frameworks, sin CDN, sin bundler: solo ES modules.
