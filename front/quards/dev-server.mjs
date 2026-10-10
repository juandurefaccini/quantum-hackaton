#!/usr/bin/env node
// Dev server: sirve el repo estático y proxya IonQ.
// El browser no puede llamar a api.ionq.co (CORS) ni conviene exponer la API key,
// así que las llamadas a /ionq/* se reenvían desde acá con la key (server-side).
//
//   node front/quards/dev-server.mjs --env /ruta/a/.env
//   node front/quards/dev-server.mjs --key TU_KEY --port 8000
//
// Key: process.env.IONQ_API_KEY, o un archivo .env (front/quards/.env por defecto).
// NUNCA se commitea la key (los .env están gitignored).
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // front/quards/
const ROOT = resolve(HERE, '..', '..'); // raíz del repo

const argv = process.argv.slice(2);
const argVal = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const PORT = Number(argVal('--port', process.env.PORT || 8000));
const ENV_PATH = argVal('--env', join(HERE, '.env'));

function loadKey() {
  if (process.env.IONQ_API_KEY) return process.env.IONQ_API_KEY.trim();
  if (existsSync(ENV_PATH)) {
    const m = readFileSync(ENV_PATH, 'utf8').match(/^\s*IONQ_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  return null;
}
const KEY = loadKey();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health del proxy (para que el puerto cuántico sepa si IonQ está disponible).
  if (url.pathname === '/ionq/health') {
    return send(res, 200, JSON.stringify({ ok: true, hasKey: Boolean(KEY) }), { 'Content-Type': 'application/json' });
  }

  // Proxy IonQ: /ionq/<path> -> https://api.ionq.co/<path>
  if (url.pathname.startsWith('/ionq/')) {
    if (!KEY) return send(res, 503, JSON.stringify({ error: 'Falta IONQ_API_KEY (usá --env o --key)' }), { 'Content-Type': 'application/json' });
    const target = 'https://api.ionq.co' + url.pathname.slice('/ionq'.length) + url.search;
    try {
      const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : undefined;
      const upstream = await fetch(target, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', Authorization: `apiKey ${KEY}` },
        body,
      });
      const text = await upstream.text();
      return send(res, upstream.status, text, { 'Content-Type': 'application/json' });
    } catch (error) {
      return send(res, 502, JSON.stringify({ error: String(error && error.message ? error.message : error) }), { 'Content-Type': 'application/json' });
    }
  }

  // Estático
  if (url.pathname === '/') { res.writeHead(302, { Location: '/index.html' }); return res.end(); }
  const filePath = resolve(join(ROOT, decodeURIComponent(url.pathname)));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) return send(res, 403, 'forbidden');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return send(res, 404, 'not found');
  send(res, 200, readFileSync(filePath), { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
});

server.listen(PORT, () => {
  console.log(`Quards dev-server en http://localhost:${PORT}`);
  console.log(`  app:   http://localhost:${PORT}/            (entry raíz: index.html + main.js)`);
  console.log(`  dev:   http://localhost:${PORT}/front/quards/dev.html`);
  console.log(`  IonQ:  ${KEY ? 'proxy ACTIVO (key cargada)' : 'sin key (usá --env o --key)'}  [${ENV_PATH}]`);
});
