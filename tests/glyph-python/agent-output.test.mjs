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

τ('check --agent emits one err line, no traceback noise', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-agent-check-'));
  try {
    const file = join(root, 'bad.gpy');
    writeFileSync(file, 'λ bad(:\n    ⊢ 1\n');
    const r = ψ(['check', '--agent', file]);
    assert.notEqual(r.status, 0);
    const text = (r.stderr + r.stdout).trim();
    assert.equal(text.split('\n').length, 1, text);
    assert.match(text, /^err .*bad\.gpy:1 /);
    assert.match(text, /SyntaxError|invalid syntax/);
    assert.doesNotMatch(text, /Traceback/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('check --agent emits ok line on success', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-agent-ok-'));
  try {
    const file = join(root, 'good.gpy');
    writeFileSync(file, 'fn f(n)=n*2\nprint(f(3))\n');
    const r = ψ(['check', '--agent', file]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout.trim(), /^ok .*good\.gpy$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('run --agent keeps program stdout, compacts runtime errors to err lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-agent-run-'));
  try {
    const file = join(root, 'boom.gpy');
    writeFileSync(file, '☉("start")\nχ ≔ 1 ÷ 0\n');
    const r = ψ(['run', '--agent', file]);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout.trim(), 'start');
    const err = r.stderr.trim();
    assert.match(err, /^err .*boom\.gpy:2 ZeroDivisionError/);
    assert.doesNotMatch(err, /Traceback/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('lint --agent prefixes each finding with warn', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-agent-lint-'));
  try {
    const file = join(root, 'caps.gpy');
    writeFileSync(file, 'import subprocess\n');
    const r = ψ(['lint', '--agent', file]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr.trim(), /^warn .*caps\.gpy:1 capability: process execution$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy agent output tests: 4 passed, 0 failed');
