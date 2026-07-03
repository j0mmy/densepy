import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  isIdentChar as γid,
  scanStringEnd,
  scanCommentEnd,
  matchBracket,
  topLevelIndex,
  expressionEnd,
  isFStringQuote,
  rewriteFString,
  walkRegions,
  lineRecords,
} from './walk.mjs';

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
  const end = scanStringEnd(src, i);
  const text = src.slice(i, end);
  γpush(ctx, text);
  γadvance(ctx.src, text);
  return end;
}

function γmapExprChar(ch) {
  if (ΓWORD.has(ch)) return ` ${ΓWORD.get(ch)} `;
  if (ΓNUM.has(ch)) return ` ${ΓNUM.get(ch)} `;
  if (ΓOP.has(ch)) return ` ${ΓOP.get(ch)} `;
  return null;
}

// Glyphs never map when joined to an identifier char (Tλ is one identifier).
function γmapFStringChar(ch, prev) {
  if (γid(ch) && γid(prev)) return null;
  return γmapExprChar(ch);
}

function γcopyFString(src, i, ctx) {
  const { out, end } = rewriteFString(src, i, γmapFStringChar);
  γpush(ctx, out);
  γadvance(ctx.src, src.slice(i, end));
  return end;
}

// Macro engine v2: string-protecting, paren-balanced scanner.
// Σ(v∈iter[|guard]) body   -> sum((body) for v in iter[ if guard])
// Π(v∈iter[|guard]) body   -> math.prod((body) for v in iter[ if guard])
// π(v∈iter[|guard]) body   -> [(body) for v in iter[ if guard]]
// (f∘g∘h)(args)            -> f(g(h(args)))
// Bodies/guards/iterables may contain calls, commas, strings, nested macros.
// Body extent: balanced expression up to a top-level newline, ',', '#', or closer.

const ΓIDENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;

function γparseAgg(src, i) {
  const kind = src[i];
  let j = i + 1;
  while (src[j] === ' ') j += 1;
  if (src[j] !== '(') return null;
  const close = matchBracket(src, j);
  if (close === -1) return null;
  const header = src.slice(j + 1, close);
  const at = topLevelIndex(header, '∈');
  if (at === -1) return null;
  const varName = header.slice(0, at).trim();
  if (!ΓIDENT.test(varName)) return null;
  const rest = header.slice(at + 1);
  const bar = topLevelIndex(rest, '|');
  const iter = (bar === -1 ? rest : rest.slice(0, bar)).trim();
  const guard = bar === -1 ? null : rest.slice(bar + 1).trim();
  if (!iter) return null;
  let k = close + 1;
  while (src[k] === ' ' || src[k] === '\t') k += 1;
  const end = expressionEnd(src, k);
  const body = src.slice(k, end).trim();
  if (!body) return null;
  const B = γexpandCore(body);
  const I = γexpandCore(iter);
  const G = guard ? ` if ${γexpandCore(guard)}` : '';
  const V = varName;
  const lowered = kind === 'Σ'
    ? `sum((${B}) for ${V} in ${I}${G})`
    : kind === 'Π'
      ? `math.prod((${B}) for ${V} in ${I}${G})`
      : `[(${B}) for ${V} in ${I}${G}]`;
  return { lowered, end };
}

function γparseCompose(src, i) {
  const close = matchBracket(src, i);
  if (close === -1) return null;
  const inner = src.slice(i + 1, close);
  if (!inner.includes('∘')) return null;
  const names = inner.split('∘').map((x) => x.trim());
  if (names.length < 2 || !names.every((n) => ΓIDENT.test(n))) return null;
  let k = close + 1;
  while (src[k] === ' ') k += 1;
  if (src[k] !== '(') return null;
  const argsClose = matchBracket(src, k);
  if (argsClose === -1) return null;
  const args = γexpandCore(src.slice(k + 1, argsClose));
  let call = `${names[names.length - 1]}(${args})`;
  for (let n = names.length - 2; n >= 0; n -= 1) call = `${names[n]}(${call})`;
  return { lowered: call, end: argsClose + 1 };
}

