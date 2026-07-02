import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γformat, γlint, γrun } from '../../src/glyph-python/γpy.mjs';

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

τ('γformat normalizes γ operators while preserving indentation strings comments and imports', () => {
  const src = `import json as ξjson\nλ f():   \n    χ≔Ⅰ\n    # keep χ≔Ⅰ in comment\n    ☉("keep χ≔Ⅰ in string")   \n`; 
  const expected = `import json as ξjson\nλ f():\n    χ ≔ Ⅰ\n    # keep χ≔Ⅰ in comment\n    ☉("keep χ≔Ⅰ in string")\n`;
  const out = γformat(src);
  assert.equal(out, expected);
  assert.equal(γformat(out), expected);
  const r = γrun(`${out}\nf()\n`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'keep χ≔Ⅰ in string');
});

τ('Υ fmt writes changed files and --check is idempotent after formatting', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-fmt-'));
  try {
    const file = join(root, 'messy.gpy');
    writeFileSync(file, 'χ≔Ⅰ   \n☉(χ)\n');
    const before = ψ(['fmt', '--check', file]);
    assert.notEqual(before.status, 0);
    assert.match(before.stderr, /fmt would change/);

    const fmt = ψ(['fmt', file]);
    assert.equal(fmt.status, 0, fmt.stderr + fmt.stdout);
    assert.equal(readFileSync(file, 'utf8'), 'χ ≔ Ⅰ\n☉(χ)\n');

    const after = ψ(['fmt', '--check', file]);
    assert.equal(after.status, 0, after.stderr + after.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('γlint warns on λ keywords in project-owned code when γ aliases exist', () => {
  const warnings = γlint('def f():\n    print("x")\n    return None\n', { path: 'bad.gpy' });
  assert.equal(warnings.length, 3);
  assert.match(warnings.join('\n'), /bad\.gpy:1 mixed-style: use λ instead of def/);
  assert.match(warnings.join('\n'), /bad\.gpy:2 mixed-style: use ☉ instead of print/);
  assert.match(warnings.join('\n'), /bad\.gpy:3 mixed-style: use ⊢ instead of return/);
});

τ('Υ lint catches host-boundary glyph corruption in import module names', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-lint-'));
  try {
    const file = join(root, 'bad-import.gpy');
    writeFileSync(file, 'import jsøn\nfrom pathlib import Path as Ρθ\n');
    const r = ψ(['lint', file]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /host-boundary: import module names must stay ASCII/);
    assert.doesNotMatch(r.stderr + r.stdout, /Ρθ/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('γlint flags capability usage: process, network, file write, dynamic code', () => {
  const src = 'import subprocess\nsubprocess.run(["ls"])\nurllib.request.urlopen("http://x")\nopen("x.txt", "w")\neval("1+1")\n';
  const warnings = γlint(src, { path: 'caps.gpy' });
  const text = warnings.join('\n');
  assert.match(text, /caps\.gpy:1 capability: process execution/);
  assert.match(text, /caps\.gpy:3 capability: network access/);
  assert.match(text, /caps\.gpy:4 capability: file write/);
  assert.match(text, /caps\.gpy:5 capability: dynamic code execution/);
});

τ('Υ fmt and lint with no file process the whole project tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-fmtlint-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'fl-tool']).status, 0);
    writeFileSync(join(root, 'src', 'a.gpy'), 'χ≔Ⅰ\n☉(χ)\n');
    writeFileSync(join(root, 'src', 'b.gpy'), 'def f():\n    return 1\n');

    const fmt = ψ(['fmt'], { cwd: root });
    assert.equal(fmt.status, 0, fmt.stderr + fmt.stdout);
    assert.match(fmt.stdout, /fmt OK 3 files/);
    assert.equal(readFileSync(join(root, 'src', 'a.gpy'), 'utf8'), 'χ ≔ Ⅰ\n☉(χ)\n');

    const lint = ψ(['lint'], { cwd: root });
    assert.notEqual(lint.status, 0);
    assert.match(lint.stderr + lint.stdout, /b\.gpy:1 mixed-style: use λ instead of def/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy formatter/linter tests: 6 passed, 0 failed');
