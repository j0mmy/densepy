import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

function μwait(buffer, pattern, timeoutMs = 8000) {
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

await τ('Υ repl evaluates glyph lines, blocks, and facades interactively', async () => {
  const proc = spawn(process.execPath, [Υ, 'repl'], { cwd: ρ });
  const buffer = { text: '' };
  proc.stdout.on('data', (d) => { buffer.text += d; });
  try {
    proc.stdin.write('ν ≔ 2\n');
    proc.stdin.write('☉(ν × 21)\n');
    await μwait(buffer, /42/);

    proc.stdin.write('λ f():\n');
    proc.stdin.write('    ⊢ Ⅶ\n');
    proc.stdin.write('\n');
    proc.stdin.write('f()\n');
    await μwait(buffer, /(^|\n)7\n/);

    proc.stdin.write('JSON.dumps({"a": 1})\n');
    await μwait(buffer, /\{"a": 1\}/);
  } finally {
    proc.kill('SIGTERM');
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy repl tests: 1 passed, 0 failed');
