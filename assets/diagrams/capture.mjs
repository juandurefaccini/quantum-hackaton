#!/usr/bin/env node
// Captura PNG de cartas REALES (mismo CSS que la app) con Chrome headless.
// Se usan en la documentación y en la Project Card de Qollab (que no renderiza Mermaid).
//
//   node assets/diagrams/capture.mjs
//
// Requiere Google Chrome o Brave instalado. Salida: PNG 2x en assets/diagrams/.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!CHROME) { console.error('No encontré Chrome/Brave.'); process.exit(1); }

// Mismo CSS que front/qards/ui/qard.js (medidas en em), con la paleta de la app.
const CSS = `
  .qard-card, .qard-card * { box-sizing: border-box; }
  .qard-card { width: var(--qard-w, 200px); aspect-ratio: 5 / 7; font-size: calc(var(--qard-w, 200px) / 10);
    border-radius: .9em; border: .1em solid #fff; position: relative; background-color: #0d1117;
    box-shadow: 0 .7em 1.5em rgba(0,0,0,.7); overflow: hidden; }
  .inner-canvas { position: absolute; inset: 0; border-radius: .8em; overflow: hidden; }
  .full-bg { position: absolute; inset: 0; }
  .half-0 { position: absolute; inset: 0; clip-path: polygon(0 0, 100% 0, 0 100%); }
  .half-1 { position: absolute; inset: 0; clip-path: polygon(100% 0, 100% 100%, 0 100%); }
  .diagonal-line { position: absolute; inset: 0;
    background: linear-gradient(to bottom right, transparent calc(50% - .05em), rgba(255,255,255,.4) 50%, transparent calc(50% + .05em)); }
  .grad-red { background: radial-gradient(circle at 30% 30%, #e0463a 0%, #5a1c17 100%); }
  .grad-blue { background: radial-gradient(circle at 30% 30%, #3a7bd5 0%, #16305e 100%); }
  .grad-green { background: radial-gradient(circle at 30% 30%, #2fae6a 0%, #14502f 100%); }
  .grad-yellow { background: radial-gradient(circle at 30% 30%, #e6b23a 0%, #6f5314 100%); }
  .grad-grey { background: radial-gradient(circle at 30% 30%, #2b2620 0%, #0d1117 100%); }
  .symbols-layer { position: absolute; inset: 0; z-index: 2; }
  .sym { position: absolute; font-size: 3.04em; font-weight: 300; color: #fff; line-height: 1; }
  .sym-0 { top: 30%; left: 30%; transform: translate(-50%,-50%); }
  .sym-1 { bottom: 30%; right: 30%; transform: translate(50%,50%); }
  .sym-center { top: 50%; left: 50%; transform: translate(-50%,-50%); }
  .header, .footer { position: absolute; left: .5em; right: .5em; display: flex; justify-content: space-between;
    align-items: center; z-index: 10; height: 1.2em; }
  .header { top: .3em; } .footer { bottom: .3em; } .footer.classic-footer { justify-content: flex-end; }
  .ket-badge { font-size: .76em; font-weight: 300; color: #fff; }
`;

const quantumCard = ({ c0 = 'red', s0 = '7', c1 = 'blue', s1 = '2', w = 200 }) => `
  <div class="qard-card" style="--qard-w:${w}px">
    <div class="header"><span class="ket-badge">|0⟩</span></div>
    <div class="inner-canvas">
      <div class="half-0 grad-${c0}"></div><div class="half-1 grad-${c1}"></div>
      <div class="diagonal-line"></div>
      <div class="symbols-layer"><span class="sym sym-0">${s0}</span><span class="sym sym-1">${s1}</span></div>
    </div>
    <div class="footer"><span class="ket-badge">|1⟩</span></div>
  </div>`;

