# Subir Qards a Qollab — pasos exactos

Guía operativa para publicar el proyecto en Qollab antes del cierre del hackathon.
El bundle se genera con `node qollab/build.mjs` en `app/` (no se versiona: `qollab/app/` está en
`.gitignore`, y el script lo reescribe entero cada vez).

> **Estado de verificación:** el bundle se generó y se validó su grafo de imports y su lógica
> cuántica contra Qiskit local (ver el resumen de la sesión). **La ejecución dentro de Qollab NO
> se pudo verificar desde acá** (no hay cuenta/entorno Qollab en este repo). Los pasos de abajo
> incluyen una checklist para que la confirmes vos antes de enviar.

## 0. Antes de empezar

- **Navegador:** Chrome, Edge, Brave, Opera, o **Firefox 153+**. **Safari no ejecuta proyectos**
  (le falta WebAssembly JSPI). En iPhone/iPad todo usa Safari → hacelo en una computadora.
- **Repo público con licencia MIT:** <https://github.com/juandurefaccini/quantum-hackaton>
  (`LICENSE` ya es MIT).
- **Regenerar el bundle** (si tocás el código del juego): `node qollab/build.mjs`.

## 1. Crear el proyecto en Qollab

1. Qollab → **+ New Project**.
2. Nombre: `Qards — a quantum card game`. Descripción corta: *A card game where every card is a qubit.*

## 2. Subir los archivos

Subí el **contenido de `qollab/app/`** (o el `qards-qollab.zip`; Qollab descomprime el zip).
La raíz del proyecto Qollab debe quedar así:

```
index.html          <- body: <div id="root">…</div>  (obligatorio)
main.js             <- entry del runtime (obligatorio)
main.css            <- único stylesheet que Qollab carga (opcional)
services/           engine.js rules.js ai.js quantum.js ionq.js
ui/                 render.js debug.js qard.js collapse.js entangle.js background.js audio.js
back/               estado.js
back/quantum/       util.js referencia.js qiskit.js
```

Notas:
- `index.html` + `main.js` en la raíz hacen que Qollab lo trate como **proyecto JS/Qiskit**.
- **No** subas `PROJECT-CARD.md`, `README-SUBIDA.md` ni `DEMO-SCRIPT.md` al proyecto (son para la
  Project Card / para vos). Solo importan los `.js`, `index.html` y `main.css`.
- **No** subas `quantum/qiskit-stub.js` (el bundle no lo incluye): dentro de Qollab `qiskit` es el
  paquete real.
- Límites: hasta 100 archivos de 2 MB. El bundle tiene 23 archivos pequeños.

## 3. Project Card

Pegá el Markdown de **[`PROJECT-CARD.md`](PROJECT-CARD.md)** (inglés) en la pestaña
**Project Card**. Completá además:

- **Thumbnail:** ya está generada en [`thumbnail.png`](thumbnail.png) (16:9, 2560×1440, con las cartas
  reales del juego). Subila a Qollab; si preferís, usá una captura del tablero en su lugar.
- **Tags:** `qiskit`, `ionq`, `game`, `entanglement`, `superposition`.
- **Contributors:** agregá a los colaboradores reales.
- **Links → Git repository:** el repo de arriba. **Link → website:** opcional.
- **Herramientas de IA:** la card nombra solo lo verificable desde el repo (`docs/AGENTS.md` como
  brief de los agentes de código). Si querés nombrar productos específicos (p. ej. el asistente que
  usaste), editalo en las dos cards.

## 4. Publicar y correr

1. **Publish** una versión del proyecto (todas las versiones son públicas; fijá la última).
2. Marcala como **default** (versión pública por defecto).
3. **Select QPU → simulador local** (el gratuito) y **Run**.

## 5. Checklist de pruebas EN QOLLAB (hacela vos antes de enviar)

- [ ] **Run** con el **simulador local** arranca y se ve el tablero + `Tu turno`.
- [ ] El pie muestra la atribución **This effort is supported by Qollab & IonQ**.
- [ ] Arrastrar una carta al **descarte** funciona (o clic en el descarte con la carta elegida).
- [ ] Aplicar una **puerta** (`X`/`Z`/`H`) a una carta y ver que no cierra el turno.
- [ ] Jugar una **carta cuántica** → animación de **colapso** y narración en el panel **Info**
      (mientras la IA juega, la línea del jugador sigue visible).
- [ ] **CNOT** entre dos cartas propias → se dibujan juntas con el marco **⚛ entrelazadas**; jugar
      una y ver que la otra queda **condicionada** (el panel Info muestra la fase/probabilidad).
- [ ] **Ojo (👁):** espiar una carta cuántica de la IA.
- [ ] **Nueva partida** reinicia el tablero y el panel Info.
- [ ] **Consola:** sin errores en rojo (el panel **Debug** del header también ayuda).
- [ ] Cambiar la IA a **Difícil** y comprobar que sigue jugable.
- [ ] **Enlaces:** el repo del Project Card abre sin login; los tres videos (EN, ES y el extra solo EN)
      abren sin login.
- [ ] **IonQ (opcional):** Select QPU → simulador de IonQ → Run. El **primer** colapso usa el job
      de IonQ; a partir del segundo, como IonQ admite **un solo job por ejecución**, el juego sigue
      midiendo con el simulador de referencia (explicado en la card). Verificá que **no se rompe**.

## 6. Recordatorios del reglamento

- Registrar el envío desde la página de registro (lo hace el capitán) **antes de Oct 11, 19:00 ET**.
- Video de demo **2–3 min** en un enlace **público sin login** (ver [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md)).
- Declarar el código preexistente y las herramientas usadas (sección *What existed before* de la card).
- Atribución exacta presente: **This effort is supported by Qollab & IonQ**

## 7. Cómo se genera el bundle (referencia)

```bash
node qollab/build.mjs
```

Aplana la app (`front/qards/`) + el motor (`back/`) en `qollab/app/`, reescribe las rutas
`../../../back/` → `../back/` y prepone el `@import` de la fuente en `main.css`. También escribe
`qollab/qards-qollab.zip`. El script falla si queda alguna ruta `../../../` sin reescribir.
