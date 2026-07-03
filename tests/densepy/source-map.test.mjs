import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γcompileWithMap } from '../../src/densepy/compiler.mjs';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

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
  const root = mkdtempSync(join(tmpdir(), 'γpy-map-pyc-'));
  const path = join(root, 'out.py');
  try {
    writeFileSync(path, src);
    return spawnSync('python3', ['-m', 'py_compile', path], { encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

τ('γ compile emits source-map JSON with source/generated spans for aliases', () => {
  const src = `λ φ(ν):\n    ⎇ ν ≤ Ⅰ:\n        ⊢ ν\n☉(φ(Ⅰ))\n`;
  const out = γcompileWithMap(src, { sourcePath: 'demo.gpy', generatedPath: 'demo.py' });

  assert.equal(out.code, `def φ(ν):\n    if ν <= 1:\n        return ν\nprint(φ(1))\n`);
  assert.equal(out.map.version, 1);
  assert.equal(out.map.source, 'demo.gpy');
  assert.equal(out.map.generated, 'demo.py');
  assert.ok(Array.isArray(out.map.mappings));

  const op = out.map.mappings.find((m) => m.sourceText === '≤' && m.generatedText === '<=');
  assert.ok(op, '≤ mapping missing');
  assert.deepEqual(Object.keys(op).sort(), ['generated', 'generatedText', 'source', 'sourceText', 'type'].sort());
  assert.equal(op.source.line, 2);
  assert.equal(op.generated.line, 2);

  const ret = out.map.mappings.find((m) => m.sourceText === '⊢' && m.generatedText === 'return');
  assert.ok(ret, 'return mapping missing');
  assert.equal(pyCompile(out.code).status, 0, out.code);
});

τ('γ tokenizer protects comments, strings, triple strings, f-strings, and imports', () => {
  const src = `# λ ≤ Ⅰ comment stays\nimport json\nfrom pathlib import Path as Ρθ\nα ≔ "λ ≤ Ⅰ string stays"\nβ ≔ r'λ ≤ Ⅰ raw stays'\nχ ≔ f"λ ≤ Ⅰ fstring stays {1 + 1}"\nδ ≔ """λ ≤ Ⅰ triple stays"""\n☉(Ⅰ)\n`;
  const out = γcompileWithMap(src, { sourcePath: 'protect.gpy' });

  assert.match(out.code, /# λ ≤ Ⅰ comment stays/);
  assert.match(out.code, /import json/);
  assert.match(out.code, /from pathlib import Path as Ρθ/);
  assert.match(out.code, /"λ ≤ Ⅰ string stays"/);
  assert.match(out.code, /r'λ ≤ Ⅰ raw stays'/);
  assert.match(out.code, /f"λ ≤ Ⅰ fstring stays \{1 \+ 1\}"/);
  assert.match(out.code, /"""λ ≤ Ⅰ triple stays"""/);
  assert.match(out.code, /print\(1\)/);
  assert.equal(pyCompile(out.code).status, 0, out.code);
});

τ('Υ build --map writes emitted Python and map JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-map-cli-'));
  try {
    const src = join(root, 'demo.gpy');
    const py = join(root, 'demo.py');
    const map = join(root, 'demo.gpy.map.json');
    writeFileSync(src, '☉(Ⅰ)\n');

    const r = spawnSync(process.execPath, [Υ, 'build', src, '-o', py, '--map', map], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(readFileSync(py, 'utf8'), 'print(1)\n');
    const parsed = JSON.parse(readFileSync(map, 'utf8'));
    assert.equal(parsed.version, 1);
    assert.equal(parsed.source, src);
    assert.equal(parsed.generated, py);
    assert.ok(parsed.mappings.some((m) => m.sourceText === '☉' && m.generatedText === 'print'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy source-map tests: 3 passed, 0 failed');
