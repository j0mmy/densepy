import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { γcompileWithMap, γrun } from '../compiler.mjs';
import { positionalFile, argvAfterDash } from './args.mjs';
import { remapNote, agentErrorLine } from './diagnostics.mjs';
import { buildProject, remapProjectTraceback, projectEntry } from './project.mjs';
import { resolvePython } from './python.mjs';

export function cmdRun(argv) {
  const file = positionalFile(argv);
  if (!file) {
    let built;
    try {
      built = buildProject();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    const entry = projectEntry(built);
    if (!existsSync(entry)) {
      process.stderr.write(`entrypoint not found after build: ${entry}\n`);
      return 1;
    }
    const result = spawnSync(resolvePython(), [entry, ...argvAfterDash(argv)], {
      encoding: 'utf8',
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) {
      const remap = (result.status ?? 1) === 0 ? '' : remapProjectTraceback(built, result.stderr);
      process.stderr.write(result.stderr + remap);
    }
    return result.status ?? 1;
  }
  const src = readFileSync(file, 'utf8');
  const agent = argv.includes('--agent');
  const { lineOffset } = γcompileWithMap(src);
  const result = γrun(src, { argv: argvAfterDash(argv), fileBacked: true, python: resolvePython() });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) {
    if (agent && (result.status ?? 1) !== 0) {
      process.stderr.write(agentErrorLine(file, src, result.stderr, lineOffset));
    } else {
      const remap = (result.status ?? 1) === 0 ? '' : remapNote('traceback', file, src, result.stderr, lineOffset);
      process.stderr.write(result.stderr + remap);
    }
  }
  return result.status ?? 1;
}
