import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { formatSource, densify } from '../compiler.mjs';
import { projectFiles } from './project.mjs';

export function cmdFmt(argv) {
  const checkOnly = argv.includes('--check');
  const denseMode = argv.includes('--dense');
  const format = denseMode ? densify : formatSource;
  const file = argv.find((x, i) => i > 0 && !x.startsWith('-'));
  if (!file) {
    let files;
    try {
      files = projectFiles();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    let changed = 0;
    for (const path of files) {
      const src = readFileSync(path, 'utf8');
      const formatted = format(src);
      if (formatted === src) continue;
      changed += 1;
      if (checkOnly) process.stderr.write(`fmt would change ${relative(process.cwd(), path)}\n`);
      else writeFileSync(path, formatted);
    }
    if (checkOnly && changed > 0) return 1;
    process.stdout.write(`fmt OK ${files.length} files\n`);
    return 0;
  }
  const src = readFileSync(file, 'utf8');
  const formatted = format(src);
  if (checkOnly) {
    if (formatted !== src) {
      process.stderr.write(`fmt would change ${file}\n`);
      return 1;
    }
    process.stdout.write(`fmt OK ${file}\n`);
    return 0;
  }
  if (formatted !== src) writeFileSync(file, formatted);
  process.stdout.write(`fmt OK ${file}\n`);
  return 0;
}
