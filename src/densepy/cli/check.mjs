import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileWithSourceMap, checkSource } from '../compiler.mjs';
import { positionalFile } from './args.mjs';
import { remapNote, agentErrorLine } from './diagnostics.mjs';
import { resolvePython } from './python.mjs';
import { badUsage } from './usage.mjs';

function printEmittedPython(py) {
  process.stdout.write(`--- emitted python ---\n${py}${py.endsWith('\n') ? '' : '\n'}--- end emitted python ---\n`);
}

function typecheck(file, compiled) {
  const root = mkdtempSync(join(tmpdir(), 'γpy-types-'));
  const tmp = join(root, basename(file).replace(/\.gpy$/, '.py'));
  try {
    writeFileSync(tmp, compiled.code);
    const custom = process.env.GPY_TYPECHECKER;
    let r;
    if (custom) {
      r = spawnSync(custom, [tmp], { encoding: 'utf8' });
    } else if (spawnSync('pyright', ['--version'], { encoding: 'utf8' }).status === 0) {
      r = spawnSync('pyright', [tmp], { encoding: 'utf8' });
    } else if (spawnSync(resolvePython(), ['-m', 'mypy', '--version'], { encoding: 'utf8' }).status === 0) {
      r = spawnSync(resolvePython(), ['-m', 'mypy', tmp], { encoding: 'utf8' });
    } else {
      process.stderr.write('no type checker found: install pyright (npm i -g pyright) or mypy (gpy deps add mypy)\n');
      return 1;
    }
    const esc = tmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const remapped = String((r.stdout ?? '') + (r.stderr ?? ''))
      .replace(new RegExp(`${esc}:(\\d+)`, 'g'), (m, n) => `${file}:${Math.max(1, Number(n) - compiled.lineOffset)}`)
      .replaceAll(tmp, file);
    if (remapped.trim()) process.stdout.write(remapped.endsWith('\n') ? remapped : `${remapped}\n`);
    if ((r.status ?? 1) === 0) process.stdout.write(`types OK ${file}\n`);
    return r.status ?? 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function cmdCheck(argv) {
  const file = positionalFile(argv);
  if (!file) return badUsage();
  const src = readFileSync(file, 'utf8');
  const agent = argv.includes('--agent');
  const result = compileWithSourceMap(src, { sourcePath: file });
  if (argv.includes('--show-py')) printEmittedPython(result.code);
  const check = checkSource(src);
  if ((check.status ?? 1) !== 0) {
    if (agent) {
      process.stderr.write(agentErrorLine(file, src, check.stderr, result.lineOffset));
      return check.status ?? 1;
    }
    if (check.stdout) process.stdout.write(check.stdout);
    if (check.stderr) process.stderr.write(check.stderr + remapNote('syntax', file, src, check.stderr, result.lineOffset));
    return check.status ?? 1;
  }
  if (argv.includes('--types')) return typecheck(file, result);
  process.stdout.write(agent ? `ok ${file}\n` : `check OK ${file}\n`);
  return 0;
}
