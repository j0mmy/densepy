import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

function ψ(args, opts = {}) {
  return spawnSync(process.execPath, [Υ, ...args], {
    cwd: opts.cwd ?? ρ,
    env: { ...process.env, ...(opts.env ?? {}) },
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

τ('Υ run preserves argv, cwd, and env through Python runtime', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-run-'));
  try {
    writeFileSync(join(root, 'main.gpy'), `import os\nimport sys\n☉(os.getcwd().endswith("γpy-cli-run-" + os.getcwd().split("γpy-cli-run-")[-1]))\n☉(os.environ["ΓPY_ENV"])\n☉("|".join(sys.argv[1:]))\n`);
    const r = ψ(['run', 'main.gpy', '--', 'α', 'β'], { cwd: root, env: { ΓPY_ENV: 'Ω' } });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split('\n'), ['True', 'Ω', 'α|β']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ build/check emit valid Python and stable success text', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-build-'));
  try {
    const src = join(root, 'factorial.gpy');
    const out = join(root, 'factorial.py');
    writeFileSync(src, readFileSync(join(ρ, 'examples/densepy/factorial.gpy'), 'utf8'));

    const build = ψ(['build', src, '-o', out]);
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.match(readFileSync(out, 'utf8'), /def φ/);

    const check = ψ(['check', src]);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /check OK/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ test discovers .gpy tests recursively and reports pass count', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-test-'));
  try {
    mkdirSync(join(root, 'tests', 'unit'), { recursive: true });
    writeFileSync(join(root, 'tests', 'ok.gpy'), 'assert Ⅰ ≅ 1\n');
    writeFileSync(join(root, 'tests', 'unit', 'also_ok.gpy'), 'assert ⊤\n');
    const r = ψ(['test', 'tests'], { cwd: root });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /γtest: 2 passed, 0 failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ fmt --check is idempotent and rejects changed output in check mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-fmt-'));
  try {
    const stable = join(root, 'stable.gpy');
    const messy = join(root, 'messy.gpy');
    writeFileSync(stable, '☉(Ⅰ)\n');
    writeFileSync(messy, '☉(Ⅰ)   \n\n\n');

    const ok = ψ(['fmt', '--check', stable]);
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    assert.match(ok.stdout, /fmt OK/);

    const bad = ψ(['fmt', '--check', messy]);
    assert.notEqual(bad.status, 0, 'messy file should fail --check');
    assert.match(bad.stderr + bad.stdout, /would change/);

    const fix = ψ(['fmt', messy]);
    assert.equal(fix.status, 0, fix.stderr || fix.stdout);
    assert.equal(readFileSync(messy, 'utf8'), '☉(Ⅰ)\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ check --types runs the configured type checker and remaps lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-types-'));
  try {
    const file = join(root, 'typed.gpy');
    writeFileSync(file, 'Ω ≔ Π(χ∈[1, 2]) χ\n☉(Ω)\n');
    const stub = join(root, 'typecheck.sh');
    writeFileSync(stub, '#!/bin/sh\necho "$1:3: error: fake-type-error"\nexit 1\n');
    chmodSync(stub, 0o755);
    const r = ψ(['check', '--types', file], { env: { GPY_TYPECHECKER: stub } });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /typed\.gpy:2: error: fake-type-error/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ run forwards stdin to the program', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-stdin-'));
  try {
    const file = join(root, 'echoer.gpy');
    writeFileSync(file, 'import sys\nprint(sys.stdin.read().upper().strip())\n');
    const r = spawnSync(process.execPath, [Υ, 'run', file], {
      input: 'hello γ',
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'HELLO Γ');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ --version prints the package version', () => {
  const expected = JSON.parse(readFileSync(join(ρ, 'package.json'), 'utf8')).version;
  const r = ψ(['--version']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(r.stdout.trim(), `gpy ${expected}`);
});

τ('Υ test runs .gpy tests with the project venv python when present', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-testvenv-'));
  try {
    mkdirSync(join(root, '.venv', 'bin'), { recursive: true });
    const shim = join(root, '.venv', 'bin', 'python');
    writeFileSync(shim, `#!/bin/sh\ntouch "${join(root, 'venv-used')}"\nexec python3 "$@"\n`);
    chmodSync(shim, 0o755);
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'tests', 'ok.gpy'), 'assert ⊤\n');
    const r = ψ(['test', 'tests'], { cwd: root });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(existsSync(join(root, 'venv-used')), 'venv python shim was not used');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ pack emits an agent-ready project blob with token accounting', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-cli-pack-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'packer']).status, 0);
    writeFileSync(join(root, 'src', 'util.gpy'), 'fn double(x)=x*2\n');
    const r = ψ(['pack'], { cwd: root });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /=== FILE: src\/main\.gpy ===/);
    assert.match(r.stdout, /=== FILE: src\/util\.gpy ===/);
    assert.match(r.stdout, /fn double\(x\)=x\*2/);
    assert.match(r.stderr, /pack: 2 files, \d+ chars, ~\d+ tokens/);

    const withPacket = ψ(['pack', '--packet'], { cwd: root });
    assert.equal(withPacket.status, 0, withPacket.stderr + withPacket.stdout);
    assert.match(withPacket.stdout, /# DensePy agent packet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy CLI tests: 9 passed, 0 failed');
