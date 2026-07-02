import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// γ→py: project-owned γ surface, Python owns the λ runtime boundary.
const ΓWORD = new Map(Object.entries({
  'λ': 'def',
  '⎇': 'if',
  '∴': 'else',
  '↻': 'while',
  '∀': 'for',
  '∈': 'in',
  '⊢': 'return',
  '☉': 'print',
  '⊤': 'True',
  '⊥': 'False',
  '∅': 'None',
  '∧': 'and',
  '∨': 'or',
  '¬': 'not',
}));

const ΓOP = new Map(Object.entries({
  '≔': '=',
  '≅': '==',
  '≠': '!=',
  '≤': '<=',
  '≥': '>=',
  '×': '*',
  '÷': '/',
  '−': '-',
}));

const ΓNUM = new Map(Object.entries({
  'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6',
  'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', 'Ⅹ': '10', 'Ⅺ': '11', 'Ⅻ': '12',
}));

const ΓSTD_NAMES = ['File', 'JSON', 'Path', 'HTTP', 'CSV', 'Table', 'Ρθ', 'Πδ'];

const ΓSTD_PRELUDE = `import csv as _γ_csv, json as _γ_json, os as _γ_os, urllib.request as _γ_urlreq\nfrom pathlib import Path as _γ_Path\nclass File:\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        return _γ_Path(path).read_text(encoding=encoding)\n    @staticmethod\n    def write(path, data, encoding='utf-8'):\n        _γ_Path(path).write_text(str(data), encoding=encoding)\n        return path\nclass JSON:\n    @staticmethod\n    def loads(text):\n        return _γ_json.loads(text)\n    @staticmethod\n    def dumps(value, **kwargs):\n        return _γ_json.dumps(value, **kwargs)\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        return _γ_json.loads(File.read(path, encoding=encoding))\n    @staticmethod\n    def write(path, value, encoding='utf-8', **kwargs):\n        File.write(path, _γ_json.dumps(value, **kwargs), encoding=encoding)\n        return path\nclass Path:\n    @staticmethod\n    def join(*parts):\n        return str(_γ_Path(*parts))\n    @staticmethod\n    def exists(path):\n        return _γ_Path(path).exists()\n    @staticmethod\n    def name(path):\n        return _γ_Path(path).name\nclass HTTP:\n    @staticmethod\n    def get_text(url, encoding='utf-8'):\n        with _γ_urlreq.urlopen(url) as r:\n            return r.read().decode(encoding)\nclass CSV:\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        with open(path, newline='', encoding=encoding) as f:\n            return list(_γ_csv.DictReader(f))\n    @staticmethod\n    def write(path, rows, fieldnames=None, encoding='utf-8'):\n        rows = list(rows)\n        if fieldnames is None:\n            fieldnames = list(rows[0].keys()) if rows else []\n        with open(path, 'w', newline='', encoding=encoding) as f:\n            w = _γ_csv.DictWriter(f, fieldnames=fieldnames)\n            w.writeheader()\n            w.writerows(rows)\n        return path\nclass Table:\n    @staticmethod\n    def require():\n        try:\n            import pandas as _γ_pd\n            return _γ_pd\n        except ImportError:\n            raise ImportError('GlyphPython Table facade requires pandas: pip install pandas') from None\n    @staticmethod\n    def read_csv(path, **kwargs):\n        return Table.require().read_csv(path, **kwargs)\nΡθ = Path\nΠδ = Table\n`;

function γusesStdFacade(source) {
  // Only code chunks count: facade names inside strings/comments must not inject the prelude.
  let code = '';
  γrewriteCodeOnly(source, (chunk) => {
    code += chunk;
    return chunk;
  });
  return ΓSTD_NAMES.some((name) => code.includes(name));
}

function γid(ch) {
  return /[\p{L}\p{N}_]/u.test(ch ?? '');
}

function γloc() {
  return { line: 1, column: 1, offset: 0 };
}

function γclone(pos) {
  return { line: pos.line, column: pos.column, offset: pos.offset };
}

function γadvance(pos, text) {
  for (const ch of String(text)) {
    pos.offset += 1;
    if (ch === '\n') {
      pos.line += 1;
      pos.column = 1;
    } else {
      pos.column += 1;
    }
  }
}

function γlast(out) {
  return out.length ? out[out.length - 1] : '';
}

