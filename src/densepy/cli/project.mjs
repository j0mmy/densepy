import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { γcompileWithMap } from '../compiler.mjs';
import { gpySection, readManifest } from './manifest.mjs';

export function findGpyFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) findGpyFiles(path, out);
    else if (name.endsWith('.gpy')) out.push(path);
  }
  return out.sort();
}

export function projectFiles() {
  const cfg = gpySection(readManifest());
  return findGpyFiles(join(process.cwd(), cfg.source));
}

export function buildProject() {
  const cfg = gpySection(readManifest());
  const sourceDir = join(process.cwd(), cfg.source);
  const emitDir = join(process.cwd(), cfg.emit);
  const files = findGpyFiles(sourceDir);
  const modules = [];
  for (const file of files) {
    const rel = relative(sourceDir, file);
    const outPath = join(emitDir, rel.replace(/\.gpy$/, '.py'));
    mkdirSync(dirname(outPath), { recursive: true });
    const src = readFileSync(file, 'utf8');
    const compiled = γcompileWithMap(src, { sourcePath: file, generatedPath: outPath });
    writeFileSync(outPath, compiled.code);
    modules.push({ gpy: file, py: outPath, source: src, lineOffset: compiled.lineOffset });
  }
  return { cfg, modules };
}

export function remapProjectTraceback(built, stderr) {
  const notes = [];
  const re = /File "([^"]+\.py)", line (\d+)/g;
  let m;
  while ((m = re.exec(String(stderr ?? '')))) {
    const mod = built.modules.find((x) => x.py === m[1]);
    if (!mod) continue;
    const line = Number(m[2]) - mod.lineOffset;
    if (line < 1) continue;
    const excerpt = String(mod.source).split('\n')[line - 1] ?? '';
    notes.push(`γ traceback: ${relative(process.cwd(), mod.gpy)}:${line}\n  ${excerpt}`);
  }
  return notes.length ? `\n${notes.join('\n')}\n` : '';
}

export function projectEntry(built) {
  const main = built.cfg.main ?? join(built.cfg.source, 'main.gpy');
  const rel = relative(built.cfg.source, main).replace(/\.gpy$/, '.py');
  return join(process.cwd(), built.cfg.emit, rel);
}
