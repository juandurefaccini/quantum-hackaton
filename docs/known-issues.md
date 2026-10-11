# Quards — Problemas conocidos

Estado de los problemas y la deuda técnica. Lo verificado contra el código; el estado de cada motor,
en [`engines.md`](engines.md).

## Resueltos (2026-10)

Problemas detectados en las revisiones, ya corregidos:

> **Dónde se lee el resultado de una medición:** en el panel **Info** (arriba del botón Robar). Ahora
> guarda las **últimas 3 líneas** y cada narración también se emite al panel **Debug** (que antes solo
> decía `Midiendo con …`).

| Problema | Fix | Dónde |
| :-- | :-- | :-- |
| Al medir, solo se veía `Midiendo con referencia…`; no se narraba el resultado | El panel **Info** ahora muestra qué cara salió, con qué probabilidad y si fue válida/inválida, para el jugador **y** para la IA | `front/quards/ui/render.js` (`describeResult`) |
| La narración duraba ~0.7 s: la jugada de la IA la pisaba enseguida y casi no se leía | El panel Info muestra las **últimas 3** líneas (y cada una va también al panel Debug) | `front/quards/ui/render.js` (`recent`, `pushEvent`) |
| "Nueva partida" no limpiaba el Info: seguía mostrando la jugada anterior | Se reinicia el historial de narración al empezar una partida | `front/quards/ui/render.js` |
| El checkbox de Debug no reflejaba el estado real y arrancaba tildado | El panel arranca **apagado** (no se persiste) y el checkbox se sincroniza en cada render | `front/quards/ui/debug.js`, `ui/render.js` |
| Un comodín en el descarte se veía como ★ negra, sin el color elegido | El descarte pinta el comodín con el **color vigente** (`activeColor`). *Lógica verificada; falta confirmación visual.* | `front/quards/ui/render.js` |
| El panel **Debug** tapaba parte de la mano | El panel arranca **colapsado** (solo la barra) y se expande con el botón o ante un error | `front/quards/ui/debug.js` |
| `dev.html` con CSS roto (`../main.css` → `front/main.css` inexistente, **404**) | La hoja apunta a la raíz del repo (`../../main.css`). Verificado por HTTP. | `front/quards/dev.html` |

## Abiertos (deuda técnica)

| Tema | Detalle | Ubicación |
| :-- | :-- | :-- |
| **`ui/circuit.js` huérfano** | Nadie lo importa (el tooltip de circuito se removió). Código muerto. | `front/quards/ui/circuit.js` |
| **`utils/render.js` y `utils/rules.js`** | Copias viejas y **rotas**: importan rutas que no existen (`../services/`, `./engine.js`). No son la app real. | `utils/` |
| **Acceso directo de Windows** | `front - Acceso directo.lnk`: basura sin valor. | `front/quards/` |
| **Sin picker de color para comodines** | El color se elige **automáticamente** (el más frecuente de tu mano). | `services/rules.js` (`chooseWildColor`) |
| **IA "difícil" no es expectimax** | Prueba puertas + mayor probabilidad; no estima la mano rival. | `services/ai.js` |
| **`turn.direction` sin uso** | Existe en el estado, pero las reglas 2p no lo usan. | `back/estado.js` |
| **`state.log` no se muestra** | Reglas escribe un historial de texto, pero la UI actual **no lo renderiza** (solo el viejo `utils/render.js`). La narración nueva usa otro canal (`lastEvent`). | `services/rules.js`, `ui/render.js` |
| **Colapso no reproducible** | El armado está sembrado, pero la medición usa `Math.random`. Detalle y propuesta: [`determinism.md`](determinism.md). | `services/quantum.js` |

## Limitaciones de entorno (documentadas, no bugs)

- **`ionq` (proxy) y `qiskit` (Qollab) no verificados** en este repo: no hay key ni acceso a Qollab.
  Ver [`engines.md`](engines.md).
- **IonQ (simulador):** ~3.6 s por medición; hay timeouts (poll 400 ms, timeout 90 s) y fallback.
- **Sandbox de Qollab:** el fondo WebGL o las animaciones (rAF) pueden no pintar; el resto sigue.
- **Iconos/emoji:** el juego usa `👁`, `⚛`, `⊘`, etc. en etiquetas; dependen de la fuente del sistema.

## Accesibilidad

Fortalezas actuales: alto contraste (texto claro `#f4ede0` sobre fondo oscuro), tipografía legible
(Chakra Petch + monoespaciada para datos), y respeto por `prefers-reduced-motion` (se apagan las
animaciones de reparto/colapso/FLIP). Pendiente: revisar el contraste de los gradientes de carta más
claros y etiquetas ARIA de los controles de arrastre.