function γpush(ctx, text) {
  ctx.out.push(text);
  γadvance(ctx.gen, text);
}

function γmap(ctx, sourceText, generatedText, sourceStart, generatedStart, type) {
  ctx.mappings.push({
    type,
    sourceText,
    generatedText,
    source: sourceStart,
    generated: generatedStart,
  });
}

function γemitWord(ctx, sourceText, word, next, sourceStart) {
  const generatedStart = γclone(ctx.gen);
  const prev = γlast(ctx.out);
  if (γid(prev)) γpush(ctx, ' ');
  const mappedStart = γclone(ctx.gen);
  γpush(ctx, word);
  γmap(ctx, sourceText, word, sourceStart, mappedStart, 'alias');
  if (γid(next)) γpush(ctx, ' ');
}

function γemitNum(ctx, sourceText, n, next, sourceStart) {
  const prev = γlast(ctx.out);
  if (γid(prev)) γpush(ctx, ' ');
  const mappedStart = γclone(ctx.gen);
  γpush(ctx, n);
  γmap(ctx, sourceText, n, sourceStart, mappedStart, 'number');
  if (γid(next)) γpush(ctx, ' ');
}

function γemitOp(ctx, sourceText, op, sourceStart) {
  const prev = γlast(ctx.out);
  if (prev && !/\s/.test(prev)) γpush(ctx, ' ');
  const mappedStart = γclone(ctx.gen);
  γpush(ctx, op);
  γmap(ctx, sourceText, op, sourceStart, mappedStart, 'operator');
  γpush(ctx, ' ');
}

function γcopyString(src, i, ctx) {
  const q = src[i];
  const triple = src.slice(i, i + 3) === q.repeat(3);
  const end = triple ? q.repeat(3) : q;
  const start = i;
  i += triple ? 3 : 1;
  while (i < src.length) {
    if (!triple && src[i] === '\\') {
      i += 2;
      continue;
    }
    if (triple && src.slice(i, i + 3) === end) {
      i += 3;
      break;
    }
    if (!triple && src[i] === q) {
      i += 1;
      break;
    }
    i += 1;
  }
  const text = src.slice(start, i);
  γpush(ctx, text);
  γadvance(ctx.src, text);
  return i;
}

function γfPrefix(src, i) {
  // True when the quote at src[i] belongs to an f-string (f", rf', F""" ...).
  let j = i - 1;
  let letters = '';
  while (j >= 0 && /[A-Za-z]/.test(src[j]) && letters.length < 3) {
    letters = src[j] + letters;
    j -= 1;
  }
  if (!letters || letters.length > 2) return false;
  if (j >= 0 && γid(src[j])) return false;
  return /[fF]/.test(letters) && /^[fFrRbBuU]+$/.test(letters);
}

function γmapExprChar(ch) {
  if (ΓWORD.has(ch)) return ` ${ΓWORD.get(ch)} `;
  if (ΓNUM.has(ch)) return ` ${ΓNUM.get(ch)} `;
  if (ΓOP.has(ch)) return ` ${ΓOP.get(ch)} `;
  return null;
}

function γcopyFString(src, i, ctx) {
  // Literal text and {{ }} escapes stay raw; glyphs inside {…} replacement
  // fields are rewritten; format specs (after top-level :) and nested string
  // literals stay raw.
  const q = src[i];
  const triple = src.slice(i, i + 3) === q.repeat(3);
  const endq = triple ? q.repeat(3) : q;
  const start = i;
  let out = '';
  i += triple ? 3 : 1;
  out += src.slice(start, i);
  const frames = [];
  while (i < src.length) {
    const ch = src[i];
    if (frames.length === 0) {
      if (triple && src.slice(i, i + 3) === endq) { out += endq; i += 3; break; }
      if (!triple && ch === q) { out += ch; i += 1; break; }
      if (!triple && ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === '{' && src[i + 1] === '{') { out += '{{'; i += 2; continue; }
      if (ch === '}' && src[i + 1] === '}') { out += '}}'; i += 2; continue; }
      if (ch === '{') { frames.push({ spec: false }); out += ch; i += 1; continue; }
      out += ch; i += 1; continue;
    }
    if (ch === '{') { frames.push({ spec: false }); out += ch; i += 1; continue; }
    if (ch === '}') { frames.pop(); out += ch; i += 1; continue; }
    const top = frames[frames.length - 1];
    if (ch === ':' && !top.spec) { top.spec = true; out += ch; i += 1; continue; }
    if (!top.spec && (ch === '"' || ch === "'")) {
      const nq = ch;
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === nq) { j += 1; break; }
        j += 1;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (!top.spec) {
      const mapped = γmapExprChar(ch);
      if (mapped !== null) { out += mapped; i += 1; continue; }
    }
    out += ch;
    i += 1;
  }
  const original = src.slice(start, i);
  γpush(ctx, out);
  γadvance(ctx.src, original);
  return i;
}

