#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, mkdtempSync, rmSync, existsSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, relative, dirname } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { γcompile, γcompileWithMap, γrun, γcheck, γformat, γlint, γprelude } from '../src/glyph-python/γpy.mjs';
import { γlspServe } from '../src/glyph-python/lsp.mjs';

function Ωusage() {
  console.log(`Usage:
  node bin/gpy.mjs build <file.gpy> [-o out.py]
  node bin/gpy.mjs run <file.gpy> [-- args...]
  node bin/gpy.mjs check <file.gpy> [--show-py] [--types]
  node bin/gpy.mjs test [dir]
  node bin/gpy.mjs fmt [--check] [file.gpy]
  node bin/gpy.mjs watch [file.gpy]
  node bin/gpy.mjs repl
  node bin/gpy.mjs lsp
  node bin/gpy.mjs lint [file.gpy]
  node bin/gpy.mjs init [dir] [--name name]
  node bin/gpy.mjs deps add <package> [version] [--no-install]
  node bin/gpy.mjs deps install
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

function Ωremap(kind, file, source, stderr, lineOffset = 0) {
  const pyLine = ΩlineFromPy(stderr);
  if (!pyLine) return '';
  const line = pyLine - lineOffset;
  if (line < 1) return `\nγ ${kind}: ${file} (inside γ prelude, emitted python line ${pyLine})\n`;
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

function Ωgpy(toml) {
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

function ΩbuildProject() {
  const cfg = Ωgpy(ΩreadManifest());
  const sourceDir = join(process.cwd(), cfg.source);
  const emitDir = join(process.cwd(), cfg.emit);
  const files = Ωwalk(sourceDir);
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

function ΩremapProject(built, stderr) {
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

function ΩprojectEntry(built) {
  const main = built.cfg.main ?? join(built.cfg.source, 'main.gpy');
  const rel = relative(built.cfg.source, main).replace(/\.gpy$/, '.py');
  return join(process.cwd(), built.cfg.emit, rel);
}

function ΩcmdBuild(argv) {
  const file = ΩfileArg(argv);
  if (!file) {
    try {
      const built = ΩbuildProject();
      process.stdout.write(`built ${built.modules.length} files -> ${built.cfg.emit}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
  }
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

function Ωtypecheck(file, compiled) {
  const root = mkdtempSync(join(tmpdir(), 'γpy-types-'));
  const tmp = join(root, basename(file).replace(/\.gpy$/, '.py'));
  try {
    writeFileSync(tmp, compiled.code);
    const custom = process.env.GPY_TYPECHECKER;
    let r;
    if (custom) {
      r = spawnSync(custom, [tmp], { encoding: 'utf8' });
    } else if (spawnSync('pyright', ['--version'], { encoding: 'utf8' }).status === 0) {
      r = spawnSync('pyright', [tmp], { encoding: 'utf8' });
    } else if (spawnSync(Ωpython(), ['-m', 'mypy', '--version'], { encoding: 'utf8' }).status === 0) {
      r = spawnSync(Ωpython(), ['-m', 'mypy', tmp], { encoding: 'utf8' });
    } else {
      process.stderr.write('no type checker found: install pyright (npm i -g pyright) or mypy (gpy deps add mypy)\n');
      return 1;
    }
    const esc = tmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const remapped = String((r.stdout ?? '') + (r.stderr ?? ''))
      .replace(new RegExp(`${esc}:(\\d+)`, 'g'), (m, n) => `${file}:${Math.max(1, Number(n) - compiled.lineOffset)}`)
      .replaceAll(tmp, file);
    if (remapped.trim()) process.stdout.write(remapped.endsWith('\n') ? remapped : `${remapped}\n`);
    if ((r.status ?? 1) === 0) process.stdout.write(`types OK ${file}\n`);
    return r.status ?? 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function ΩcmdCheck(argv) {
  const file = ΩfileArg(argv);
  if (!file) return Ωbad();
  const src = readFileSync(file, 'utf8');
  const result = γcompileWithMap(src, { sourcePath: file });
  if (argv.includes('--show-py')) ΩshowPy(result.code);
  const check = γcheck(src);
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr + Ωremap('syntax', file, src, check.stderr, result.lineOffset));
  if ((check.status ?? 1) !== 0) return check.status ?? 1;
  if (argv.includes('--types')) return Ωtypecheck(file, result);
  process.stdout.write(`check OK ${file}\n`);
  return 0;
}

function ΩcmdRun(argv) {
  const file = ΩfileArg(argv);
  if (!file) {
    let built;
    try {
      built = ΩbuildProject();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    const entry = ΩprojectEntry(built);
    if (!existsSync(entry)) {
      process.stderr.write(`entrypoint not found after build: ${entry}\n`);
      return 1;
    }
    const result = spawnSync(Ωpython(), [entry, ...ΩargvAfterDash(argv)], {
      encoding: 'utf8',
      env: process.env,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) {
      const remap = (result.status ?? 1) === 0 ? '' : ΩremapProject(built, result.stderr);
      process.stderr.write(result.stderr + remap);
    }
    return result.status ?? 1;
  }
  const src = readFileSync(file, 'utf8');
  const { lineOffset } = γcompileWithMap(src);
  const result = γrun(src, { argv: ΩargvAfterDash(argv), fileBacked: true, python: Ωpython() });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) {
    const remap = (result.status ?? 1) === 0 ? '' : Ωremap('traceback', file, src, result.stderr, lineOffset);
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

function ΩprojectFiles() {
  const cfg = Ωgpy(ΩreadManifest());
  return Ωwalk(join(process.cwd(), cfg.source));
}

function ΩcmdFmt(argv) {
  const checkOnly = argv.includes('--check');
  const file = argv.find((x, i) => i > 0 && x !== '--check');
  if (!file) {
    let files;
    try {
      files = ΩprojectFiles();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    let changed = 0;
    for (const path of files) {
      const src = readFileSync(path, 'utf8');
      const formatted = γformat(src);
      if (formatted === src) continue;
      changed += 1;
      if (checkOnly) process.stderr.write(`fmt would change ${relative(process.cwd(), path)}\n`);
      else writeFileSync(path, formatted);
    }
    if (checkOnly && changed > 0) return 1;
    process.stdout.write(`fmt OK ${files.length} files\n`);
    return 0;
  }
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

function ΩcmdWatch(argv) {
  const file = ΩfileArg(argv);
  let targetDir;
  let files;
  if (file) {
    targetDir = dirname(file);
    files = () => [file];
  } else {
    const cfg = Ωgpy(ΩreadManifest());
    targetDir = join(process.cwd(), cfg.source);
    files = () => Ωwalk(targetDir);
  }

  const checkOnce = () => {
    let failed = 0;
    const list = files();
    for (const path of list) {
      const src = readFileSync(path, 'utf8');
      const { lineOffset } = γcompileWithMap(src);
      const check = γcheck(src, { python: Ωpython() });
      if ((check.status ?? 1) !== 0) {
        failed += 1;
        const rel = relative(process.cwd(), path);
        process.stderr.write(check.stderr + Ωremap('syntax', rel, src, check.stderr, lineOffset));
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

function ΩcmdRepl() {
  const driver = [
    'import sys, codeop, math',
    'ns = {"math": math}',
    `exec(compile(${JSON.stringify(γprelude())}, '<γprelude>', 'exec'), ns)`,
    "buf = ''",
    'while True:',
    '    line = sys.stdin.readline()',
    '    if not line:',
    '        break',
    '    buf += line',
    '    try:',
    "        code = codeop.compile_command(buf, '<γ>', 'single')",
    '    except SyntaxError as e:',
    "        print('SyntaxError:', e)",
    "        buf = ''",
    '        continue',
    '    if code is None:',
    '        continue',
    "    buf = ''",
    '    try:',
    '        exec(code, ns)',
    '    except SystemExit:',
    '        raise',
    '    except BaseException as e:',
    "        print(type(e).__name__ + ':', e)",
  ].join('\n');
  const py = spawn(Ωpython(), ['-u', '-c', driver], { stdio: ['pipe', 'inherit', 'inherit'] });
  process.stderr.write('GlyphPython REPL (ctrl-d to exit)\n');
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const compiled = γcompileWithMap(line, { bare: true }).code;
    py.stdin.write(`${compiled}\n`);
  });
  rl.on('close', () => py.stdin.end());
  py.on('exit', (code) => process.exit(code ?? 0));
  return null;
}

function ΩcmdLint(argv) {
  const file = ΩfileArg(argv);
  if (!file) {
    let files;
    try {
      files = ΩprojectFiles();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    const warnings = files.flatMap((path) =>
      γlint(readFileSync(path, 'utf8'), { path: relative(process.cwd(), path) }));
    if (warnings.length) {
      process.stderr.write(warnings.join('\n') + '\n');
      return 1;
    }
    process.stdout.write(`lint OK ${files.length} files\n`);
    return 0;
  }
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
  const toml = `[project]\nname = "${name}"\npython = ">=3.11"\n\n[dependencies]\n\n[gpy]\nsource = "src"\nemit = "build/py"\nmain = "src/main.gpy"\n`;
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

function Ωvenv() {
  return join(process.cwd(), '.venv');
}

function ΩvenvPython() {
  const python = join(Ωvenv(), 'bin', 'python');
  return existsSync(python) ? python : null;
}

function Ωpython() {
  return ΩvenvPython() ?? 'python3';
}

function ΩensureVenv() {
  const existing = ΩvenvPython();
  if (existing) return existing;
  const uv = spawnSync('uv', ['--version'], { encoding: 'utf8' });
  const r = uv.status === 0
    ? spawnSync('uv', ['venv', Ωvenv()], { encoding: 'utf8' })
    : spawnSync('python3', ['-m', 'venv', Ωvenv()], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) throw new Error(`venv creation failed: ${r.stderr || r.stdout}`);
  const created = ΩvenvPython();
  if (!created) throw new Error(`venv created but python missing at ${join(Ωvenv(), 'bin', 'python')}`);
  return created;
}

function Ωspecs(deps) {
  return deps.map(([name, version]) => (version && version !== '*' ? `${name}${version}` : name));
}

function Ωinstall(specs) {
  if (!specs.length) return 0;
  const custom = process.env.GPY_INSTALLER;
  const r = custom
    ? spawnSync(custom, ['install', ...specs], { encoding: 'utf8' })
    : spawnSync(ΩensureVenv(), ['-m', 'pip', 'install', ...specs], { encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function ΩcmdDeps(argv) {
  const sub = argv[1];
  if (sub === 'add') {
    const name = argv[2];
    if (!name || name.startsWith('-')) return Ωbad();
    const version = argv[3] && !argv[3].startsWith('-') ? argv[3] : '*';
    const next = ΩwriteDependency(ΩreadManifest(), name, version);
    writeFileSync(ΩmanifestPath(), next);
    process.stdout.write(`added ${name} ${version}\n`);
    if (argv.includes('--no-install')) return 0;
    return Ωinstall(Ωspecs([[name, version]]));
  }
  if (sub === 'install') {
    const specs = Ωspecs(Ωdeps(ΩreadManifest()));
    if (!process.env.GPY_INSTALLER) ΩensureVenv();
    const status = Ωinstall(specs);
    if (status === 0) process.stdout.write(`installed ${specs.length} dependencies into .venv\n`);
    return status;
  }
  if (sub === 'list') {
    for (const [name, version] of Ωdeps(ΩreadManifest())) process.stdout.write(`${name} ${version}\n`);
    return 0;
  }
  if (sub === 'check') {
    const name = argv[2];
    if (!name) return Ωbad();
    const code = `import importlib.util, sys\nsys.exit(0 if importlib.util.find_spec(${JSON.stringify(name)}) else 1)`;
    const r = spawnSync(Ωpython(), ['-c', code], { encoding: 'utf8' });
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

function Ωversion() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  process.stdout.write(`gpy ${pkg.version}\n`);
  return 0;
}

function Ωmain(argv) {
  const cmd = argv[0];
  if (cmd === '--version' || cmd === '-V' || cmd === 'version') return Ωversion();
  if (cmd === 'build') return ΩcmdBuild(argv);
  if (cmd === 'check') return ΩcmdCheck(argv);
  if (cmd === 'run') return ΩcmdRun(argv);
  if (cmd === 'test') return ΩcmdTest(argv);
  if (cmd === 'fmt') return ΩcmdFmt(argv);
  if (cmd === 'watch') return ΩcmdWatch(argv);
  if (cmd === 'repl') return ΩcmdRepl();
  if (cmd === 'lsp') {
    γlspServe(process.stdin, process.stdout);
    return null;
  }
  if (cmd === 'lint') return ΩcmdLint(argv);
  if (cmd === 'init') return ΩcmdInit(argv);
  if (cmd === 'deps') return ΩcmdDeps(argv);
  return Ωbad();
}

const Ωcode = Ωmain(process.argv.slice(2));
if (Ωcode !== null) process.exit(Ωcode);
