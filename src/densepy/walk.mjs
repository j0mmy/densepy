// Source-walking mechanics for DensePy text. Every scanner that must respect
// string literals (single/triple-quoted, backslash escapes), '#' comments,
// f-string replacement fields, and bracket depth lives here; consumers see
// classified regions and boundary indices and never re-implement quote rules.

const IDENT_CHAR = /[\p{L}\p{N}_]/u;

export function isIdentChar(ch) {
  return IDENT_CHAR.test(ch ?? '');
}

// Index just past the string literal whose opening quote is at src[i].
// Unterminated strings run to end of input. Escapes are honored only in
// non-triple strings; a stray backslash before the closing triple quote
// cannot hide it.
export function scanStringEnd(src, i) {
  const q = src[i];
  const triple = src.slice(i, i + 3) === q.repeat(3);
  const endq = triple ? q.repeat(3) : q;
  i += triple ? 3 : 1;
  while (i < src.length) {
    if (!triple && src[i] === '\\') { i += 2; continue; }
    if (triple && src.slice(i, i + 3) === endq) return i + 3;
    if (!triple && src[i] === q) return i + 1;
    i += 1;
  }
  return i;
}

// Index of the newline ending the comment at src[i], or end of input.
// The newline itself is not part of the comment.
export function scanCommentEnd(src, i) {
  const j = src.indexOf('\n', i);
  return j === -1 ? src.length : j;
}

// Index of the closer balancing the opener at src[i] (strings skipped),
// or -1 when unbalanced.
export function matchBracket(src, i) {
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = scanStringEnd(src, i); continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

// First index of `needle` at bracket depth 0 (strings skipped), or -1.
export function topLevelIndex(text, needle) {
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = scanStringEnd(text, i); continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (depth === 0 && ch === needle) return i;
    i += 1;
  }
  return -1;
}

// End of the balanced expression starting at src[i]: a top-level newline,
// ',', '#', ':', or unmatched closer. Top-level ':' ends the expression so
// aggregate bodies work inside compound-statement headers
// (`if all[x:xs]x>0:...`); a bare top-level lambda in a body is the one
// construct this forgoes (parenthesize it).
export function expressionEnd(src, i) {
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = scanStringEnd(src, i); continue; }
    if (depth === 0 && (ch === '\n' || ch === ',' || ch === '#' || ch === ':')) return i;
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i;
      depth -= 1;
    }
    i += 1;
  }
  return i;
}

// True when the quote at src[i] belongs to an f-string (f", rf', F""" ...).
export function isFStringQuote(src, i) {
  let j = i - 1;
  let letters = '';
  while (j >= 0 && /[A-Za-z]/.test(src[j]) && letters.length < 3) {
    letters = src[j] + letters;
    j -= 1;
  }
  if (!letters || letters.length > 2) return false;
  if (j >= 0 && isIdentChar(src[j])) return false;
  return /[fF]/.test(letters) && /^[fFrRbBuU]+$/.test(letters);
}

// Rewrite the f-string whose opening quote is at src[i]. Literal text and
// {{ }} escapes stay raw; inside {…} replacement fields each char is offered
// to mapChar(ch, prevChar) and replaced when it returns non-null; format
// specs (after a top-level ':') and nested plain string literals stay raw;
// nested f-strings recurse. Returns { out, end }.
export function rewriteFString(src, i, mapChar) {
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
      if (isFStringQuote(src, i)) {
        const inner = rewriteFString(src, i, mapChar);
        out += inner.out;
        i = inner.end;
        continue;
      }
      // Nested plain strings never nest triple quotes; scan single-quote form.
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
      const mapped = mapChar(ch, src[i - 1] ?? '');
      if (mapped !== null) { out += mapped; i += 1; continue; }
    }
    out += ch;
    i += 1;
  }
  return { out, end: i };
}

// Yield maximal classified regions covering src in order:
//   { kind: 'code' | 'string' | 'comment', start, end }
// A comment's terminating newline belongs to the following code region.
// Code regions are maximal: a rewrite applied per-region sees the same
// chunks every consumer sees.
export function* walkRegions(src) {
  let i = 0;
  let codeStart = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') {
      if (codeStart < i) yield { kind: 'code', start: codeStart, end: i };
      const j = scanCommentEnd(src, i);
      yield { kind: 'comment', start: i, end: j };
      i = j;
      codeStart = i;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (codeStart < i) yield { kind: 'code', start: codeStart, end: i };
      const j = scanStringEnd(src, i);
      yield { kind: 'string', start: i, end: j };
      i = j;
      codeStart = i;
      continue;
    }
    i += 1;
  }
  if (codeStart < src.length) yield { kind: 'code', start: codeStart, end: src.length };
}

// Physical-line records with lexical context:
//   { start, end, depth, inString }
// `depth` is the bracket depth where the line starts (clamped at 0, brackets
// counted only in code); `inString` marks lines that begin inside a string
// literal. Comments contribute nothing to depth.
export function lineRecords(src) {
  const recs = [];
  let lineStart = 0;
  let lineDepth = 0;
  let lineInString = false;
  let d = 0;
  const endLine = (endIdx, nextInString) => {
    recs.push({ start: lineStart, end: endIdx, depth: lineDepth, inString: lineInString });
    lineStart = endIdx + 1;
    lineDepth = d;
    lineInString = nextInString;
  };
  for (const region of walkRegions(src)) {
    if (region.kind === 'comment') continue;
    if (region.kind === 'string') {
      let k = src.indexOf('\n', region.start);
      while (k !== -1 && k < region.end) { endLine(k, true); k = src.indexOf('\n', k + 1); }
      continue;
    }
    for (let i = region.start; i < region.end; i += 1) {
      const ch = src[i];
      if (ch === '\n') { endLine(i, false); continue; }
      if (ch === '(' || ch === '[' || ch === '{') d += 1;
      else if (ch === ')' || ch === ']' || ch === '}') d = Math.max(0, d - 1);
    }
  }
  if (lineStart < src.length) recs.push({ start: lineStart, end: src.length, depth: lineDepth, inString: lineInString });
  return recs;
}
