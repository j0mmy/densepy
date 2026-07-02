import assert from 'node:assert/strict';
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

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy dense surface tests: 5 passed, 0 failed');
