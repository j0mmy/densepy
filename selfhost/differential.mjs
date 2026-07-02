#!/usr/bin/env node
// Differential test: compile every corpus program with the reference JS
// compiler AND the self-hosted compiler (SELF_COMPILER, default gen1.py),
// execute both with python3, and assert identical stdout + exit status.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, cpSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { γcompile } from '../src/glyph-python/γpy.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CORPUS = join(HERE, 'corpus');
const SELF = process.env.SELF_COMPILER ?? join(HERE, 'gen1.py');

function selfCompile(file) {
  const r = spawnSync('python3', [SELF, file], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) throw new Error(`self compiler failed on ${file}:\n${r.stderr}`);
  return r.stdout;
}

function runProgram(modules, fixtureDir) {
  const dir = mkdtempSync(join(tmpdir(), 'gpy-diff-'));
  try {
    if (fixtureDir && existsSync(fixtureDir)) cpSync(fixtureDir, dir, { recursive: true });
    for (const [name, code] of modules) writeFileSync(join(dir, name), code);
    const r = spawnSync('python3', ['main.py'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout: r.stdout ?? '', status: r.status ?? -1 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let pass = 0;
let fail = 0;
let identical = 0;
let total = 0;
for (const name of readdirSync(CORPUS).sort()) {
  const path = join(CORPUS, name);
  let files; // [gpyPath, emittedName][]
  if (statSync(path).isDirectory()) {
    if (name === 'fixtures') continue;
    files = readdirSync(path).filter((f) => f.endsWith('.gpy')).sort()
      .map((f) => [join(path, f), f.replace(/\.gpy$/, '.py')]);
  } else {
    if (!name.endsWith('.gpy')) continue;
    files = [[path, 'main.py']];
  }
  total += 1;
  const fixtureDir = join(CORPUS, 'fixtures', name.replace(/\.gpy$/, ''));
  try {
    const jsMods = files.map(([p, out]) => [out, γcompile(readFileSync(p, 'utf8'))]);
    const selfMods = files.map(([p, out]) => [out, selfCompile(p)]);
    const bytesEqual = jsMods.every(([, code], i) => code === selfMods[i][1]);
    if (bytesEqual) identical += 1;
    const a = runProgram(jsMods, fixtureDir);
    const b = runProgram(selfMods, fixtureDir);
    if (a.stdout === b.stdout && a.status === b.status) {
      pass += 1;
      console.log(`PASS ${name}${bytesEqual ? ' (byte-identical)' : ''}`);
    } else {
      fail += 1;
      console.log(`FAIL ${name}`);
      console.log(`  js:   status=${a.status} stdout=${JSON.stringify(a.stdout)}`);
      console.log(`  self: status=${b.status} stdout=${JSON.stringify(b.stdout)}`);
    }
  } catch (error) {
    fail += 1;
    console.log(`FAIL ${name}\n  ${error.message}`);
  }
}
console.log(`\ndifferential: ${pass}/${total} passed, ${fail} failed, ${identical}/${total} byte-identical (self=${SELF})`);
process.exit(fail === 0 ? 0 : 1);
