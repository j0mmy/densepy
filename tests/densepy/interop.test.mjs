// Host-interop: real PyPI package installed via gpy deps into a project
// venv, imported and used from .gpy. Network-dependent — run via
// `npm run interop`, not the offline test chain.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');
const ψ = (args, cwd) => spawnSync(process.execPath, [Υ, ...args], { cwd, encoding: 'utf8' });

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

τ('real PyPI dependency installs into project venv and works from .gpy', () => {
  const root = mkdtempSync(join(tmpdir(), 'γpy-interop-'));
  try {
    assert.equal(ψ(['init', root, '--name', 'interop'], ρ).status, 0);
    const add = ψ(['deps', 'add', 'six'], root);
    assert.equal(add.status, 0, add.stderr + add.stdout);
    writeFileSync(join(root, 'src', 'main.gpy'), 'import six\nfn kind(x)=("str"if isinstance(x,six.string_types)else"other")\nprint(six.__version__>="1.0", kind("a"), kind(1))\n');
    const run = ψ(['run'], root);
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.equal(run.stdout.trim(), 'True str other');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy interop tests: 1 passed, 0 failed');
