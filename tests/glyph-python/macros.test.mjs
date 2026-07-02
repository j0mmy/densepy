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

τ('Σ and Π macros lower to Python aggregate expressions and execute', () => {
  const src = `xs ≔ [1,2,3,4]\n☉(Σ(ν∈xs) ν×ν)\n☉(Π(ν∈xs) ν)\n`;
  const py = γcompile(src);
  assert.match(py, /sum\(\(ν \* ν\) for ν in xs\)/);
  assert.match(py, /math\.prod\(\(ν\) for ν in xs\)/);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['30', '24']);
});

τ('π guarded projection macro lowers to Python list comprehension and executes', () => {
  const src = `xs ≔ [1,2,3,4,5,6]\nys ≔ π(ν∈xs|ν % 2 ≅ 0) ν×ν\n☉(ys)\n`;
  const py = γcompile(src);
  assert.match(py, /\[\(ν \* ν\) for ν in xs if ν % 2 == 0\]/);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '[4, 16, 36]');
});

τ('∘ composition macro lowers to nested calls and executes', () => {
  const src = `λ f(x):\n    ⊢ x + 1\nλ g(x):\n    ⊢ x × 2\n☉((f∘g)(3))\n`;
  const py = γcompile(src);
  assert.match(py, /print\(f\(g\(3\)\)\)/);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '7');
});

τ('macro glyphs inside comments and strings are preserved', () => {
  const src = `# Σ(ν∈xs) ν stays\ns ≔ "π(ν∈xs|⊤) ν and (f∘g)(x) stay"\n☉(s)\n`;
  const py = γcompile(src);
  assert.match(py, /# Σ\(ν∈xs\) ν stays/);
  assert.match(py, /"π\(ν∈xs\|⊤\) ν and \(f∘g\)\(x\) stay"/);
  const r = γrun(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'π(ν∈xs|⊤) ν and (f∘g)(x) stay');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy macro tests: 4 passed, 0 failed');
