import { readFileSync, writeFileSync } from 'node:fs';
import { γcompile, γcompileWithMap } from '../compiler.mjs';
import { flagValue, positionalFile } from './args.mjs';
import { buildProject } from './project.mjs';

export function cmdBuild(argv) {
  const file = positionalFile(argv);
  if (!file) {
    try {
      const built = buildProject();
      process.stdout.write(`built ${built.modules.length} files -> ${built.cfg.emit}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
  }
  const outPath = flagValue('-o', argv) ?? flagValue('--out', argv);
  const mapPath = flagValue('--map', argv);
  const src = readFileSync(file, 'utf8');
  if (mapPath) {
    const result = γcompileWithMap(src, { sourcePath: file, generatedPath: outPath ?? null });
    if (outPath) writeFileSync(outPath, result.code);
    else process.stdout.write(result.code);
    writeFileSync(mapPath, JSON.stringify(result.map, null, 2) + '\n');
    return 0;
  }
  const py = γcompile(src);
  if (outPath) writeFileSync(outPath, py);
  else process.stdout.write(py);
  return 0;
}
