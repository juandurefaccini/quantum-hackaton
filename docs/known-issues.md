# Qards — Problemas conocidos

Estado de los problemas y la deuda técnica. Lo verificado contra el código; el estado de cada motor,
en [`engines.md`](engines.md).

## Resueltos (2026-10)

Problemas detectados en las revisiones, ya corregidos:

> **Dónde se lee el resultado de una medición:** en el panel **Info** (arriba del botón Robar). Ahora
> guarda las **últimas 3 líneas** y cada narración también se emite al panel **Debug** (que antes solo
> decía `Midiendo con …`).

| Problema | Fix | Dónde |
| :-- | :-- | :-- |
| Al medir, solo se veía `Midiendo con referencia…`; no se narraba el resultado | El panel **Info** ahora muestra qué cara salió, con qué probabilidad y si fue válida/inválida, para el jugador **y** para la IA | `front/qards/ui/render.js` (`describeResult`) |
| La narración duraba ~0.7 s: la jugada de la IA la pisaba enseguida y casi no se leía | El panel Info muestra las **últimas 3** líneas (y cada una va también al panel Debug) | `front/qards/ui/render.js` (`recent`, `pushEvent`) |
| "Nueva partida" no limpiaba el Info: seguía mostrando la jugada anterior | Se reinicia el historial de narración al empezar una partida | `front/qards/ui/render.js` |
| El checkbox de Debug no reflejaba el estado real y arrancaba tildado | El panel arranca **apagado** (no se persiste) y el checkbox se sincroniza en cada render | `front/qards/ui/debug.js`, `ui/render.js` |
| Un comodín en el descarte se veía como ★ negra, sin el color elegido | El descarte pinta el comodín con el **color vigente** (`activeColor`). *Lógica verificada; falta confirmación visual.* | `front/qards/ui/render.js` |
| El panel **Debug** tapaba parte de la mano | El panel arranca **colapsado** (solo la barra) y se expande con el botón o ante un error | `front/qards/ui/debug.js` |
| `dev.html` con CSS roto (`../main.css` → `front/main.css` inexistente, **404**) | La hoja apunta a la raíz del repo (`../../main.css`). Verificado por HTTP. | `front/qards/dev.html` |

## Abiertos (deuda técnica)

| Tema | Detalle | Ubicación |
| :-- | :-- | :-- |
| **Sin picker de color para comodines** | El color se elige **automáticamente** (el más frecuente de tu mano). | `services/rules.js` (`chooseWildColor`) |
| **IA "difícil" no es expectimax** | Prueba puertas + mayor probabilidad; no estima la mano rival. | `services/ai.js` |
| **`turn.direction` sin uso** | Existe en el estado, pero las reglas 2p no lo usan. | `back/estado.js` |
| **`state.log` no se muestra** | Reglas escribe un historial de texto, pero la UI **no lo renderiza**; la narración usa otro canal (`lastEvent`). | `services/rules.js`, `ui/render.js` |
| **Colapso no reproducible** | El armado está sembrado, pero la medición usa `Math.random`. Detalle y propuesta: [`determinism.md`](determinism.md). | `services/quantum.js` |

## Limitaciones de entorno (documentadas, no bugs)

- **`ionq` (proxy) y `qiskit` (Qollab) no verificados** en este repo: no hay key ni acceso a Qollab.
  Ver [`engines.md`](engines.md).
- **IonQ (simulador):** ~3.6 s por medición; hay timeouts (poll 400 ms, timeout 90 s) y fallback.
- **Sandbox de Qollab:** el fondo WebGL o las animaciones (rAF) pueden no pintar; el resto sigue.
- **Iconos/emoji:** el juego usa `👁`, `⚛`, `⊘`, etc. en etiquetas; dependen de la fuente del sistema.

## Accesibilidad

Revisión de contraste y tamaño (2026-10, sobre `main.css`). Ratios WCAG estimados sobre el fondo
oscuro del juego (`#0b0a09` / `rgba(0,0,0,…)`).

**Fortalezas**

- Texto principal claro `#f4ede0` sobre oscuro: ~13:1. Ámbar `--gold #e6b23a`: ~10.8:1. Muted
  `#b9ac97`: ~9.4:1. Todos por encima de AA (4.5:1).
- El texto de ayuda del panel **Info** (ámbar) y el turno (`Turno…` en ámbar) son legibles.
- El juego respeta `prefers-reduced-motion` (apaga reparto, colapso y FLIP).
- Los controles son `<button>`/`<select>` reales (foco de teclado y `:focus-visible` nativos).

**Corregido (simple y seguro)**

| Hallazgo | Antes | Después |
| :-- | :-- | :-- |
| `count-pill` (n.º de cartas de la IA): teal `#22b3a0` sobre tinte teal 12 % daba ~**4.1:1**, por debajo de AA para texto de 12 px | `color: var(--teal)` | Teal claro `#7fe3d5` → ~**6.9:1** |
| Etiquetas de 10 px (`Info`, `⚛ entrelazadas`) | 10 px | 11 px |
| Etiqueta de los pilares `Mazo`/`Descarte` | 11 px | 12 px |

**Pendiente (no bloqueante)**

- Tamaño mínimo de tipografía: quedan etiquetas de **11 px** (`Info`, `⚛ entrelazadas`, `.spy-mark`,
  `.debug`) y la leyenda del colapso. Recomendado ≥12 px para texto de UI; se dejó 11 px por
  espacio. No afecta la jugabilidad.
- Los iconos son emoji (`👁`, `⚛`, `⊘`): dependen de la fuente del sistema; sin etiqueta de texto
  propia, un lector de pantalla puede no anunciarlos. Las acciones principales sí tienen texto.
- Los controles de arrastre (cartas) tienen `title` pero no `aria-label` explícito.
- Falta auditar contraste de los **gradientes** de las caras de carta (color de fondo variable).