function γrewriteCodeChunk(chunk) {
  return String(chunk)
    .replace(/π\(([\p{L}_][\p{L}\p{N}_]*)∈([^|\)]+)\|([^\)]+)\)\s*([^\n,\)]+)/gu, '[($4) for $1 in $2 if $3]')
    .replace(/Σ\(([\p{L}_][\p{L}\p{N}_]*)∈([^\)]+)\)\s*([^\n,\)]+)/gu, 'sum(($3) for $1 in $2)')
    .replace(/Π\(([\p{L}_][\p{L}\p{N}_]*)∈([^\)]+)\)\s*([^\n,\)]+)/gu, 'math.prod(($3) for $1 in $2)')
    .replace(/\(([\p{L}_][\p{L}\p{N}_]*)∘([\p{L}_][\p{L}\p{N}_]*)\)\(([^\(\)]*)\)/gu, '$1($2($3))');
}

function γexpandMacros(source) {
  const src = String(source);
  const out = [];
  let code = '';
  let i = 0;
  const flush = () => {
    if (code) {
      out.push(γrewriteCodeChunk(code));
      code = '';
    }
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') {
      flush();
      const j = src.indexOf('\n', i);
      if (j === -1) {
        out.push(src.slice(i));
        return out.join('');
      }
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      flush();
      const q = ch;
      const triple = src.slice(i, i + 3) === q.repeat(3);
      const end = triple ? q.repeat(3) : q;
      const start = i;
      i += triple ? 3 : 1;
      while (i < src.length) {
        if (!triple && src[i] === '\\') {
          i += 2;
          continue;
        }
        if (triple && src.slice(i, i + 3) === end) {
          i += 3;
          break;
        }
        if (!triple && src[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      out.push(src.slice(start, i));
      continue;
    }
    code += ch;
    i += 1;
  }
  flush();
  const expanded = out.join('');
  if (expanded.includes('math.prod(') && !/^\s*import\s+math\b/m.test(expanded)) {
    return { code: `import math\n${expanded}`, injectedLines: 1 };
  }
  return { code: expanded, injectedLines: 0 };
}

function γcountLines(text) {
  let n = 0;
  for (const ch of String(text)) if (ch === '\n') n += 1;
  return n;
}

export function γcompileWithMap(source, opts = {}) {
  const expanded = γexpandMacros(String(source));
  const preludeUsed = γusesStdFacade(expanded.code);
  const src = preludeUsed ? `${ΓSTD_PRELUDE}${expanded.code}` : expanded.code;
  const lineOffset = expanded.injectedLines + (preludeUsed ? γcountLines(ΓSTD_PRELUDE) : 0);
  const ctx = {
    out: [],
    mappings: [],
    src: γloc(),
    gen: γloc(),
  };
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // #… stays λ-literal; no γ rewrites inside comments.
    if (ch === '#') {
      const j = src.indexOf('\n', i);
      const text = j === -1 ? src.slice(i) : src.slice(i, j);
      γpush(ctx, text);
      γadvance(ctx.src, text);
      i += text.length;
      if (j === -1) break;
      continue;
    }

    // Strings stay λ-literal, except f-string {…} expressions which are code.
    // Prefixes (f/r/b/u) are copied before quote naturally.
    if (ch === '"' || ch === "'") {
      i = γfPrefix(src, i) ? γcopyFString(src, i, ctx) : γcopyString(src, i, ctx);
      continue;
    }

    const sourceStart = γclone(ctx.src);

    if (ΓWORD.has(ch)) {
      γemitWord(ctx, ch, ΓWORD.get(ch), src[i + 1], sourceStart);
      γadvance(ctx.src, ch);
      i += 1;
      continue;
    }

    if (ΓNUM.has(ch)) {
      γemitNum(ctx, ch, ΓNUM.get(ch), src[i + 1], sourceStart);
      γadvance(ctx.src, ch);
      i += 1;
      continue;
    }

    if (ΓOP.has(ch)) {
      γemitOp(ctx, ch, ΓOP.get(ch), sourceStart);
      γadvance(ctx.src, ch);
      i += 1;
      while (src[i] === ' ' || src[i] === '\t') {
        γadvance(ctx.src, src[i]);
        i += 1;
      }
      continue;
    }

    γpush(ctx, ch);
    γadvance(ctx.src, ch);
    i += 1;
  }

  const code = ctx.out.join('').replace(/[ \t]+\n/g, '\n');
  return {
    code,
    lineOffset,
    map: {
      version: 1,
      source: opts.sourcePath ?? null,
      generated: opts.generatedPath ?? null,
      lineOffset,
      mappings: ctx.mappings,
    },
  };
}

export function γcompile(source) {
  return γcompileWithMap(source).code;
}

function γrewriteCodeOnly(source, rewrite) {
  const src = String(source);
  const out = [];
  let code = '';
  let i = 0;
  const flush = () => {
    if (code) {
      out.push(rewrite(code));
      code = '';
    }
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') {
      flush();
      const j = src.indexOf('\n', i);
      if (j === -1) {
        out.push(src.slice(i));
        return out.join('');
      }
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      flush();
      const q = ch;
      const triple = src.slice(i, i + 3) === q.repeat(3);
      const end = triple ? q.repeat(3) : q;
      const start = i;
      i += triple ? 3 : 1;
      while (i < src.length) {
        if (!triple && src[i] === '\\') {
          i += 2;
          continue;
        }
        if (triple && src.slice(i, i + 3) === end) {
          i += 3;
          break;
        }
        if (!triple && src[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      out.push(src.slice(start, i));
      continue;
    }
    code += ch;
    i += 1;
  }
  flush();
  return out.join('');
}

export function γformat(source) {
  const formatted = γrewriteCodeOnly(source, (code) => code.replace(/\s*([≔≅≠≤≥×÷−])\s*/gu, ' $1 '));
  return formatted
    .replace(/[ \t]+$/gm, '')
    .replace(/\n*$/u, '\n');
}

export function γlint(source, opts = {}) {
  const path = opts.path ?? '<source>';
  const warnings = [];
  const lines = String(source).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = i + 1;
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+([^\s,]+)/) ?? trimmed.match(/^from\s+([^\s]+)\s+import\b/);
    if (importMatch && /[^\x00-\x7F]/u.test(importMatch[1])) {
      warnings.push(`${path}:${n} host-boundary: import module names must stay ASCII (${importMatch[1]})`);
    }
    const code = γrewriteCodeOnly(line, (x) => x.replace(/#.*$/u, ''));
    if (/^\s*def\b/u.test(code)) warnings.push(`${path}:${n} mixed-style: use λ instead of def`);
    if (/^\s*return\b/u.test(code)) warnings.push(`${path}:${n} mixed-style: use ⊢ instead of return`);
    if (/\bprint\s*\(/u.test(code)) warnings.push(`${path}:${n} mixed-style: use ☉ instead of print`);
  }
  return warnings;
}

export function γrun(source, opts = {}) {
  const py = γcompile(source);
  const argv = opts.argv ?? [];
  if (argv.length > 0 || opts.fileBacked) {
    const root = mkdtempSync(join(tmpdir(), 'γpy-run-'));
    const file = join(root, '__main__.py');
    try {
      writeFileSync(file, py);
      return spawnSync(opts.python ?? 'python3', [file, ...argv], {
        cwd: opts.cwd,
        encoding: 'utf8',
        env: opts.env ?? process.env,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return spawnSync(opts.python ?? 'python3', ['-c', py], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env: opts.env ?? process.env,
  });
}

export function γcheck(source, opts = {}) {
  const py = γcompile(source);
  return spawnSync(opts.python ?? 'python3', ['-c', `import ast\nast.parse(${JSON.stringify(py)})`], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env: opts.env ?? process.env,
  });
}

export const ΓMAP = Object.freeze({
  word: Object.freeze(Object.fromEntries(ΓWORD)),
  op: Object.freeze(Object.fromEntries(ΓOP)),
  num: Object.freeze(Object.fromEntries(ΓNUM)),
});
