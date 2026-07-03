import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { lintSource } from '../compiler.mjs';
import { positionalFile } from './args.mjs';
import { projectFiles } from './project.mjs';

export function cmdLint(argv) {
  const agent = argv.includes('--agent');
  const emit = (warnings) => {
    const prefix = agent ? 'warn ' : '';
    process.stderr.write(warnings.map((w) => `${prefix}${w}`).join('\n') + '\n');
  };
  const file = positionalFile(argv);
  if (!file) {
    let files;
    try {
      files = projectFiles();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    const warnings = files.flatMap((path) =>
      lintSource(readFileSync(path, 'utf8'), { path: relative(process.cwd(), path) }));
    if (warnings.length) {
      emit(warnings);
      return 1;
    }
    process.stdout.write(agent ? `ok ${files.length} files\n` : `lint OK ${files.length} files\n`);
    return 0;
  }
  const warnings = lintSource(readFileSync(file, 'utf8'), { path: file });
  if (warnings.length) {
    emit(warnings);
    return 1;
  }
  process.stdout.write(agent ? `ok ${file}\n` : `lint OK ${file}\n`);
  return 0;
}
