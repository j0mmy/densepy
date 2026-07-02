#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { γcompile, γcompileWithMap, γrun, γcheck, γformat, γlint } from '../src/glyph-python/γpy.mjs';

function Ωusage() {
  console.log(`Usage:
  node bin/gpy.mjs build <file.gpy> [-o out.py]
  node bin/gpy.mjs run <file.gpy> [-- args...]
  node bin/gpy.mjs check <file.gpy>
  node bin/gpy.mjs test [dir]
  node bin/gpy.mjs fmt [--check] <file.gpy>
  node bin/gpy.mjs lint <file.gpy>
  node bin/gpy.mjs init [dir] [--name name]
  node bin/gpy.mjs deps add <package> [version]
  node bin/gpy.mjs deps list
  node bin/gpy.mjs deps check <package>
`);
}

function Ωarg(flag, argv) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}

function ΩfileArg(argv) {
  const valueFlags = new Set(['-o', '--out', '--map']);
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') break;
    if (valueFlags.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

function ΩlineFromPy(stderr) {
  const text = String(stderr ?? '');
  const preferred = text.match(/File "<unknown>", line (\d+)/) ?? text.match(/File ".*__main__\.py", line (\d+)/);
  if (preferred) return Number(preferred[1]);
  const fallback = text.match(/line (\d+)/);
  return fallback ? Number(fallback[1]) : null;
}

function ΩγExcerpt(source, line) {
  if (!line || line < 1) return '';
  return String(source).split('\n')[line - 1] ?? '';
}

function Ωremap(kind, file, source, stderr) {
  const line = ΩlineFromPy(stderr);
  if (!line) return '';
  const excerpt = ΩγExcerpt(source, line);
  return `\nγ ${kind}: ${file}:${line}\n  ${excerpt}\n`;
}

function ΩshowPy(py) {
  process.stdout.write(`--- emitted python ---\n${py}${py.endsWith('\n') ? '' : '\n'}--- end emitted python ---\n`);
}

function ΩargvAfterDash(argv) {
  const i = argv.indexOf('--');
  return i >= 0 ? argv.slice(i + 1) : [];
}

function Ωwalk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) Ωwalk(path, out);
    else if (name.endsWith('.gpy')) out.push(path);
  }
  return out.sort();
}

function ΩcmdBuild(argv) {
  const file = argv[1];
  if (!file) return Ωbad();
  const outPath = Ωarg('-o', argv) ?? Ωarg('--out', argv);
  const mapPath = Ωarg('--map', argv);
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

function ΩcmdCheck(argv) {
  const file = ΩfileArg(argv);
  if (!file) return Ωbad();
  const src = readFileSync(file, 'utf8');
  const result = γcompileWithMap(src, { sourcePath: file });
  if (argv.includes('--show-py')) ΩshowPy(result.code);
  const check = γcheck(src);
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr + Ωremap('syntax', file, src, check.stderr));
  if ((check.status ?? 1) === 0) process.stdout.write(`check OK ${file}\n`);
  return check.status ?? 1;
}

