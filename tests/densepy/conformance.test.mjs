import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runSource } from '../../src/densepy/compiler.mjs';

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

function pyRun(src) {
  return spawnSync('python3', ['-c', src], { encoding: 'utf8' });
}

// Each case pairs a γ program with its plain-Python baseline.
// Conformance = identical stdout and exit status.
const CASES = [
  {
    name: 'recursion + comparison + arithmetic',
    gpy: 'λ φ(ν):\n    ⎇ ν ≤ 1:\n        ⊢ 1\n    ∴:\n        ⊢ ν × φ(ν − 1)\n☉(φ(6))\n',
    py: 'def f(n):\n    if n <= 1:\n        return 1\n    else:\n        return n * f(n - 1)\nprint(f(6))\n',
  },
  {
    name: 'while loop + assignment',
    gpy: 'ν ≔ 0\n↻ ν ≤ 4:\n    ☉(ν)\n    ν ≔ ν + 1\n',
    py: 'n = 0\nwhile n <= 4:\n    print(n)\n    n = n + 1\n',
  },
  {
    name: 'for-in loop + booleans + logic',
    gpy: '∀ χ ∈ [⊤, ⊥, ∅]:\n    ⎇ χ ∧ ⊤:\n        ☉("yes")\n    ∴:\n        ☉(¬χ ∨ ⊥)\n',
    py: 'for x in [True, False, None]:\n    if x and True:\n        print("yes")\n    else:\n        print(not x or False)\n',
  },
  {
    name: 'equality and inequality operators',
    gpy: '☉(3 ≅ 3)\n☉(3 ≠ 4)\n☉(6 ÷ 2)\n☉(5 ≥ 5)\n',
    py: 'print(3 == 3)\nprint(3 != 4)\nprint(6 / 2)\nprint(5 >= 5)\n',
  },
  {
    name: 'roman numeral literals',
    gpy: '☉(Ⅰ + Ⅱ + Ⅲ + Ⅹ)\n',
    py: 'print(1 + 2 + 3 + 10)\n',
  },
  {
    name: 'Σ and Π aggregate macros',
    gpy: 'ξ ≔ [1, 2, 3, 4]\n☉(Σ(χ∈ξ) χ × 2)\n☉(Π(χ∈ξ) χ)\n',
    py: 'xs = [1, 2, 3, 4]\nprint(sum((x * 2) for x in xs))\nimport math\nprint(math.prod((x) for x in xs))\n',
  },
  {
    name: 'π guarded projection macro',
    gpy: 'ξ ≔ [1, 2, 3, 4, 5]\n☉(π(χ∈ξ|χ ≥ 3) χ × 10)\n',
    py: 'xs = [1, 2, 3, 4, 5]\nprint([(x * 10) for x in xs if x >= 3])\n',
  },
  {
    name: '∴⎇ elif chains',
    gpy: 'λ grade(ν):\n    ⎇ ν ≥ 90:\n        ⊢ "A"\n    ∴ ⎇ ν ≥ 80:\n        ⊢ "B"\n    ∴:\n        ⊢ "C"\n∀ χ ∈ [95, 85, 60]:\n    ☉(grade(χ))\n',
    py: 'def grade(n):\n    if n >= 90:\n        return "A"\n    elif n >= 80:\n        return "B"\n    else:\n        return "C"\nfor x in [95, 85, 60]:\n    print(grade(x))\n',
  },
  {
    name: 'f-string expressions',
    gpy: 'ν ≔ 7\n☉(f"n={ν} double={ν × 2} pad={ν:>4}")\n',
    py: 'n = 7\nprint(f"n={n} double={n * 2} pad={n:>4}")\n',
  },
  {
    name: 'dense fn expression bodies',
    gpy: 'fn f(n) = 1 if n <= 1 else n * f(n - 1)\nprint(f(6))\n',
    py: 'def f(n):\n    if n <= 1:\n        return 1\n    return n * f(n - 1)\nprint(f(6))\n',
  },
  {
    name: 'dense aggregates',
    gpy: 'xs = [1, 2, 3, 4, 5]\nprint(sum[x:xs|x%2==0] x*x, prod[x:xs] x, sel[x:xs|x>3] x)\n',
    py: 'import math\nxs = [1, 2, 3, 4, 5]\nprint(sum((x*x) for x in xs if x%2==0), math.prod(x for x in xs), [x for x in xs if x>3])\n',
  },
  {
    name: 'strings and comments stay literal',
    gpy: '# ≔ in comment\n☉("glyphs λ ≔ × stay")\n',
    py: '# = in comment\nprint("glyphs λ ≔ × stay")\n',
  },
];

for (const c of CASES) {
  τ(`conformance: ${c.name}`, () => {
    const γ = runSource(c.gpy);
    const λ = pyRun(c.py);
    assert.equal(λ.status, 0, `python baseline failed: ${λ.stderr}`);
    assert.equal(γ.status, λ.status, γ.stderr);
    assert.equal(γ.stdout, λ.stdout);
  });
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`\nγpy conformance tests: ${CASES.length} passed, 0 failed`);