// Dense ASCII aggregates: keyword[v:iter[|guard]] body — chosen by measured
// BPE token cost (see scripts/density.gpy). Lowered only when a body
// expression follows the closer, which is invalid Python after a subscript,
// so real slices/subscripts (`sum[a:b]` with no body) are never touched.
const ΓASCII_AGG = new Map(Object.entries({
  sum: (B, V, I, G) => `sum((${B}) for ${V} in ${I}${G})`,
  prod: (B, V, I, G) => `math.prod((${B}) for ${V} in ${I}${G})`,
  sel: (B, V, I, G) => `[(${B}) for ${V} in ${I}${G}]`,
  any: (B, V, I, G) => `any((${B}) for ${V} in ${I}${G})`,
  all: (B, V, I, G) => `all((${B}) for ${V} in ${I}${G})`,
}));

const ΓEXPR_START = /[\p{L}\p{N}_"'([{¬−+-]/u;

function γparseAsciiAgg(src, i, word) {
  const open = i + word.length;
  if (src[open] !== '[') return null;
  const close = matchBracket(src, open);
  if (close === -1) return null;
  const header = src.slice(open + 1, close);
  const at = topLevelIndex(header, ':');
  if (at === -1) return null;
  const varName = header.slice(0, at).trim();
  if (!ΓIDENT.test(varName)) return null;
  const rest = header.slice(at + 1);
  const bar = topLevelIndex(rest, '|');
  const iter = (bar === -1 ? rest : rest.slice(0, bar)).trim();
  const guard = bar === -1 ? null : rest.slice(bar + 1).trim();
  if (!iter) return null;
  let k = close + 1;
  while (src[k] === ' ' || src[k] === '\t') k += 1;
  if (!ΓEXPR_START.test(src[k] ?? '')) return null;
  const end = expressionEnd(src, k);
  const body = src.slice(k, end).trim();
  if (!body) return null;
  const G = guard ? ` if ${γexpandCore(guard)}` : '';
  const lowered = ΓASCII_AGG.get(word)(γexpandCore(body), varName, γexpandCore(iter), G);
  return { lowered, end };
}

function γparseFn(src, i) {
  let j = i + 2;
  if (src[j] !== ' ' && src[j] !== '\t') return null;
  while (src[j] === ' ' || src[j] === '\t') j += 1;
  let name = '';
  while (j < src.length && γid(src[j])) { name += src[j]; j += 1; }
  if (!name || !ΓIDENT.test(name)) return null;
  while (src[j] === ' ') j += 1;
  if (src[j] !== '(') return null;
  const close = matchBracket(src, j);
  if (close === -1) return null;
  const params = γexpandCore(src.slice(j + 1, close));
  let k = close + 1;
  while (src[k] === ' ' || src[k] === '\t') k += 1;
  if (src[k] === '=' && src[k + 1] !== '=') {
    let e = k + 1;
    while (src[e] === ' ' || src[e] === '\t') e += 1;
    return { lowered: `def ${name}(${params}): return `, end: e };
  }
  if (src[k] === ':') {
    return { lowered: `def ${name}(${params})`, end: close + 1 };
  }
  return null;
}

function γatStmtStart(out) {
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const ch = out[i];
    if (ch === ' ' || ch === '\t') continue;
    return ch === '\n';
  }
  return true;
}

