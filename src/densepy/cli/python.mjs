import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export function venvDir() {
  return join(process.cwd(), '.venv');
}

export function venvPython() {
  const python = join(venvDir(), 'bin', 'python');
  return existsSync(python) ? python : null;
}

// Project venv wins over system python3 whenever it exists.
export function resolvePython() {
  return venvPython() ?? 'python3';
}

export function ensureVenv() {
  const existing = venvPython();
  if (existing) return existing;
  const uv = spawnSync('uv', ['--version'], { encoding: 'utf8' });
  const r = uv.status === 0
    ? spawnSync('uv', ['venv', venvDir()], { encoding: 'utf8' })
    : spawnSync('python3', ['-m', 'venv', venvDir()], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) throw new Error(`venv creation failed: ${r.stderr || r.stdout}`);
  const created = venvPython();
  if (!created) throw new Error(`venv created but python missing at ${join(venvDir(), 'bin', 'python')}`);
  return created;
}
