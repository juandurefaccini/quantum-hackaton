// Hand-written WebGL swirl on a 320x180 buffer, upscaled with pixelation.
// Domain-warped fBm mixing petroleum green and red.
//
//   startBackground(canvas)                    -> rAF loop en tiempo real (juego)
//   startBackground(canvas, { manual: true })  -> sin loop; el llamador fija el
//                                                 tiempo con stop.setTime(s) y dibuja
//                                                 con stop.render() (studio: reloj virtual)
//
// Devuelve siempre la función `stop`; además lleva `setTime`/`render` para el modo manual.
export function startBackground(canvas, { manual = false, preserveDrawingBuffer = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer });
  if (!gl) { const noop = () => {}; noop.setTime = noop; noop.render = noop; return noop; }

  const vs = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const fs = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
      float t = u_time * 0.05;
      float r = length(uv);
      float ang = atan(uv.y, uv.x);
      ang += r * 3.2 - t * 3.0;
      vec2 q = vec2(cos(ang), sin(ang)) * r;
      float n = fbm(q * 2.6 + vec2(t * 1.5, -t));
      float n2 = fbm(q * 1.3 + n * 1.9 + vec2(-t, t * 1.1));
      vec3 green = vec3(0.020, 0.235, 0.215);
      vec3 red = vec3(0.430, 0.090, 0.070);
      vec3 col = mix(green, red, smoothstep(0.25, 0.85, n2));
      col *= 0.55 + 0.95 * n2;
      col *= smoothstep(1.25, 0.10, r);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'u_res');
  const uTime = gl.getUniformLocation(program, 'u_time');
  gl.uniform2f(uRes, canvas.width, canvas.height);

  const draw = seconds => { gl.uniform1f(uTime, seconds); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  let raf = 0;
  let virtual = 0;
  const start = performance.now();
  const frame = now => {
    draw((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  };
  if (!manual) raf = requestAnimationFrame(frame);

  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  stop.setTime = seconds => { virtual = seconds; };
  stop.render = () => draw(virtual);
  return stop;
}
