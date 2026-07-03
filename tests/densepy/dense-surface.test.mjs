import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γcompile, γrun, γdense } from '../../src/densepy/compiler.mjs';

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

τ('dense fn: expression body and block form lower to def', () => {
  const src = 'fn f(n) = 1 if n <= 1 else n * f(n - 1)\nprint(f(6))\nfn g(x):\n    return x + 1\nprint(g(1))\n';
  const py = γcompile(src);
  assert.match(py, /def f\(n\): return 1 if n <= 1 else n \* f\(n - 1\)/);
  assert.match(py, /def g\(x\):/);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['720', '2']);
});

τ('dense aggregates: sum/sel/prod/any/all with guards, calls, subscripts', () => {
  const src = 'rows = [{"s": 5}, {"s": 12}, {"s": 8}]\ntotal = sum[r:rows] int(r["s"])\nhi = sel[r:rows|r["s"] >= 8] r["s"]\np = prod[x:[2, 3, 4]] x\nok = all[x:[1, 2]] x > 0\nnone_neg = any[x:[1, 2]] x < 0\nprint(total, hi, p, ok, none_neg)\n';
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '25 [12, 8] 24 True False');
});

τ('dense aggregates leave real subscripts and slices untouched', () => {
  const py = γcompile('q = sum[a:b]\ns = "sum[x:xs] stays in strings"\n# sum[x:xs] stays in comments\n');
  assert.match(py, /q = sum\[a:b\]/);
  assert.match(py, /"sum\[x:xs\] stays in strings"/);
  assert.match(py, /# sum\[x:xs\] stays in comments/);
});

τ('dense fn does not fire on fn-named variables or calls', () => {
  const py = γcompile('fn = 5\nprint(fn)\nresult = fn + 1\n');
  assert.match(py, /fn = 5/);
  assert.match(py, /result = fn \+ 1/);
});

τ('dense and glyph surfaces coexist in one file', () => {
  const src = 'Ω ≔ sum[χ:[Ⅰ, Ⅱ]] χ\n☉(Ω)\nfn h(ν) = ν × 2\n☉(h(4))\n';
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['3', '8']);
});

τ('dense aggregates inside compound-statement headers stop at the colon', () => {
  const src = 'xs=[1,2,3]\nif all[x:xs]x>0:print("all-pos")\nwhile sum[x:xs]x>100:break\nok="yes" if(any[x:xs]x==2)else"no"\nprint(ok)\n';
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['all-pos', 'yes']);
});

τ('γdense minimizes tokens while preserving semantics and staying idempotent', () => {
  const src = 'def grade(n):\n    if n >= 90:\n        return "A"\n    elif n >= 80:\n        return "B"\n    else:\n        return "C"\n\n\nfor x in [95, 85, 60]:\n    print(grade(x))\n';
  const dense = γdense(src);
  assert.equal(dense, 'def grade(n):\n if n>=90:return"A"\n elif n>=80:return"B"\n else:return"C"\nfor x in[95,85,60]:print(grade(x))\n');
  assert.equal(γdense(dense), dense);
  const a = γrun(src);
  const b = γrun(dense);
  assert.equal(b.status, 0, b.stderr + '\n' + dense);
  assert.equal(a.stdout, b.stdout);
});

τ('γdense protects strings, comments, and bracket-continuation lines', () => {
  const src = 'text = """keep  spaces\n\n    and indent"""\nx = 1  # keep comment\nys = [\n    1,\n    2,\n]\nprint(text[:4], x, ys)\n';
  const dense = γdense(src);
  assert.match(dense, /keep  spaces\n\n    and indent/);
  assert.match(dense, /# keep comment/);
  const a = γrun(src);
  const b = γrun(dense);
  assert.equal(b.status, 0, b.stderr + '\n' + dense);
  assert.equal(a.stdout, b.stdout);
});

τ('Υ fmt --dense densifies files and is idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-fmt-dense-'));
  try {
    const ρ = new URL('../..', import.meta.url).pathname;
    const file = join(root, 'app.gpy');
    writeFileSync(file, 'fn f(n) = n * 2\nif f(2) >= 4:\n    print("ok")\n');
    const r = spawnSync(process.execPath, [join(ρ, 'bin/gpy.mjs'), 'fmt', '--dense', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const once = readFileSync(file, 'utf8');
    assert.equal(once, 'fn f(n)=n*2\nif f(2)>=4:print("ok")\n');
    const again = spawnSync(process.execPath, [join(ρ, 'bin/gpy.mjs'), 'fmt', '--dense', file], { encoding: 'utf8' });
    assert.equal(again.status, 0, again.stderr + again.stdout);
    assert.equal(readFileSync(file, 'utf8'), once);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy dense surface tests: 9 passed, 0 failed');
