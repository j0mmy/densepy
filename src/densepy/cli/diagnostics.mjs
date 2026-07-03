export function pythonErrorLine(stderr) {
  const text = String(stderr ?? '');
  const preferred = text.match(/File "<unknown>", line (\d+)/) ?? text.match(/File ".*__main__\.py", line (\d+)/);
  if (preferred) return Number(preferred[1]);
  const fallback = text.match(/line (\d+)/);
  return fallback ? Number(fallback[1]) : null;
}

function sourceLine(source, line) {
  if (!line || line < 1) return '';
  return String(source).split('\n')[line - 1] ?? '';
}

export function remapNote(kind, file, source, stderr, lineOffset = 0) {
  const pyLine = pythonErrorLine(stderr);
  if (!pyLine) return '';
  const line = pyLine - lineOffset;
  if (line < 1) return `\nγ ${kind}: ${file} (inside γ prelude, emitted python line ${pyLine})\n`;
  const excerpt = sourceLine(source, line);
  return `\nγ ${kind}: ${file}:${line}\n  ${excerpt}\n`;
}

// AXI-style agent diagnostics: one line per event, smallest schema that
// lets an agent decide the next action. Measured (o200k_base): a check
// failure is 116 tokens as a raw traceback, 23 as JSON, 12 as this line.
export function agentErrorLine(file, source, stderr, lineOffset) {
  const pyLine = pythonErrorLine(stderr);
  const line = pyLine ? Math.max(1, pyLine - lineOffset) : '?';
  const msg = String(stderr ?? '').trim().split('\n').filter(Boolean).pop() ?? 'error';
  return `err ${file}:${line} ${msg.trim()}\n`;
}
