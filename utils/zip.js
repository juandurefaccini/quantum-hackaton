#!/usr/bin/env node
/**
 * Bundle the whole project into a single zip for upload.
 *
 * Zero dependencies: the ZIP container is written with node:zlib (raw deflate)
 * plus a local CRC32, so no external `zip` binary and no npm packages are needed.
 *
 * Usage:
 *   node utils/zip.js
 *   node utils/zip.js --out dist/app.zip
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const EXCLUDED_DIRS = new Set([
  '.git',
  '.atl',
  'node_modules',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
]);

// Generated build output: regenerable with `node qollab/build.mjs`, not part of the source.
const EXCLUDED_PATHS = new Set(['qollab/app']);

const DEFAULT_OUTPUT = 'quantum-hackaton.zip';

function isExcludedFile(name) {
  return name === '.DS_Store' || name.endsWith('.log') || name.endsWith('.zip');
}

function findProjectRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

function collectFiles(root, dir, files) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = relative(root, abs).split(sep).join('/');
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.has(name) || EXCLUDED_PATHS.has(rel)) continue;
      collectFiles(root, abs, files);
    } else if (stat.isFile() && !isExcludedFile(name)) {
      files.push(abs);
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const { time, day } = dosDateTime(new Date());

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuffer, compressed);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(day, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

function parseArgs(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex === -1) return { output: null };
  const value = argv[outIndex + 1];
  if (!value) throw new Error('--out requires a path');
  return { output: value };
}

function main() {
  const { output } = parseArgs(process.argv.slice(2));
  const root = findProjectRoot();
  const outputPath = resolve(output ?? join(root, DEFAULT_OUTPUT));

  const files = [];
  collectFiles(root, root, files);

  const entries = [];
  let rawBytes = 0;
  for (const abs of files) {
    if (abs === outputPath) continue;
    const data = readFileSync(abs);
    rawBytes += data.length;
    entries.push({ name: relative(root, abs).split(sep).join('/'), data });
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  const zip = buildZip(entries);
  writeFileSync(outputPath, zip);

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(`Zipped ${entries.length} files -> ${relative(root, outputPath)}`);
  console.log(`  raw: ${kb(rawBytes)}  zip: ${kb(zip.length)}`);
}

main();