function ΩcmdRun(argv) {
  const file = ΩfileArg(argv);
  if (!file) return Ωbad();
  const src = readFileSync(file, 'utf8');
  const result = γrun(src, { argv: ΩargvAfterDash(argv), fileBacked: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) {
    const remap = (result.status ?? 1) === 0 ? '' : Ωremap('traceback', file, src, result.stderr);
    process.stderr.write(result.stderr + remap);
  }
  return result.status ?? 1;
}

function ΩcmdTest(argv) {
  const dir = argv[1] ?? 'tests';
  const files = Ωwalk(dir);
  let pass = 0;
  let fail = 0;
  for (const file of files) {
    const result = γrun(readFileSync(file, 'utf8'), { fileBacked: true });
    if ((result.status ?? 1) === 0) pass++;
    else {
      fail++;
      process.stderr.write(`FAIL ${file}\n${result.stderr || result.stdout || ''}`);
    }
  }
  process.stdout.write(`γtest: ${pass} passed, ${fail} failed\n`);
  return fail === 0 ? 0 : 1;
}

function ΩcmdFmt(argv) {
  const checkOnly = argv.includes('--check');
  const file = argv.find((x, i) => i > 0 && x !== '--check');
  if (!file) return Ωbad();
  const src = readFileSync(file, 'utf8');
  const formatted = γformat(src);
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

function ΩcmdLint(argv) {
  const file = ΩfileArg(argv);
  if (!file) return Ωbad();
  const warnings = γlint(readFileSync(file, 'utf8'), { path: file });
  if (warnings.length) {
    process.stderr.write(warnings.join('\n') + '\n');
    return 1;
  }
  process.stdout.write(`lint OK ${file}\n`);
  return 0;
}

function ΩcmdInit(argv) {
  const root = argv.find((x, i) => i > 0 && !x.startsWith('-') && argv[i - 1] !== '--name') ?? '.';
  const name = Ωarg('--name', argv) ?? basename(root === '.' ? process.cwd() : root);
  mkdirSync(join(root, 'src'), { recursive: true });
  const toml = `[project]\nname = "${name}"\npython = ">=3.11"\n\n[dependencies]\n\n[gpy]\nsource = "src"\nemit = "build/py"\n`;
  const manifest = join(root, 'gpy.toml');
  if (!existsSync(manifest)) writeFileSync(manifest, toml);
  const main = join(root, 'src/main.gpy');
  if (!existsSync(main)) writeFileSync(main, `☉("${name} ready")\n`);
  process.stdout.write(`created ${manifest}\n`);
  return 0;
}

function ΩmanifestPath() {
  return join(process.cwd(), 'gpy.toml');
}

function ΩreadManifest() {
  const path = ΩmanifestPath();
  if (!existsSync(path)) throw new Error('gpy.toml not found; run: gpy init .');
  return readFileSync(path, 'utf8');
}

function ΩwriteDependency(toml, name, version) {
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

function Ωdeps(toml) {
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

function ΩcmdDeps(argv) {
  const sub = argv[1];
  if (sub === 'add') {
    const name = argv[2];
    if (!name) return Ωbad();
    const version = argv[3] ?? '*';
    const next = ΩwriteDependency(ΩreadManifest(), name, version);
    writeFileSync(ΩmanifestPath(), next);
    process.stdout.write(`added ${name} ${version}\n`);
    return 0;
  }
  if (sub === 'list') {
    for (const [name, version] of Ωdeps(ΩreadManifest())) process.stdout.write(`${name} ${version}\n`);
    return 0;
  }
  if (sub === 'check') {
    const name = argv[2];
    if (!name) return Ωbad();
    const code = `import importlib.util, sys\nsys.exit(0 if importlib.util.find_spec(${JSON.stringify(name)}) else 1)`;
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if ((r.status ?? 1) === 0) {
      process.stdout.write(`dependency OK: ${name}\n`);
      return 0;
    }
    process.stderr.write(`missing dependency: ${name}\ninstall: pip install ${name}\n`);
    return 1;
  }
  return Ωbad();
}

function Ωbad() {
  Ωusage();
  return 2;
}

function Ωmain(argv) {
  const cmd = argv[0];
  if (cmd === 'build') return ΩcmdBuild(argv);
  if (cmd === 'check') return ΩcmdCheck(argv);
  if (cmd === 'run') return ΩcmdRun(argv);
  if (cmd === 'test') return ΩcmdTest(argv);
  if (cmd === 'fmt') return ΩcmdFmt(argv);
  if (cmd === 'lint') return ΩcmdLint(argv);
  if (cmd === 'init') return ΩcmdInit(argv);
  if (cmd === 'deps') return ΩcmdDeps(argv);
  return Ωbad();
}

process.exit(Ωmain(process.argv.slice(2)));
