import { readFileSync, watch } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { γcompileWithMap, γcheck } from '../compiler.mjs';
import { positionalFile } from './args.mjs';
import { remapNote } from './diagnostics.mjs';
import { gpySection, readManifest } from './manifest.mjs';
import { findGpyFiles } from './project.mjs';
import { resolvePython } from './python.mjs';

// Returns null: the watcher keeps the process alive.
export function cmdWatch(argv) {
  const file = positionalFile(argv);
  let targetDir;
  let files;
  if (file) {
    targetDir = dirname(file);
    files = () => [file];
  } else {
    const cfg = gpySection(readManifest());
    targetDir = join(process.cwd(), cfg.source);
    files = () => findGpyFiles(targetDir);
  }

  const checkOnce = () => {
    let failed = 0;
    const list = files();
    for (const path of list) {
      const src = readFileSync(path, 'utf8');
      const { lineOffset } = γcompileWithMap(src);
      const check = γcheck(src, { python: resolvePython() });
      if ((check.status ?? 1) !== 0) {
        failed += 1;
        const rel = relative(process.cwd(), path);
        process.stderr.write(check.stderr + remapNote('syntax', rel, src, check.stderr, lineOffset));
      }
    }
    if (failed === 0) process.stdout.write(`watch: ${list.length} files OK\n`);
    else process.stdout.write(`watch: ${failed} of ${list.length} files failed\n`);
  };

  checkOnce();
  let timer = null;
  watch(targetDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(checkOnce, 100);
  });
  return null;
}
