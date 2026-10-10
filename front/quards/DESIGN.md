# Quards — Diseño

## Objetivo
UNO cuántico 1v1 (humano vs IA), sin servidor, corriendo en Qollab (JS + Qiskit) y en local
(referencia JS o IonQ). El motor es el del **back**; el front lo consume vía **servicios**.

## Arquitectura (puertos y adaptadores)
```
back/            MOTOR: estado.js (mazo, cartas/grupos, ops), quantum/qiskit.js (Qiskit), quantum/referencia.js (simulador Node)
front/quards/
  services/      CAPA DE SERVICIOS (lo único que la UI conoce)
    engine.js      fachada de back/estado.js (+ clone)
    quantum.js     PUERTO cuántico: probabilidades (qiskit|referencia) + medición (qiskit|ionq|referencia)
    rules.js       REGLAS/TURNOS sobre el modelo del back (el back no trae reglas)
    ai.js          IA (fácil/media/difícil)
    ionq.js        adaptador IonQ vía proxy local
  ui/            DOM (estética del probe: WebGL, CRT, WebAudio, líneas SVG de entrelazado)
```
- **Puerto cuántico** (`services/quantum.js`): una sola interfaz; elige el adaptador por
  `typeof backend` (Qollab→Qiskit) o config (`?engine=ionq` → IonQ; si no, referencia).
  Las **probabilidades** son exactas (Statevector/referencia); la **medición** es la que puede pasar
  por IonQ.
- **Reglas** (`services/rules.js`): mutan el estado (como el motor del back). La app orquesta
  `play → medir → resolveMeasure`.

## Modelo del back
- Toda carta es un qubit: **clásica** (`group=null`, `face` fija) o **cuántica** (`group`, `outcomes`
  = dos caras). Un **grupo** es un circuito (`ops`: `ry`, `cx`, `h`, `x`, `z`) compartido por 1+ cartas.
- **Puertas** (`player.gates`): no son cartas; se otorgan al inicio del turno (`otorgarPuerta`).
- Medición: `medirGrupo` (Qiskit/IonQ/referencia) devuelve los bits; colapsa el grupo (fija `face`).

## Decisiones clave (ver `docs/decisions.md`)
- Motor del **back** como fuente de verdad (108 cartas, comodines, CNOT para entrelazar).
- Puertas X/Z/H/CNOT **otorgadas por turno**, **preparación libre** (sin costo de turno).
- Jugada inválida: la carta queda en la mano colapsada y se roba una.
- Efectos UNO: skip/reverse (pierde turno), +2, comodín, +4.
- **Victoria: mano vacía** (las puertas están aparte, no en la mano).

## Alternativas consideradas
- **Imports dinámicos** (como Qubitle): descartados — Qollab no empaqueta los archivos referidos
  solo por `import()`. Se usan imports **estáticos** + import map (dev) para `qiskit`.
- **Vendorizar `back/` en el front**: descartado en el repo (se importa `../../../back/`); el
  **build del zip** (`build.mjs`) sí lo empaqueta y reescribe la ruta a `../back/`.
- **Medición por IonQ**: el simulador devuelve probabilidades (no muestrea); el adaptador muestrea
  local. En un QPU el muestreo es real (`histogram`).

## Pendientes
- Verificar Qiskit/IonQ dentro de Qollab.
- IA difícil: expectimax real + estimación de la mano rival.
- Picker de color para comodines.
- Multijugador (fase futura, requiere servidor).
