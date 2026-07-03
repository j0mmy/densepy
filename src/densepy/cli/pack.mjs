import { readFileSync } from 'node:fs';
import { relative, join } from 'node:path';
import { readManifest, gpySection } from './manifest.mjs';
import { findGpyFiles } from './project.mjs';

// Emit the project (or the given files) as one agent-ready context blob:
// the whole point of a dense language is cheap context loads, so loading
// context is a first-class command. Blob on stdout; accounting on stderr
// so an agent can pipe stdout straight into its context.
export function cmdPack(argv) {
  const files = argv.slice(1).filter((a) => !a.startsWith('-'));
  let paths;
  try {
    paths = files.length
      ? files
      : findGpyFiles(join(process.cwd(), gpySection(readManifest()).source));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  let out = '';
  if (argv.includes('--packet')) {
    out += readFileSync(new URL('../../../docs/AGENT_PACKET.md', import.meta.url), 'utf8');
    out += '\n';
  }
  for (const path of paths) {
    const rel = relative(process.cwd(), path);
    out += `=== FILE: ${rel} ===\n${readFileSync(path, 'utf8')}\n`;
  }
  process.stdout.write(out);
  const tokens = Math.round(out.length / 3.5);
  process.stderr.write(`pack: ${paths.length} files, ${out.length} chars, ~${tokens} tokens (o200k approx)\n`);
  return 0;
}
