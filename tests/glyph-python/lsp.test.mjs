import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ρ = new URL('../..', import.meta.url).pathname;
const Υ = join(ρ, 'bin/gpy.mjs');

function μframe(msg) {
  const body = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function μparse(buffer) {
  const out = [];
  let text = buffer.text;
  for (;;) {
    const m = text.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!m) break;
    const start = m.index + m[0].length;
    const len = Number(m[1]);
    if (Buffer.byteLength(text) < start + len) break;
    const body = Buffer.from(text).subarray(start, start + len).toString();
    out.push(JSON.parse(body));
    text = Buffer.from(text).subarray(start + len).toString();
  }
  return out;
}

function μwaitFor(buffer, pred, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      const found = μparse(buffer).find(pred);
      if (found) {
        clearInterval(poll);
        resolve(found);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        reject(new Error(`timeout; messages: ${JSON.stringify(μparse(buffer))}`));
      }
    }, 50);
  });
}

async function τ(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

await τ('Υ lsp publishes remapped diagnostics on didOpen and clears on fix', async () => {
  const proc = spawn(process.execPath, [Υ, 'lsp'], { cwd: ρ });
  const buffer = { text: '' };
  proc.stdout.on('data', (d) => { buffer.text += d; });
  try {
    proc.stdin.write(μframe({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: {} } }));
    const init = await μwaitFor(buffer, (m) => m.id === 1);
    assert.ok(init.result.capabilities.textDocumentSync);

    proc.stdin.write(μframe({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: { textDocument: { uri: 'file:///tmp/bad.gpy', languageId: 'glyphpython', version: 1, text: 'λ bad(:\n    ⊢ 1\n' } },
    }));
    const diag = await μwaitFor(buffer, (m) => m.method === 'textDocument/publishDiagnostics' && m.params.diagnostics.length > 0);
    assert.equal(diag.params.uri, 'file:///tmp/bad.gpy');
    assert.match(diag.params.diagnostics[0].message, /SyntaxError|invalid syntax/);
    assert.equal(diag.params.diagnostics[0].range.start.line, 0);

    proc.stdin.write(μframe({
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: { textDocument: { uri: 'file:///tmp/bad.gpy', version: 2 }, contentChanges: [{ text: 'λ φ():\n    ⊢ 1\n' }] },
    }));
    await μwaitFor(buffer, (m) => m.method === 'textDocument/publishDiagnostics' && m.params.diagnostics.length === 0);
  } finally {
    proc.kill('SIGTERM');
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy lsp tests: 1 passed, 0 failed');
