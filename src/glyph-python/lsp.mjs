import { γcompileWithMap, γcheck } from './γpy.mjs';

// Minimal LSP server: Content-Length framed JSON-RPC over stdio.
// Diagnostics come from γcheck (ast.parse, never executes user code),
// remapped through the compile lineOffset back to .gpy coordinates.

function γlspDiagnostics(text) {
  const { lineOffset } = γcompileWithMap(text);
  const check = γcheck(text);
  if ((check.status ?? 1) === 0) return [];
  const stderr = String(check.stderr ?? '');
  const lineMatch = stderr.match(/File "<unknown>", line (\d+)/) ?? stderr.match(/line (\d+)/);
  const pyLine = lineMatch ? Number(lineMatch[1]) : 1;
  const line = Math.max(0, pyLine - lineOffset - 1);
  const messageLine = stderr.trim().split('\n').filter(Boolean).pop() ?? 'syntax error';
  return [{
    range: {
      start: { line, character: 0 },
      end: { line, character: 200 },
    },
    severity: 1,
    source: 'gpy',
    message: messageLine,
  }];
}

export function γlspServe(input, output) {
  let pending = Buffer.alloc(0);

  const send = (msg) => {
    const body = JSON.stringify(msg);
    output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  };

  const publish = (uri, text) => {
    send({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: { uri, diagnostics: γlspDiagnostics(text) },
    });
  };

  const handle = (msg) => {
    if (msg.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          capabilities: { textDocumentSync: 1 },
          serverInfo: { name: 'gpy-lsp' },
        },
      });
      return;
    }
    if (msg.method === 'textDocument/didOpen') {
      publish(msg.params.textDocument.uri, msg.params.textDocument.text);
      return;
    }
    if (msg.method === 'textDocument/didChange') {
      const change = msg.params.contentChanges[msg.params.contentChanges.length - 1];
      publish(msg.params.textDocument.uri, change.text);
      return;
    }
    if (msg.method === 'shutdown') {
      send({ jsonrpc: '2.0', id: msg.id, result: null });
      return;
    }
    if (msg.method === 'exit') {
      process.exit(0);
    }
    if (msg.id !== undefined) {
      send({ jsonrpc: '2.0', id: msg.id, result: null });
    }
  };

  input.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      const headerEnd = pending.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = pending.subarray(0, headerEnd).toString();
      const lengthMatch = header.match(/Content-Length: (\d+)/i);
      if (!lengthMatch) {
        pending = pending.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(lengthMatch[1]);
      const start = headerEnd + 4;
      if (pending.length < start + length) return;
      const body = pending.subarray(start, start + length).toString();
      pending = pending.subarray(start + length);
      try {
        handle(JSON.parse(body));
      } catch {
        // Malformed message: skip; framing already advanced.
      }
    }
  });
}
