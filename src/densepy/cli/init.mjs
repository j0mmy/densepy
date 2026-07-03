import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { flagValue } from './args.mjs';

export function cmdInit(argv) {
  const root = argv.find((x, i) => i > 0 && !x.startsWith('-') && argv[i - 1] !== '--name') ?? '.';
  const name = flagValue('--name', argv) ?? basename(root === '.' ? process.cwd() : root);
  mkdirSync(join(root, 'src'), { recursive: true });
  const toml = `[project]\nname = "${name}"\npython = ">=3.11"\n\n[dependencies]\n\n[gpy]\nsource = "src"\nemit = "build/py"\nmain = "src/main.gpy"\n`;
  const manifest = join(root, 'gpy.toml');
  if (!existsSync(manifest)) writeFileSync(manifest, toml);
  const main = join(root, 'src/main.gpy');
  if (!existsSync(main)) writeFileSync(main, `☉("${name} ready")\n`);
  process.stdout.write(`created ${manifest}\n`);
  return 0;
}
