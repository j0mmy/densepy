import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function manifestPath() {
  return join(process.cwd(), 'gpy.toml');
}

export function readManifest() {
  const path = manifestPath();
  if (!existsSync(path)) throw new Error('gpy.toml not found; run: gpy init .');
  return readFileSync(path, 'utf8');
}

export function gpySection(toml) {
  const lines = String(toml).split('\n');
  const start = lines.findIndex((line) => line.trim() === '[gpy]');
  const get = (key, dflt) => {
    if (start === -1) return dflt;
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line.startsWith('[')) break;
      const m = line.match(/^([^=\s]+)\s*=\s*"([^"]*)"/);
      if (m && m[1] === key) return m[2];
    }
    return dflt;
  };
  return {
    source: get('source', 'src'),
    emit: get('emit', 'build/py'),
    main: get('main', null),
  };
}

export function listDependencies(toml) {
  const out = [];
  const lines = String(toml).split('\n');
  const dep = lines.findIndex((line) => line.trim() === '[dependencies]');
  if (dep === -1) return out;
  for (let i = dep + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('[')) break;
    const m = line.match(/^([^=\s]+)\s*=\s*"([^"]*)"/);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
}

export function upsertDependency(toml, name, version) {
  const lines = String(toml).split('\n');
  let dep = lines.findIndex((line) => line.trim() === '[dependencies]');
  if (dep === -1) {
    lines.push('', '[dependencies]');
    dep = lines.length - 1;
  }
  let end = lines.length;
  for (let i = dep + 1; i < lines.length; i += 1) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const entry = `${name} = "${version}"`;
  const existing = lines.findIndex((line, i) => i > dep && i < end && line.trim().startsWith(`${name} =`));
  if (existing >= 0) lines[existing] = entry;
  else lines.splice(end, 0, entry);
  return lines.join('\n').replace(/\n*$/u, '\n');
}
