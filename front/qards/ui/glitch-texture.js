// Prueba: la superposición como DOS cartas solapadas + shader glitch (WebGL).
// El "source" (dos cartas dibujadas en un canvas 2D) se sube como textura y un
// fragment shader le aplica RGB split y desplazamiento de slices por bandas.

const SYM = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4' };
const PALETTE = { red: '#e0463a', yellow: '#e6b23a', green: '#2fae6a', blue: '#3a7bd5' };
const symOf = f => SYM[f.symbol] ?? f.symbol;
const hexOf = f => PALETTE[f.color] || '#e6b23a';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Dibuja las dos cartas solapadas (boca arriba) en un canvas 2D.
function drawSource(faceA, faceB, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // Norma 5:7 (ancho:alto) para toda carta renderizada.
  const ch = Math.round(h * 0.86), cw = Math.round(ch * 5 / 7);

  const card = (x, y, rot, face, pct) => {
    g.save();
    g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, 4, 5, cw, ch, 10); g.fill();
    g.fillStyle = hexOf(face); roundRect(g, 0, 0, cw, ch, 10); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#0b0a09'; roundRect(g, 2, 2, cw - 4, ch - 4, 9); g.stroke();
    g.fillStyle = face.color ? '#fff' : '#1b1a18';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${Math.round(cw * 0.5)}px ui-monospace, "SFMono-Regular", monospace`;
    g.fillText(symOf(face), cw / 2, ch / 2);
    if (pct != null) {
      g.font = `bold ${Math.round(cw * 0.17)}px ui-monospace, monospace`;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(`${Math.round(pct * 100)}%`, cw / 2, ch - 16);
    }
    g.restore();
  };

  card(Math.round(w * 0.05), Math.round(h * 0.07), -0.13, faceA, 0.5);
  card(Math.round(w * 0.37), Math.round(h * 0.09), 0.13, faceB, 0.5);
  return c;
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
    uv.y = 1.0 - uv.y;                       // la textura del canvas va top-down
    float tick = floor(u_time * 9.0);
    float g = step(0.55, rand(vec2(tick, 1.7)));   // disparo del glitch por "tick"
    float band = floor(uv.y * 16.0);
    float disp = (rand(vec2(band, tick)) - 0.5) * 0.14 * u_amt * g;
    vec2 p = uv; p.x += disp;
    float split = (0.004 + 0.020 * g) * u_amt;
    vec4 c;
    c.r = texture2D(u_tex, p + vec2(split, 0.0)).r;
    c.g = texture2D(u_tex, p).g;
    c.b = texture2D(u_tex, p - vec2(split, 0.0)).b;
    c.a = texture2D(u_tex, p).a;
    float scan = step(0.985, rand(vec2(uv.y * 90.0, tick))) * g * 0.6 * u_amt;
    c.rgb += scan;
    gl_FragColor = c;
  }
`;

export function createGlitch(faceA, faceB, { intensity = 1, width = 240, height = 200 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.className = 'glitch-card';

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return { el: canvas, stop() {}, setIntensity() {}, setPaused() {} };

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
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

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawSource(faceA, faceB, width, height));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uRes = gl.getUniformLocation(program, 'u_res');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uAmt = gl.getUniformLocation(program, 'u_amt');
  gl.uniform2f(uRes, width, height);
  gl.uniform1f(uAmt, intensity);

  let amt = intensity, paused = false, raf = 0, frozen = 0;
  const start = performance.now();
  const frame = now => {
    const t = paused ? frozen : (now - start) / 1000;
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    el: canvas,
    stop() { cancelAnimationFrame(raf); },
    setIntensity(v) { amt = v; gl.uniform1f(uAmt, amt); },
    setPaused(v) { if (v) frozen = (performance.now() - start) / 1000; paused = v; },
  };
}
