import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { manifestPath, readManifest, listDependencies, upsertDependency } from './manifest.mjs';
import { resolvePython, ensureVenv } from './python.mjs';
import { badUsage } from './usage.mjs';

function pipSpecs(deps) {
  return deps.map(([name, version]) => (version && version !== '*' ? `${name}${version}` : name));
}

function pipInstall(specs) {
  if (!specs.length) return 0;
  const custom = process.env.GPY_INSTALLER;
  const r = custom
    ? spawnSync(custom, ['install', ...specs], { encoding: 'utf8' })
    : spawnSync(ensureVenv(), ['-m', 'pip', 'install', ...specs], { encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

export function cmdDeps(argv) {
  const sub = argv[1];
  if (sub === 'add') {
    const name = argv[2];
    if (!name || name.startsWith('-')) return badUsage();
    const version = argv[3] && !argv[3].startsWith('-') ? argv[3] : '*';
    const next = upsertDependency(readManifest(), name, version);
    writeFileSync(manifestPath(), next);
    process.stdout.write(`added ${name} ${version}\n`);
    if (argv.includes('--no-install')) return 0;
    return pipInstall(pipSpecs([[name, version]]));
  }
  if (sub === 'install') {
    const specs = pipSpecs(listDependencies(readManifest()));
    if (!process.env.GPY_INSTALLER) ensureVenv();
    const status = pipInstall(specs);
    if (status === 0) process.stdout.write(`installed ${specs.length} dependencies into .venv\n`);
    return status;
  }
  if (sub === 'list') {
    for (const [name, version] of listDependencies(readManifest())) process.stdout.write(`${name} ${version}\n`);
    return 0;
  }
  if (sub === 'check') {
    const name = argv[2];
    if (!name) return badUsage();
    const code = `import importlib.util, sys\nsys.exit(0 if importlib.util.find_spec(${JSON.stringify(name)}) else 1)`;
    const r = spawnSync(resolvePython(), ['-c', code], { encoding: 'utf8' });
    if ((r.status ?? 1) === 0) {
      process.stdout.write(`dependency OK: ${name}\n`);
      return 0;
    }
    process.stderr.write(`missing dependency: ${name}\ninstall: pip install ${name}\n`);
    return 1;
  }
  return badUsage();
}