function γexpandCore(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') {
      const j = scanCommentEnd(src, i);
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const j = scanStringEnd(src, i);
      out += src.slice(i, j);
      i = j;
      continue;
    }
    const prev = out.length ? out[out.length - 1] : '';
    if (/[A-Za-z_]/.test(ch) && !γid(prev)) {
      let w = ch;
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) { w += src[j]; j += 1; }
      if (w === 'fn' && !γid(src[j] ?? '') && γatStmtStart(out)) {
        const fn = γparseFn(src, i);
        if (fn) { out += fn.lowered; i = fn.end; continue; }
      }
      if (ΓASCII_AGG.has(w) && !γid(src[j] ?? '')) {
        const agg = γparseAsciiAgg(src, i, w);
        if (agg) { out += agg.lowered; i = agg.end; continue; }
      }
      out += w;
      i = j;
      continue;
    }
    if ((ch === 'Σ' || ch === 'Π' || ch === 'π') && !γid(prev)) {
      const agg = γparseAgg(src, i);
      if (agg) { out += agg.lowered; i = agg.end; continue; }
    }
    if (ch === '(' && !γid(prev)) {
      const comp = γparseCompose(src, i);
      if (comp) { out += comp.lowered; i = comp.end; continue; }
    }
    out += ch;
    i += 1;
  }
  return out;
}

