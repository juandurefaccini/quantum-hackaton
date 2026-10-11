// Punto de entrada HTML/JS del repo (raíz).
// Monta la app Qards que vive en front/qards/ dentro de #root.
//
//   node front/qards/dev-server.mjs   &&   abrir http://localhost:8000/
//
// El motor por defecto es el simulador de referencia local (back/quantum/referencia.js),
// así que no necesita backend ni Qollab para correr. Con ?engine=ionq usa IonQ vía el proxy
// del dev-server.
import './front/qards/main.js';
