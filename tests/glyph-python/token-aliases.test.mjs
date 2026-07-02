import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γcompile, γrun } from '../../src/glyph-python/γpy.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;

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

function pyCompile(src) {
  const root = mkdtempSync(join(tmpdir(), 'γpy-pyc-'));
  const path = join(root, 'out.py');
  try {
    writeFileSync(path, src);
    return spawnSync('python3', ['-m', 'py_compile', path], { encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

τ('γ aliases compile outside strings/comments only', () => {
  const src = `# λ ≔ ≤ stay comment\nλ φ(ν):\n    s ≔ "λ ≔ ≤ stay string"\n    ⎇ ν ≤ 1:\n        ⊢ 1\n    ∴:\n        ⊢ ν × φ(ν − 1)\n\n☉(φ(6))\n`;
  const out = γcompile(src);
  assert.match(out, /# λ ≔ ≤ stay comment/);
  assert.match(out, /"λ ≔ ≤ stay string"/);
  assert.match(out, /def φ\(ν\):/);
  assert.match(out, /if ν <= 1:/);
  assert.match(out, /else\s*:/);
  assert.match(out, /return ν \* φ\(ν - 1\)/);
  assert.match(out, /print\s*\(φ\(6\)\)/);
  assert.equal(pyCompile(out).status, 0, out);
});

τ('γ factorial runs on python and prints 720', () => {
  const src = readFileSync(join(repoRoot, 'examples/glyph-python/factorial.gpy'), 'utf8');
  const result = γrun(src);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '720');
});

τ('γ JSON/file script keeps Python stdlib imports usable', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-json-'));
  try {
    writeFileSync(join(root, 'data.json'), '{"name":"JT","score":10}');
    const src = readFileSync(join(repoRoot, 'examples/glyph-python/json-file.gpy'), 'utf8');
    const result = γrun(src, { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'JT:10');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('γ glyphs inside f-string expressions are rewritten; literal text preserved', () => {
  const src = `ν ≔ 3\n☉(f"doubled: {ν × 2}")\n☉(f"sym × stays: {ν − 1}")\n☉(f"esc {{×}} and spec {ν:>3}")\n`;
  const out = γcompile(src);
  assert.equal(pyCompile(out).status, 0, out);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), [
    'doubled: 6',
    'sym × stays: 2',
    'esc {×} and spec   3',
  ]);
});

τ('γ glyphs inside nested f-string string literals stay literal', () => {
  const src = `Δ ≔ {"×": 9}\n☉(f"val: {Δ['×']}")\n`;
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'val: 9');
});

τ('γ glyphs inside nested f-strings compile at every depth', () => {
  const src = `ν ≔ 3\n☉(f"outer {f'inner {ν × 2}'} end")\n`;
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'outer inner 6 end');
});

τ('γ letter/numeral glyphs inside identifiers stay literal; adjacent symbol glyphs still compile', () => {
  const src = 'Tλ ≔ 5\nνⅦ ≔ 2\n☉(Tλ + νⅦ)\n☉(f"{Tλ}")\na ≔ 1\nb ≔ 2\n☉(a∧b)\n';
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['7', '5', '2']);
});

τ('gpy CLI build/check/run works for factorial fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-'));
  const out = join(root, 'factorial.py');
  try {
    const src = join(repoRoot, 'examples/glyph-python/factorial.gpy');
    const build = spawnSync(process.execPath, [join(repoRoot, 'bin/gpy.mjs'), 'build', src, '-o', out], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.match(readFileSync(out, 'utf8'), /def φ/);

    const check = spawnSync(process.execPath, [join(repoRoot, 'bin/gpy.mjs'), 'check', src], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);

    const run = spawnSync(process.execPath, [join(repoRoot, 'bin/gpy.mjs'), 'run', src], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), '720');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy tests: 8 passed, 0 failed');
