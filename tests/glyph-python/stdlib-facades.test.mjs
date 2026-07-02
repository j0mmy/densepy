import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γcompile, γrun } from '../../src/glyph-python/γpy.mjs';

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
  const root = mkdtempSync(join(tmpdir(), 'γpy-std-pyc-'));
  const path = join(root, 'out.py');
  try {
    writeFileSync(path, src);
    return spawnSync('python3', ['-m', 'py_compile', path], { encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

τ('File JSON and Path facades execute over stdlib only', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-std-json-'));
  try {
    const src = `Δ ≔ {"name":"JT","score":10}\nJSON.write("data.json", Δ)\nΩ ≔ JSON.read("data.json")\nΡ ≔ Path.join(".", "name.txt")\nFile.write(Ρ, Ω["name"])\n☉(File.read(Ρ))\n☉(JSON.dumps({"ok":⊤}))\n`;
    const py = γcompile(src);
    assert.match(py, /class JSON/);
    assert.match(py, /class File/);
    assert.match(py, /class Path/);
    assert.equal(pyCompile(py).status, 0, py);
    const r = γrun(src, { cwd: root });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split('\n'), ['JT', '{"ok": true}']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('CSV and HTTP facades execute without external dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-std-csv-'));
  try {
    const src = `rows ≔ [{"name":"a","score":1},{"name":"b","score":2}]\nCSV.write("rows.csv", rows, ["name", "score"])\nout ≔ CSV.read("rows.csv")\n☉(out[1]["name"] + ":" + out[1]["score"])\n☉(HTTP.get_text("data:text/plain,hello").strip())\n`;
    const py = γcompile(src);
    assert.match(py, /class CSV/);
    assert.match(py, /class HTTP/);
    assert.equal(pyCompile(py).status, 0, py);
    const r = γrun(src, { cwd: root });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split('\n'), ['b:2', 'hello']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Table facade uses Πδ alias and reports a clear pandas install boundary', () => {
  const src = `try:\n    Πδ.require()\n    ☉("table-ok")\nexcept ImportError as ε:\n    ☉(str(ε))\n`;
  const py = γcompile(src);
  assert.match(py, /Πδ = Table/);
  assert.equal(pyCompile(py).status, 0, py);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /^(table-ok|GlyphPython Table facade requires pandas: pip install pandas)$/);
});

τ('foreign Python imports remain usable beside γ facades', () => {
  const src = `import json as ξjson\n☉(ξjson.dumps({"edge": 1}))\n☉(JSON.dumps({"facade": 2}))\n`;
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['{"edge": 1}', '{"facade": 2}']);
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy stdlib facade tests: 4 passed, 0 failed');