function γexpandMacros(source) {
  const expanded = γexpandCore(String(source));
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

export function γprelude() {
  return ΓSTD_PRELUDE;
}

export function γcompileWithMap(source, opts = {}) {
  const expanded = γexpandMacros(String(source));
  const preludeUsed = !opts.bare && γusesStdFacade(expanded.code);
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
      const j = scanCommentEnd(src, i);
      const text = src.slice(i, j);
      γpush(ctx, text);
      γadvance(ctx.src, text);
      i = j;
      continue;
    }

    // Strings stay λ-literal, except f-string {…} expressions which are code.
    // Prefixes (f/r/b/u) are copied before quote naturally.
    if (ch === '"' || ch === "'") {
      i = isFStringQuote(src, i) ? γcopyFString(src, i, ctx) : γcopyString(src, i, ctx);
      continue;
    }

    const sourceStart = γclone(ctx.src);

    // ∴ ⎇ → elif (else-if chains); lone ∴ stays else.
    if (ch === '∴') {
      let j = i + 1;
      while (src[j] === ' ' || src[j] === '\t') j += 1;
      if (src[j] === '⎇') {
        const sourceText = src.slice(i, j + 1);
        γemitWord(ctx, sourceText, 'elif', src[j + 1], sourceStart);
        γadvance(ctx.src, sourceText);
        i = j + 1;
        continue;
      }
    }

    // Letter/numeral glyphs (λ, Ⅰ-Ⅻ) are valid Python identifier chars:
    // preceded by an identifier char they are PART of the identifier (Tλ),
    // not a keyword. Symbol glyphs (∧, ∈, …) never join identifiers.
    const inIdent = γid(ch) && γid(src[i - 1] ?? '');

    if (ΓWORD.has(ch) && !inIdent) {
      γemitWord(ctx, ch, ΓWORD.get(ch), src[i + 1], sourceStart);
      γadvance(ctx.src, ch);
      i += 1;
      continue;
    }

    if (ΓNUM.has(ch) && !inIdent) {
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
  for (const region of walkRegions(src)) {
    const text = src.slice(region.start, region.end);
    out.push(region.kind === 'code' ? rewrite(text) : text);
  }
  return out.join('');
}

export function γformat(source) {
  const formatted = γrewriteCodeOnly(source, (code) => code.replace(/\s*([≔≅≠≤≥×÷−])\s*/gu, ' $1 '));
  return formatted
    .replace(/[ \t]+$/gm, '')
    .replace(/\n*$/u, '\n');
}

// Token-minimizing canonical form ("DensePy fmt"). Semantics-preserving:
// strings/comments/continuation lines untouched. Three transforms, each
// measured on o200k_base (see scripts/density.gpy): tight intra-line
// spacing, 1-space indents, single-statement block collapse, blank strip.
const ΓCOMPOUND_START = /^(if|elif|else|for|while|def|class|with|try|except|finally|match|case|async|fn|@|λ|⎇|∴|↻|∀)/u;

export function γdense(source) {
  const tightened = γrewriteCodeOnly(String(source), (code) => code.replace(/ +/g, (m, off, s) => {
    const a = s[off - 1];
    const b = s[off + m.length];
    if (!a || a === '\n') return m;
    if (!b || b === '\n') return '';
    return γid(a) && γid(b) ? ' ' : '';
  }));

  const lines = [];
  for (const rec of lineRecords(tightened)) {
    let text = tightened.slice(rec.start, rec.end);
    if (rec.inString || rec.depth > 0) {
      lines.push({ text, protected: true });
      continue;
    }
    if (/^\s*$/.test(text)) continue;
    const indent = text.match(/^( +)/);
    if (indent && indent[1].length % 4 === 0) {
      text = ' '.repeat(indent[1].length / 4) + text.slice(indent[1].length);
    }
    lines.push({ text, protected: false });
  }

  const γindentOf = (t) => (t.match(/^ */) ?? [''])[0].length;
  const out = [];
  for (let n = 0; n < lines.length; n += 1) {
    const line = lines[n];
    const next = lines[n + 1];
    const after = lines[n + 2];
    if (
      !line.protected && next && !next.protected
      && line.text.trimEnd().endsWith(':') && !line.text.includes('#')
      && γindentOf(next.text) > γindentOf(line.text)
      && !next.text.trimEnd().endsWith(':') && !next.text.includes('#')
      && !ΓCOMPOUND_START.test(next.text.trimStart())
      && (!after || after.protected === false)
      && (!after || γindentOf(after.text) <= γindentOf(line.text))
    ) {
      out.push(`${line.text.trimEnd()}${next.text.trim()}`);
      n += 1;
      continue;
    }
    out.push(line.text);
  }
  const joined = out.join('\n');
  return joined.endsWith('\n') ? joined : `${joined}\n`;
}

function γblankStrings(source) {
  // Replace string-literal contents with spaces (newlines kept, so line
  // numbers survive). Lint rules then cannot fire on text inside strings,
  // and the per-line comment stripper cannot be fooled by '#' in a string.
  const src = String(source);
  let out = '';
  for (const region of walkRegions(src)) {
    const text = src.slice(region.start, region.end);
    out += region.kind === 'string' ? text.replace(/[^\n]/gu, ' ') : text;
  }
  return out;
}

export function γlint(source, opts = {}) {
  const path = opts.path ?? '<source>';
  const warnings = [];
  const rawLines = String(source).split('\n');
  const lines = γblankStrings(String(source)).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const code = lines[i].replace(/#.*$/u, '');
    const raw = rawLines[i] ?? '';
    const n = i + 1;
    const trimmed = code.trim();
    const importMatch = trimmed.match(/^import\s+([^\s,]+)/) ?? trimmed.match(/^from\s+([^\s]+)\s+import\b/);
    if (importMatch && /[^\x00-\x7F]/u.test(importMatch[1])) {
      warnings.push(`${path}:${n} host-boundary: import module names must stay ASCII (${importMatch[1]})`);
    }
    // Dense canon enforcement: agents that fall back to `def` get a lint
    // signal their repair loop must clear (adoption by toolchain, not trust).
    if (/^\s*def\b/u.test(code)) warnings.push(`${path}:${n} style: use fn instead of def (dense canon)`);
    // Capability posture (GPY011): flag effects an agent/reviewer should see.
    if (/\bsubprocess\b|\bos\.system\b|\bos\.exec\w*/u.test(code)) warnings.push(`${path}:${n} capability: process execution`);
    if (/\burllib\b|\bsocket\b|\brequests\b|\bhttpx\b|\bHTTP\.get_text\b/u.test(code)) warnings.push(`${path}:${n} capability: network access`);
    if ((/\bopen\s*\(/u.test(code) && /\bopen\s*\([^)]*["'][wax]/u.test(raw)) || /\b(File|JSON|CSV)\.write\b/u.test(code)) warnings.push(`${path}:${n} capability: file write`);
    if (/\beval\s*\(|\bexec\s*\(/u.test(code)) warnings.push(`${path}:${n} capability: dynamic code execution`);
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
        stdio: ['inherit', 'pipe', 'pipe'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return spawnSync(opts.python ?? 'python3', ['-c', py], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env: opts.env ?? process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
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
