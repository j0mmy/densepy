import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, cpSync } from 'node:fs';
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

function μproject(root) {
  writeFileSync(join(root, 'gpy.toml'), '[project]\nname = "multi"\npython = ">=3.11"\n\n[dependencies]\n\n[gpy]\nsource = "src"\nemit = "build/py"\nmain = "src/main.gpy"\n');
  mkdirSync(join(root, 'src', 'lib'), { recursive: true });
  writeFileSync(join(root, 'src', 'helper.gpy'), 'λ χdouble(ν):\n    ⊢ ν × 2\n');
  writeFileSync(join(root, 'src', 'lib', 'greet.gpy'), 'λ γgreet(name):\n    ⊢ f"hi {name}"\n');
  writeFileSync(join(root, 'src', 'main.gpy'), 'import sys\nfrom helper import χdouble\nfrom lib.greet import γgreet\n☉(χdouble(21))\n☉(γgreet("γ"))\n☉("|".join(sys.argv[1:]))\n');
}

τ('Υ build with no file compiles the whole project tree to the emit dir', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-build-proj-'));
  try {
    μproject(root);
    const r = ψ(['build'], { cwd: root });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /built 3 files/);
    assert.ok(existsSync(join(root, 'build/py/main.py')));
    assert.ok(existsSync(join(root, 'build/py/helper.py')));
    assert.ok(existsSync(join(root, 'build/py/lib/greet.py')));
    assert.match(readFileSync(join(root, 'build/py/helper.py'), 'utf8'), /def χdouble/);
    const pyc = spawnSync('python3', ['-m', 'py_compile', join(root, 'build/py/main.py'), join(root, 'build/py/helper.py'), join(root, 'build/py/lib/greet.py')], { encoding: 'utf8' });
    assert.equal(pyc.status, 0, pyc.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run with no file builds then runs the gpy.toml entrypoint with cross-module imports and argv', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-run-proj-'));
  try {
    μproject(root);
    const r = ψ(['run', '--', 'α', 'β'], { cwd: root });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(r.stdout.trim().split('\n'), ['42', 'hi γ', 'α|β']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run without gpy.toml and without file fails with a clear message', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-run-nomanifest-'));
  try {
    const r = ψ(['run'], { cwd: root });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /gpy\.toml not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run remaps every project frame of a runtime traceback to .gpy sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-run-remap-'));
  try {
    writeFileSync(join(root, 'gpy.toml'), '[project]\nname = "remap"\n\n[gpy]\nsource = "src"\nemit = "build/py"\nmain = "src/main.gpy"\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'helper.gpy'), 'λ χboom(ν):\n    ⊢ ν ÷ 0\n');
    writeFileSync(join(root, 'src', 'main.gpy'), 'from helper import χboom\n☉(χboom(1))\n');
    const r = ψ(['run'], { cwd: root });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ZeroDivisionError/);
    assert.match(r.stderr, /src\/main\.gpy:2/);
    assert.match(r.stderr, /χboom\(1\)/);
    assert.match(r.stderr, /src\/helper\.gpy:2/);
    assert.match(r.stderr, /ν ÷ 0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('webapp example project serves a real HTTP request end to end', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-webapp-'));
  try {
    cpSync(join(ρ, 'examples/densepy/webapp'), root, { recursive: true });
    const r = ψ(['run'], { cwd: root });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(r.stdout.trim(), 'GLY backend ready');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy project build tests: 5 passed, 0 failed');
