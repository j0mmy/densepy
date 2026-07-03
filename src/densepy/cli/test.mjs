import { readFileSync } from 'node:fs';
import { runSource } from '../compiler.mjs';
import { findGpyFiles } from './project.mjs';

export function cmdTest(argv) {
  const dir = argv[1] ?? 'tests';
  const files = findGpyFiles(dir);
  let pass = 0;
  let fail = 0;
  for (const file of files) {
    const result = runSource(readFileSync(file, 'utf8'), { fileBacked: true });
    if ((result.status ?? 1) === 0) pass++;
    else {
      fail++;
      process.stderr.write(`FAIL ${file}\n${result.stderr || result.stdout || ''}`);
    }
  }
  process.stdout.write(`γtest: ${pass} passed, ${fail} failed\n`);
  return fail === 0 ? 0 : 1;
}
