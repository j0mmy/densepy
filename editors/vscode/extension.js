const { LanguageClient } = require('vscode-languageclient/node');

let client;

function activate() {
  client = new LanguageClient(
    'gpy',
    'GlyphPython',
    { command: 'gpy', args: ['lsp'] },
    { documentSelector: [{ scheme: 'file', language: 'glyphpython' }] },
  );
  client.start();
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
