import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  isIdentChar,
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
const WORD_GLYPHS = new Map(Object.entries({
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

const OPERATOR_GLYPHS = new Map(Object.entries({
  '≔': '=',
  '≅': '==',
  '≠': '!=',
  '≤': '<=',
  '≥': '>=',
  '×': '*',
  '÷': '/',
  '−': '-',
}));

const NUMERAL_GLYPHS = new Map(Object.entries({
  'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6',
  'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', 'Ⅹ': '10', 'Ⅺ': '11', 'Ⅻ': '12',
}));

const FACADE_NAMES = ['File', 'JSON', 'Path', 'HTTP', 'CSV', 'Table', 'Ρθ', 'Πδ'];

const FACADE_PRELUDE = `import csv as _γ_csv, json as _γ_json, os as _γ_os, urllib.request as _γ_urlreq\nfrom pathlib import Path as _γ_Path\nclass File:\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        return _γ_Path(path).read_text(encoding=encoding)\n    @staticmethod\n    def write(path, data, encoding='utf-8'):\n        _γ_Path(path).write_text(str(data), encoding=encoding)\n        return path\nclass JSON:\n    @staticmethod\n    def loads(text):\n        return _γ_json.loads(text)\n    @staticmethod\n    def dumps(value, **kwargs):\n        return _γ_json.dumps(value, **kwargs)\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        return _γ_json.loads(File.read(path, encoding=encoding))\n    @staticmethod\n    def write(path, value, encoding='utf-8', **kwargs):\n        File.write(path, _γ_json.dumps(value, **kwargs), encoding=encoding)\n        return path\nclass Path:\n    @staticmethod\n    def join(*parts):\n        return str(_γ_Path(*parts))\n    @staticmethod\n    def exists(path):\n        return _γ_Path(path).exists()\n    @staticmethod\n    def name(path):\n        return _γ_Path(path).name\nclass HTTP:\n    @staticmethod\n    def get_text(url, encoding='utf-8'):\n        with _γ_urlreq.urlopen(url) as r:\n            return r.read().decode(encoding)\nclass CSV:\n    @staticmethod\n    def read(path, encoding='utf-8'):\n        with open(path, newline='', encoding=encoding) as f:\n            return list(_γ_csv.DictReader(f))\n    @staticmethod\n    def write(path, rows, fieldnames=None, encoding='utf-8'):\n        rows = list(rows)\n        if fieldnames is None:\n            fieldnames = list(rows[0].keys()) if rows else []\n        with open(path, 'w', newline='', encoding=encoding) as f:\n            w = _γ_csv.DictWriter(f, fieldnames=fieldnames)\n            w.writeheader()\n            w.writerows(rows)\n        return path\nclass Table:\n    @staticmethod\n    def require():\n        try:\n            import pandas as _γ_pd\n            return _γ_pd\n        except ImportError:\n            raise ImportError('GlyphPython Table facade requires pandas: pip install pandas') from None\n    @staticmethod\n    def read_csv(path, **kwargs):\n        return Table.require().read_csv(path, **kwargs)\nΡθ = Path\nΠδ = Table\n`;

function usesFacade(source) {
  // Only code chunks count: facade names inside strings/comments must not inject the prelude.
  let code = '';
  rewriteCodeRegions(source, (chunk) => {
    code += chunk;
    return chunk;
  });
  return FACADE_NAMES.some((name) => code.includes(name));
}

function newPosition() {
  return { line: 1, column: 1, offset: 0 };
}

function clonePosition(pos) {
  return { line: pos.line, column: pos.column, offset: pos.offset };
}

function advancePosition(pos, text) {
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

function lastEmitted(out) {
  return out.length ? out[out.length - 1] : '';
}

function emit(ctx, text) {
  ctx.out.push(text);
  advancePosition(ctx.gen, text);
}

function addMapping(ctx, sourceText, generatedText, sourceStart, generatedStart, type) {
  ctx.mappings.push({
    type,
    sourceText,
    generatedText,
    source: sourceStart,
    generated: generatedStart,
  });
}

function emitKeyword(ctx, sourceText, word, next, sourceStart) {
  const generatedStart = clonePosition(ctx.gen);
  const prev = lastEmitted(ctx.out);
  if (isIdentChar(prev)) emit(ctx, ' ');
  const mappedStart = clonePosition(ctx.gen);
  emit(ctx, word);
  addMapping(ctx, sourceText, word, sourceStart, mappedStart, 'alias');
  if (isIdentChar(next)) emit(ctx, ' ');
}

function emitNumber(ctx, sourceText, n, next, sourceStart) {
  const prev = lastEmitted(ctx.out);
  if (isIdentChar(prev)) emit(ctx, ' ');
  const mappedStart = clonePosition(ctx.gen);
  emit(ctx, n);
  addMapping(ctx, sourceText, n, sourceStart, mappedStart, 'number');
  if (isIdentChar(next)) emit(ctx, ' ');
}

function emitOperator(ctx, sourceText, op, sourceStart) {
  const prev = lastEmitted(ctx.out);
  if (prev && !/\s/.test(prev)) emit(ctx, ' ');
  const mappedStart = clonePosition(ctx.gen);
  emit(ctx, op);
  addMapping(ctx, sourceText, op, sourceStart, mappedStart, 'operator');
  emit(ctx, ' ');
}

function copyStringLiteral(src, i, ctx) {
  const end = scanStringEnd(src, i);
  const text = src.slice(i, end);
  emit(ctx, text);
  advancePosition(ctx.src, text);
  return end;
}

function mapGlyph(ch) {
  if (WORD_GLYPHS.has(ch)) return ` ${WORD_GLYPHS.get(ch)} `;
  if (NUMERAL_GLYPHS.has(ch)) return ` ${NUMERAL_GLYPHS.get(ch)} `;
  if (OPERATOR_GLYPHS.has(ch)) return ` ${OPERATOR_GLYPHS.get(ch)} `;
  return null;
}

// Glyphs never map when joined to an identifier char (Tλ is one identifier).
function mapFStringGlyph(ch, prev) {
  if (isIdentChar(ch) && isIdentChar(prev)) return null;
  return mapGlyph(ch);
}

function copyFString(src, i, ctx) {
  const { out, end } = rewriteFString(src, i, mapFStringGlyph);
  emit(ctx, out);
  advancePosition(ctx.src, src.slice(i, end));
  return end;
}

// Macro engine v2: string-protecting, paren-balanced scanner.
// Σ(v∈iter[|guard]) body   -> sum((body) for v in iter[ if guard])
// Π(v∈iter[|guard]) body   -> math.prod((body) for v in iter[ if guard])
// π(v∈iter[|guard]) body   -> [(body) for v in iter[ if guard]]
// (f∘g∘h)(args)            -> f(g(h(args)))
// Bodies/guards/iterables may contain calls, commas, strings, nested macros.
// Body extent: balanced expression up to a top-level newline, ',', '#', or closer.

const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;

function parseGlyphAggregate(src, i) {
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
  if (!IDENT_RE.test(varName)) return null;
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
  const B = expandMacroForms(body);
  const I = expandMacroForms(iter);
  const G = guard ? ` if ${expandMacroForms(guard)}` : '';
  const V = varName;
  const lowered = kind === 'Σ'
    ? `sum((${B}) for ${V} in ${I}${G})`
    : kind === 'Π'
      ? `math.prod((${B}) for ${V} in ${I}${G})`
      : `[(${B}) for ${V} in ${I}${G}]`;
  return { lowered, end };
}

function parseComposition(src, i) {
  const close = matchBracket(src, i);
  if (close === -1) return null;
  const inner = src.slice(i + 1, close);
  if (!inner.includes('∘')) return null;
  const names = inner.split('∘').map((x) => x.trim());
  if (names.length < 2 || !names.every((n) => IDENT_RE.test(n))) return null;
  let k = close + 1;
  while (src[k] === ' ') k += 1;
  if (src[k] !== '(') return null;
  const argsClose = matchBracket(src, k);
  if (argsClose === -1) return null;
  const args = expandMacroForms(src.slice(k + 1, argsClose));
  let call = `${names[names.length - 1]}(${args})`;
  for (let n = names.length - 2; n >= 0; n -= 1) call = `${names[n]}(${call})`;
  return { lowered: call, end: argsClose + 1 };
}

// Dense ASCII aggregates: keyword[v:iter[|guard]] body — chosen by measured
// BPE token cost (see scripts/density.gpy). Lowered only when a body
// expression follows the closer, which is invalid Python after a subscript,
// so real slices/subscripts (`sum[a:b]` with no body) are never touched.
const ASCII_AGGREGATES = new Map(Object.entries({
  sum: (B, V, I, G) => `sum((${B}) for ${V} in ${I}${G})`,
  prod: (B, V, I, G) => `math.prod((${B}) for ${V} in ${I}${G})`,
  sel: (B, V, I, G) => `[(${B}) for ${V} in ${I}${G}]`,
  any: (B, V, I, G) => `any((${B}) for ${V} in ${I}${G})`,
  all: (B, V, I, G) => `all((${B}) for ${V} in ${I}${G})`,
}));

const EXPR_START_RE = /[\p{L}\p{N}_"'([{¬−+-]/u;

function parseAsciiAggregate(src, i, word) {
  const open = i + word.length;
  if (src[open] !== '[') return null;
  const close = matchBracket(src, open);
  if (close === -1) return null;
  const header = src.slice(open + 1, close);
  const at = topLevelIndex(header, ':');
  if (at === -1) return null;
  const varName = header.slice(0, at).trim();
  if (!IDENT_RE.test(varName)) return null;
  const rest = header.slice(at + 1);
  const bar = topLevelIndex(rest, '|');
  const iter = (bar === -1 ? rest : rest.slice(0, bar)).trim();
  const guard = bar === -1 ? null : rest.slice(bar + 1).trim();
  if (!iter) return null;
  let k = close + 1;
  while (src[k] === ' ' || src[k] === '\t') k += 1;
  if (!EXPR_START_RE.test(src[k] ?? '')) return null;
  const end = expressionEnd(src, k);
  const body = src.slice(k, end).trim();
  if (!body) return null;
  const G = guard ? ` if ${expandMacroForms(guard)}` : '';
  const lowered = ASCII_AGGREGATES.get(word)(expandMacroForms(body), varName, expandMacroForms(iter), G);
  return { lowered, end };
}

function parseFnDefinition(src, i) {
  let j = i + 2;
  if (src[j] !== ' ' && src[j] !== '\t') return null;
  while (src[j] === ' ' || src[j] === '\t') j += 1;
  let name = '';
  while (j < src.length && isIdentChar(src[j])) { name += src[j]; j += 1; }
  if (!name || !IDENT_RE.test(name)) return null;
  while (src[j] === ' ') j += 1;
  if (src[j] !== '(') return null;
  const close = matchBracket(src, j);
  if (close === -1) return null;
  const params = expandMacroForms(src.slice(j + 1, close));
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

function atStatementStart(out) {
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const ch = out[i];
    if (ch === ' ' || ch === '\t') continue;
    return ch === '\n';
  }
  return true;
}

function expandMacroForms(src) {
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
    if (/[A-Za-z_]/.test(ch) && !isIdentChar(prev)) {
      let w = ch;
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) { w += src[j]; j += 1; }
      if (w === 'fn' && !isIdentChar(src[j] ?? '') && atStatementStart(out)) {
        const fn = parseFnDefinition(src, i);
        if (fn) { out += fn.lowered; i = fn.end; continue; }
      }
      if (ASCII_AGGREGATES.has(w) && !isIdentChar(src[j] ?? '')) {
        const agg = parseAsciiAggregate(src, i, w);
        if (agg) { out += agg.lowered; i = agg.end; continue; }
      }
      out += w;
      i = j;
      continue;
    }
    if ((ch === 'Σ' || ch === 'Π' || ch === 'π') && !isIdentChar(prev)) {
      const agg = parseGlyphAggregate(src, i);
      if (agg) { out += agg.lowered; i = agg.end; continue; }
    }
    if (ch === '(' && !isIdentChar(prev)) {
      const comp = parseComposition(src, i);
      if (comp) { out += comp.lowered; i = comp.end; continue; }
    }
    out += ch;
    i += 1;
  }
  return out;
}

function expandMacros(source) {
  const expanded = expandMacroForms(String(source));
  if (expanded.includes('math.prod(') && !/^\s*import\s+math\b/m.test(expanded)) {
    return { code: `import math\n${expanded}`, injectedLines: 1 };
  }
  return { code: expanded, injectedLines: 0 };
}

function countLines(text) {
  let n = 0;
  for (const ch of String(text)) if (ch === '\n') n += 1;
  return n;
}

export function facadePrelude() {
  return FACADE_PRELUDE;
}

export function compileWithSourceMap(source, opts = {}) {
  const expanded = expandMacros(String(source));
  const preludeUsed = !opts.bare && usesFacade(expanded.code);
  const src = preludeUsed ? `${FACADE_PRELUDE}${expanded.code}` : expanded.code;
  const lineOffset = expanded.injectedLines + (preludeUsed ? countLines(FACADE_PRELUDE) : 0);
  const ctx = {
    out: [],
    mappings: [],
    src: newPosition(),
    gen: newPosition(),
  };
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // #… stays λ-literal; no γ rewrites inside comments.
    if (ch === '#') {
      const j = scanCommentEnd(src, i);
      const text = src.slice(i, j);
      emit(ctx, text);
      advancePosition(ctx.src, text);
      i = j;
      continue;
    }

    // Strings stay λ-literal, except f-string {…} expressions which are code.
    // Prefixes (f/r/b/u) are copied before quote naturally.
    if (ch === '"' || ch === "'") {
      i = isFStringQuote(src, i) ? copyFString(src, i, ctx) : copyStringLiteral(src, i, ctx);
      continue;
    }

    const sourceStart = clonePosition(ctx.src);

    // ∴ ⎇ → elif (else-if chains); lone ∴ stays else.
    if (ch === '∴') {
      let j = i + 1;
      while (src[j] === ' ' || src[j] === '\t') j += 1;
      if (src[j] === '⎇') {
        const sourceText = src.slice(i, j + 1);
        emitKeyword(ctx, sourceText, 'elif', src[j + 1], sourceStart);
        advancePosition(ctx.src, sourceText);
        i = j + 1;
        continue;
      }
    }

    // Letter/numeral glyphs (λ, Ⅰ-Ⅻ) are valid Python identifier chars:
    // preceded by an identifier char they are PART of the identifier (Tλ),
    // not a keyword. Symbol glyphs (∧, ∈, …) never join identifiers.
    const inIdent = isIdentChar(ch) && isIdentChar(src[i - 1] ?? '');

    if (WORD_GLYPHS.has(ch) && !inIdent) {
      emitKeyword(ctx, ch, WORD_GLYPHS.get(ch), src[i + 1], sourceStart);
      advancePosition(ctx.src, ch);
      i += 1;
      continue;
    }

    if (NUMERAL_GLYPHS.has(ch) && !inIdent) {
      emitNumber(ctx, ch, NUMERAL_GLYPHS.get(ch), src[i + 1], sourceStart);
      advancePosition(ctx.src, ch);
      i += 1;
      continue;
    }

    if (OPERATOR_GLYPHS.has(ch)) {
      emitOperator(ctx, ch, OPERATOR_GLYPHS.get(ch), sourceStart);
      advancePosition(ctx.src, ch);
      i += 1;
      while (src[i] === ' ' || src[i] === '\t') {
        advancePosition(ctx.src, src[i]);
        i += 1;
      }
      continue;
    }

    emit(ctx, ch);
    advancePosition(ctx.src, ch);
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

export function compileToPython(source) {
  return compileWithSourceMap(source).code;
}

function rewriteCodeRegions(source, rewrite) {
  const src = String(source);
  const out = [];
  for (const region of walkRegions(src)) {
    const text = src.slice(region.start, region.end);
    out.push(region.kind === 'code' ? rewrite(text) : text);
  }
  return out.join('');
}

export function formatSource(source) {
  const formatted = rewriteCodeRegions(source, (code) => code.replace(/\s*([≔≅≠≤≥×÷−])\s*/gu, ' $1 '));
  return formatted
    .replace(/[ \t]+$/gm, '')
    .replace(/\n*$/u, '\n');
}

// Token-minimizing canonical form ("DensePy fmt"). Semantics-preserving:
// strings/comments/continuation lines untouched. Three transforms, each
// measured on o200k_base (see scripts/density.gpy): tight intra-line
// spacing, 1-space indents, single-statement block collapse, blank strip.
const COMPOUND_START_RE = /^(if|elif|else|for|while|def|class|with|try|except|finally|match|case|async|fn|@|λ|⎇|∴|↻|∀)/u;

export function densify(source) {
  const tightened = rewriteCodeRegions(String(source), (code) => code.replace(/ +/g, (m, off, s) => {
    const a = s[off - 1];
    const b = s[off + m.length];
    if (!a || a === '\n') return m;
    if (!b || b === '\n') return '';
    return isIdentChar(a) && isIdentChar(b) ? ' ' : '';
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

  const indentOf = (t) => (t.match(/^ */) ?? [''])[0].length;
  const out = [];
  for (let n = 0; n < lines.length; n += 1) {
    const line = lines[n];
    const next = lines[n + 1];
    const after = lines[n + 2];
    if (
      !line.protected && next && !next.protected
      && line.text.trimEnd().endsWith(':') && !line.text.includes('#')
      && indentOf(next.text) > indentOf(line.text)
      && !next.text.trimEnd().endsWith(':') && !next.text.includes('#')
      && !COMPOUND_START_RE.test(next.text.trimStart())
      && (!after || after.protected === false)
      && (!after || indentOf(after.text) <= indentOf(line.text))
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

function blankStrings(source) {
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

export function lintSource(source, opts = {}) {
  const path = opts.path ?? '<source>';
  const warnings = [];
  const rawLines = String(source).split('\n');
  const lines = blankStrings(String(source)).split('\n');
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

export function runSource(source, opts = {}) {
  const py = compileToPython(source);
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

export function checkSource(source, opts = {}) {
  const py = compileToPython(source);
  return spawnSync(opts.python ?? 'python3', ['-c', `import ast\nast.parse(${JSON.stringify(py)})`], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env: opts.env ?? process.env,
  });
}

export const GLYPH_TABLES = Object.freeze({
  word: Object.freeze(Object.fromEntries(WORD_GLYPHS)),
  op: Object.freeze(Object.fromEntries(OPERATOR_GLYPHS)),
  num: Object.freeze(Object.fromEntries(NUMERAL_GLYPHS)),
});
