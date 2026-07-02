import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
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

τ('Υ init creates gpy.toml and a runnable src/main.gpy project', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-init-'));
  try {
    const r = ψ(['init', root, '--name', 'ops-tool']);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const toml = readFileSync(join(root, 'gpy.toml'), 'utf8');
    assert.match(toml, /\[project\]/);
    assert.match(toml, /name = "ops-tool"/);
    assert.match(toml, /\[gpy\]/);
    assert.match(toml, /source = "src"/);
    assert.match(toml, /emit = "build\/py"/);

    const run = ψ(['run', join(root, 'src/main.gpy')], { cwd: root });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.equal(run.stdout.trim(), 'ops-tool ready');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ deps add/list updates gpy.toml dependencies without corrupting host names', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-deps-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'deps-tool']).status, 0);
    const add = ψ(['deps', 'add', 'rich', '>=13', '--no-install'], { cwd: root });
    assert.equal(add.status, 0, add.stderr + add.stdout);
    const toml = readFileSync(join(root, 'gpy.toml'), 'utf8');
    assert.match(toml, /\[dependencies\]/);
    assert.match(toml, /rich = ">=13"/);

    const list = ψ(['deps', 'list'], { cwd: root });
    assert.equal(list.status, 0, list.stderr + list.stdout);
    assert.match(list.stdout, /rich\s+>=13/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ deps check reports missing package with an install command', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-missing-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'missing-tool']).status, 0);
    const r = ψ(['deps', 'check', 'definitely_missing_gpy_dep_zz'], { cwd: root });
    assert.notEqual(r.status, 0);
    const text = r.stderr + r.stdout;
    assert.match(text, /missing dependency: definitely_missing_gpy_dep_zz/);
    assert.match(text, /(uv pip install|pip install) definitely_missing_gpy_dep_zz/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ deps install creates .venv and gpy run prefers the venv python', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-venv-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'venv-tool']).status, 0);
    const install = ψ(['deps', 'install'], { cwd: root });
    assert.equal(install.status, 0, install.stderr + install.stdout);
    assert.match(install.stdout, /\.venv/);

    writeFileSync(join(root, 'src', 'main.gpy'), 'import sys\n☉(".venv" ∈ sys.executable)\n');
    const run = ψ(['run'], { cwd: root });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.equal(run.stdout.trim(), 'True');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ deps add invokes the installer with a pip-style spec', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-installer-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'installer-tool']).status, 0);
    const stub = join(root, 'installer.sh');
    writeFileSync(stub, '#!/bin/sh\necho "$@" >> install.log\n');
    chmodSync(stub, 0o755);
    const add = ψ(['deps', 'add', 'rich', '>=13'], { cwd: root, env: { GPY_INSTALLER: stub } });
    assert.equal(add.status, 0, add.stderr + add.stdout);
    assert.match(readFileSync(join(root, 'gpy.toml'), 'utf8'), /rich = ">=13"/);
    assert.equal(readFileSync(join(root, 'install.log'), 'utf8').trim(), 'install rich>=13');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

τ('Υ deps install installs every manifest dependency via the installer', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-proj-install-all-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'install-all']).status, 0);
    assert.equal(ψ(['deps', 'add', 'rich', '>=13', '--no-install'], { cwd: root }).status, 0);
    assert.equal(ψ(['deps', 'add', 'httpx', '*', '--no-install'], { cwd: root }).status, 0);
    const stub = join(root, 'installer.sh');
    writeFileSync(stub, '#!/bin/sh\necho "$@" >> install.log\n');
    chmodSync(stub, 0o755);
    const install = ψ(['deps', 'install'], { cwd: root, env: { GPY_INSTALLER: stub } });
    assert.equal(install.status, 0, install.stderr + install.stdout);
    assert.equal(readFileSync(join(root, 'install.log'), 'utf8').trim(), 'install rich>=13 httpx');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy project workflow tests: 6 passed, 0 failed');