const classicCard = ({ c = 'red', s = '7', w = 200 }) => `
  <div class="qard-card" style="--qard-w:${w}px">
    <div class="header"><span class="ket-badge">${s}</span></div>
    <div class="inner-canvas"><div class="full-bg grad-${c}"></div>
      <div class="symbols-layer"><span class="sym sym-center">${s}</span></div></div>
    <div class="footer classic-footer"><span class="ket-badge">${s}</span></div>
  </div>`;

function page(body, { bg = 'transparent' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;500;700&display=swap" rel="stylesheet">
  <style>html,body{margin:0;padding:0;background:${bg};font-family:'Chakra Petch',ui-sans-serif,sans-serif}
  ${CSS}</style></head><body>${body}</body></html>`;
}

const measure = (t) => `
  <div style="display:flex;align-items:center;gap:26px;padding:26px 30px;background:#0b0a09;color:#f4ede0">
    <figure style="margin:0;text-align:center">
      ${quantumCard({ w: 190 })}
      <figcaption style="margin-top:10px;font-size:14px;color:#b9ac97">${t.before}</figcaption>
    </figure>
    <div style="text-align:center;color:#e6b23a;font-size:16px;font-weight:700;white-space:nowrap">
      ${t.arrow}<div style="font-size:22px">→</div>
    </div>
    <figure style="margin:0;text-align:center">
      ${classicCard({ w: 190 })}
      <figcaption style="margin-top:10px;font-size:14px;color:#b9ac97">${t.after}</figcaption>
    </figure>
  </div>`;

const thumbnail = `
  <div style="width:1280px;height:720px;background:#0b0a09;color:#f4ede0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:36px">
    <div style="text-align:center">
      <h1 style="margin:0;font-size:96px;letter-spacing:.14em;text-transform:uppercase;text-shadow:4px 4px 0 #000">Qards</h1>
      <p style="margin:14px 0 0;font-size:26px;color:#e6b23a">Every card is a qubit — a quantum card game</p>
    </div>
    <div style="display:flex;gap:26px">
      ${classicCard({ c: 'red', s: '7', w: 168 })}
      ${quantumCard({ c0: 'red', s0: '7', c1: 'blue', s1: '2', w: 168 })}
      ${classicCard({ c: 'blue', s: '⇄', w: 168 })}
    </div>
    <p style="margin:0;font-size:18px;color:#b9ac97">Qiskit · IonQ · MIT</p>
  </div>`;

const PAGES = [
  { name: 'card-quantum', w: 248, h: 328, bg: 'transparent', html: page(`<div style="padding:24px">${quantumCard({})}</div>`) },
  { name: 'card-classic', w: 248, h: 328, bg: 'transparent', html: page(`<div style="padding:24px">${classicCard({})}</div>`) },
  { name: 'measure-en', w: 560, h: 330, bg: '#0b0a09', html: page(measure({ before: 'Quantum card · 2 faces', arrow: 'play = measure', after: 'Collapsed · 1 face' })) },
  { name: 'measure-es', w: 560, h: 330, bg: '#0b0a09', html: page(measure({ before: 'Carta cuántica · 2 caras', arrow: 'jugar = medir', after: 'Colapsada · 1 cara' })) },
  { name: 'thumbnail', out: join(HERE, '..', '..', 'qollab', 'thumbnail.png'), w: 1280, h: 720, bg: '#0b0a09', html: page(thumbnail) },
];

const TMP = mkdtempSync(join(tmpdir(), 'qards-cards-'));
try {
  for (const p of PAGES) {
    const htmlPath = join(TMP, `${p.name}.html`);
    const out = p.out || join(HERE, `${p.name}.png`);
    writeFileSync(htmlPath, p.html);
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--default-background-color=${p.bg === 'transparent' ? '00000000' : 'FF0B0A09'}`,
      `--window-size=${p.w},${p.h}`, '--virtual-time-budget=2500',
      `--screenshot=${out}`, `file://${htmlPath}`,
    ], { stdio: 'ignore' });
    console.log(`png -> ${out.replace(join(HERE, '..', '..') + '/', '')}`);
  }
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
