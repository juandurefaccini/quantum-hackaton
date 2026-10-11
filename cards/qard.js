// Reexport del módulo canónico de la carta (fuente única).
// El módulo vive en front/qards/ui/qard.js para que el juego (que se empaqueta
// plano en el zip de Qollab) no dependa de rutas fuera de la app. Cards/ lo
// reexporta para poder seguir haciendo `import { createQard } from './qard.js'`.
//
// Referencia de diseño (px originales, sin cambios): cards/card_final.html
export * from '../front/qards/ui/qard.js';
