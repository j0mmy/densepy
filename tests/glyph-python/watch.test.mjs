import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

function μwait(buffer, pattern, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (pattern.test(buffer.text)) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        reject(new Error(`timeout waiting for ${pattern}; got:\n${buffer.text}`));
      }
    }, 50);
  });
}

async function τ(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

await τ('Υ watch rechecks on save and reports remapped diagnostics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-watch-'));
  try {
    writeFileSync(join(root, 'gpy.toml'), '[project]\nname = "watched"\n\n[gpy]\nsource = "src"\nemit = "build/py"\nmain = "src/main.gpy"\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'main.gpy'), '☉("ok")\n');

    const proc = spawn(process.execPath, [Υ, 'watch'], { cwd: root });
    const buffer = { text: '' };
    proc.stdout.on('data', (d) => { buffer.text += d; });
    proc.stderr.on('data', (d) => { buffer.text += d; });
    try {
      await μwait(buffer, /watch: 1 files? OK/);
      writeFileSync(join(root, 'src', 'main.gpy'), 'λ bad(:\n    ⊢ 1\n');
      await μwait(buffer, /SyntaxError/);
      assert.match(buffer.text, /main\.gpy:1/);
    } finally {
      proc.kill('SIGTERM');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy watch tests: 1 passed, 0 failed');
