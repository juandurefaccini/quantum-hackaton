// GLITCH DE LAS CARTAS CUÁNTICAS (superposición con shader de textura).
//
// La carta cuántica se dibuja (split diagonal + símbolos, el mismo diseño del DOM)
// en un canvas 2D que se sube como TEXTURA; un fragment shader le aplica RGB split
// y desplazamiento de slices por bandas, así el glitch deforma la imagen REAL de la
// carta (no es un ruido encima). Reemplaza el glitch CSS/overlay anterior.
//
//   const fx = mountGlitchCard(canvas, { color0, sym0, color1, sym1 });
//   fx.setHover(true);    // hover: el glitch se atenúa con una transición y se ve la carta limpia
//   fx.stop();            // libera el contexto
//
// El canvas vive dentro de .inner-canvas de la carta. Se adapta al tamaño real de la
// carta (ResizeObserver) y se auto-libera cuando sale del DOM, así no se agotan los
// contextos WebGL al reconstruir la mano. Sin WebGL o con prefers-reduced-motion cae
// a la misma carta dibujada estática en 2D.

const GRAD = {
  red: ['#e0463a', '#5a1c17'],
  blue: ['#3a7bd5', '#16305e'],
  green: ['#2fae6a', '#14502f'],
  yellow: ['#e6b23a', '#6f5314'],
  grey: ['#2b2620', '#0d1117'],
};

// `background` = color base de la carta: si el canvas WebGL quedara transparente un
// instante (p.ej. al re-dimensionar), se ve el fondo de la carta y no el blanco del hover.
const FX_CSS = '.qard-fx { position: absolute; inset: 0; width: 100%; height: 100%; display: block; border-radius: inherit; background: #0d1117; }';

function injectStyle() {
  if (document.getElementById('qards-glitch-fx')) return;
  const tag = document.createElement('style');
  tag.id = 'qards-glitch-fx';
  tag.textContent = FX_CSS;
  document.head.append(tag);
}

// Dibuja la carta cuántica (dos mitades en diagonal + símbolos) en un contexto 2D.
// Replica el diseño de qard.js: gradiente radial por color, split diagonal, kets.
function drawCard(g, w, h, { color0, sym0, color1, sym1 }) {
  const paint = (color, clip) => {
    g.save();
    g.beginPath(); clip(); g.clip();
    const [a, b] = GRAD[color] || GRAD.grey;
    const rad = g.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, Math.hypot(w, h) * 0.8);
    rad.addColorStop(0, a);
    rad.addColorStop(1, b);
    g.fillStyle = rad;
    g.fillRect(0, 0, w, h);
    g.restore();
  };
  // half-0: triángulo superior-izquierdo; half-1: inferior-derecho.
  paint(color0, () => { g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(0, h); g.closePath(); });
  paint(color1, () => { g.moveTo(w, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); });

  const fs = w * 0.30;
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `300 ${fs}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  if (sym0 != null) g.fillText(String(sym0), w * 0.30, h * 0.30);
  if (sym1 != null) g.fillText(String(sym1), w * 0.70, h * 0.70);
}

const VS = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FS = `
  precision mediump float;
  uniform sampler2D u_tex;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_amt;
  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv.y = 1.0 - uv.y;                       // la textura del canvas 2D va top-down
    float tick = floor(u_time * 9.0 + u_amt);
    float g = step(0.55, rand(vec2(tick, 1.7)));   // disparo del glitch por "tick"
    float band = floor(uv.y * 16.0);
    float disp = (rand(vec2(band, tick)) - 0.5) * 0.08 * u_amt * g;
    vec2 p = uv; p.x += disp;
    float split = (0.003 + 0.012 * g) * u_amt;
    vec4 c;
    c.r = texture2D(u_tex, p + vec2(split, 0.0)).r;
    c.g = texture2D(u_tex, p).g;
    c.b = texture2D(u_tex, p - vec2(split, 0.0)).b;
    c.a = texture2D(u_tex, p).a;
    gl_FragColor = c;
  }
`;

// Montajes vivos (para poder frenarlos de golpe, p.ej. al desmontar la app).
const registry = new Set();

export function disposeAllGlitch() {
  for (const fx of [...registry]) fx.stop();
}

export function mountGlitchCard(canvas, spec = {}) {
  injectStyle();

  const pxSize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return [Math.max(1, Math.round((r.width || 120) * dpr)), Math.max(1, Math.round((r.height || 168) * dpr))];
  };

  // Sin movimiento o sin WebGL: la misma carta, estática, en 2D.
  const staticCard = () => {
    const [w, h] = pxSize();
    canvas.width = w; canvas.height = h;
    drawCard(canvas.getContext('2d'), w, h, spec);
    return { stop() {}, setHover() {} };
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return staticCard();

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return staticCard();

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    tex: gl.getUniformLocation(program, 'u_tex'),
    res: gl.getUniformLocation(program, 'u_res'),
    time: gl.getUniformLocation(program, 'u_time'),
    amt: gl.getUniformLocation(program, 'u_amt'),
  };

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const source = document.createElement('canvas');
  const sctx = source.getContext('2d');
  let lastW = 0, lastH = 0;
  let amt = 1, target = 1, raf = 0, running = true;
  const start = performance.now();

  // Dibuja un frame con el estado actual. Se usa en el loop Y justo después de un
  // resize: asignar canvas.width borra el buffer, y sin un dibujo inmediato el canvas
  // queda transparente un instante (se cuela el fondo blanco del hover = flash).
  function draw(now) {
    gl.uniform1f(U.amt, amt);
    gl.uniform1f(U.time, (now - start) / 1000);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function upload(w, h) {
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    canvas.width = w; canvas.height = h;
    source.width = w; source.height = h;
    sctx.clearRect(0, 0, w, h);
    drawCard(sctx, w, h, spec);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(U.res, w, h);
    gl.viewport(0, 0, w, h);
    if (running) draw(performance.now());   // redibuja ya mismo: sin hueco transparente
  }
  upload(...pxSize());

  const ro = new ResizeObserver(() => upload(...pxSize()));
  ro.observe(canvas);

  const frame = now => {
    if (!canvas.isConnected) { stop(); return; }   // la carta salió del DOM: libera
    // La intensidad persigue al objetivo: hover apaga el glitch con una transición
    // suave (~0.25 s, igual que el encuadro blanco del qard) y al salir vuelve.
    amt += (target - amt) * 0.18;
    if (Math.abs(target - amt) < 0.001) amt = target;
    draw(now);
    raf = requestAnimationFrame(frame);
  };

  function stop() {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    registry.delete(fx);
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* sin extensión */ }
  }
  function setHover(v) { target = v ? 0 : 1; }   // hover => glitch a 0 (carta limpia)

  const fx = { stop, setHover };
  registry.add(fx);
  raf = requestAnimationFrame(frame);
  return fx;
}
