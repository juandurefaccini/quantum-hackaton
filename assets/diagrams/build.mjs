#!/usr/bin/env node
// Genera los SVG de los diagramas Mermaid que usan la documentación y la Project Card.
//
//   node assets/diagrams/build.mjs
//
// El MISMO código Mermaid vive dentro de los .md (README, docs/*.md), donde GitHub lo renderiza.
// Acá se renderiza a SVG con kroki.io para poder usarlo como imagen en la Project Card de Qollab,
// que NO renderiza Mermaid. Sin dependencias locales: solo `fetch` + `zlib`.
//
// Se generan dos versiones por diagrama: `<name>-en.svg` y `<name>-es.svg` (el README y las cards
// existen en ambos idiomas). Mantener los bloques sincronizados con los de los .md.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DIAGRAMS = {
  port: {
    en: `flowchart TD
  UI["UI: ui/render.js"] --> PORT["services/quantum.js (port)"]
  PORT -->|exact probabilities| REF["reference (local)"]
  PORT -->|exact probabilities| QK["qiskit: Statevector (Qollab)"]
  PORT -->|measurement| REF
  PORT -->|measurement| IONQ["ionq (local proxy)"]
  PORT -->|measurement| QK`,
    es: `flowchart TD
  UI["UI: ui/render.js"] --> PORT["services/quantum.js (puerto)"]
  PORT -->|probabilidades exactas| REF["referencia (local)"]
  PORT -->|probabilidades exactas| QK["qiskit: Statevector (Qollab)"]
  PORT -->|medición| REF
  PORT -->|medición| IONQ["ionq (proxy local)"]
  PORT -->|medición| QK`,
  },
  playflow: {
    en: `flowchart TD
  P["Play a card"] --> C{"has a face?"}
  C -->|yes| R["resolve the play"]
  C -->|no| M["phase = measuring; medirGrupo(group)"]
  M --> RM["resolveMeasure(bits)"]
  RM --> R
  R --> V{"matches the discard?"}
  V -->|yes| OK["valid: to discard + effect"]
  V -->|no| BAD["invalid: stays collapsed + draw 1"]`,
    es: `flowchart TD
  P["Jugar una carta"] --> C{"¿tiene cara?"}
  C -->|sí| R["resolver la jugada"]
  C -->|no| M["phase = measuring; medirGrupo(group)"]
  M --> RM["resolveMeasure(bits)"]
  RM --> R
  R --> V{"¿coincide con el descarte?"}
  V -->|sí| OK["válida: al descarte + efecto"]
  V -->|no| BAD["inválida: queda colapsada + roba 1"]`,
  },
  boot: {
    en: `flowchart LR
  H["index.html + main.js (root)"] --> M["front/qards/main.js"]
  M --> R["ui/render.js: mount()"]
  R --> ROOT["#root"]`,
    es: `flowchart LR
  H["index.html + main.js (raíz)"] --> M["front/qards/main.js"]
  M --> R["ui/render.js: mount()"]
  R --> ROOT["#root"]`,
  },
  plays: {
    en: `flowchart TD
  Q{"What do you want?"} --> A["The other face"]
  Q --> B["To commit"]
  Q --> D["To link two cards"]
  A --> AX["X: swaps the faces (20% to 80%)"]
  B --> BF["Read the Fase line"]
  BF --> H["H: at least 80% toward that face (50/50 to ~100%)"]
  B --> BZ["Z then H: to the opposite face"]
  D --> DC["CNOT: measuring one pins the other"]`,
    es: `flowchart TD
  Q{"¿Qué querés?"} --> A["La otra cara"]
  Q --> B["Comprometerte"]
  Q --> D["Ligar dos cartas"]
  A --> AX["X: intercambia las caras (20% a 80%)"]
  B --> BF["Leé la línea Fase"]
  BF --> H["H: al menos 80% hacia esa cara (50/50 a ~100%)"]
  B --> BZ["Z y después H: a la cara opuesta"]
  D --> DC["CNOT: medir una fija la otra"]`,
  },
};

async function render(file, source) {
  const enc = deflateSync(Buffer.from(source, 'utf8')).toString('base64url');
  const res = await fetch(`https://kroki.io/mermaid/svg/${enc}`);
  if (!res.ok) throw new Error(`${file}: kroki devolvió ${res.status}`);
  const svg = await res.text();
  if (!svg.trimStart().startsWith('<svg')) throw new Error(`${file}: la respuesta no es SVG`);
  writeFileSync(join(HERE, file), svg);
  console.log(`svg -> assets/diagrams/${file}`);
}

for (const [name, langs] of Object.entries(DIAGRAMS)) {
  for (const [lang, source] of Object.entries(langs)) await render(`${name}-${lang}.svg`, source);
}
