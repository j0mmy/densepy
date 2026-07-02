import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

function ψ(args, opts = {}) {
  return spawnSync(process.execPath, [Υ, ...args], {
    cwd: opts.cwd ?? ρ,
    encoding: 'utf8',
  });
}

function τ(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

τ('Υ check remaps Python syntax errors to .gpy line with γ excerpt', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-diag-check-'));
  try {
    const file = join(root, 'bad.gpy');
    writeFileSync(file, 'λ bad(:\n    ⊢ 1\n');
    const r = ψ(['check', file]);
    assert.notEqual(r.status, 0);
    const text = r.stderr + r.stdout;
    assert.match(text, /SyntaxError/);
    assert.match(text, /bad\.gpy:1/);
    assert.match(text, /λ bad\(:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run remaps runtime traceback to .gpy line with γ excerpt', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-diag-run-'));
  try {
    const file = join(root, 'boom.gpy');
    writeFileSync(file, 'χ ≔ 1 ÷ 0\n☉(χ)\n');
    const r = ψ(['run', file]);
    assert.notEqual(r.status, 0);
    const text = r.stderr + r.stdout;
    assert.match(text, /ZeroDivisionError/);
    assert.match(text, /boom\.gpy:1/);
    assert.match(text, /χ ≔ 1 ÷ 0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run remaps traceback correctly when facade prelude shifts lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-diag-prelude-'));
  try {
    const file = join(root, 'facade-boom.gpy');
    writeFileSync(file, '☉("start")\nΔ ≔ JSON.loads("{bad")\n');
    const r = ψ(['run', file]);
    assert.notEqual(r.status, 0);
    const text = r.stderr + r.stdout;
    assert.match(text, /JSONDecodeError/);
    assert.match(text, /facade-boom\.gpy:2/);
    assert.match(text, /Δ ≔ JSON\.loads/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ check --show-py exposes emitted Python as secondary detail', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-diag-show-'));
  try {
    const file = join(root, 'show.gpy');
    writeFileSync(file, 'λ φ():\n    ⊢ Ⅰ\n');
    const r = ψ(['check', '--show-py', file]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /--- emitted python ---/);
    assert.match(r.stdout, /def φ\(\):/);
    assert.match(r.stdout, /return 1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy diagnostics tests: 4 passed, 0 failed');
