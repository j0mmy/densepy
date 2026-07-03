import { readFileSync } from 'node:fs';

export function cmdVersion() {
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  process.stdout.write(`gpy ${pkg.version}\n`);
  return 0;
}
