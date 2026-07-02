const { LanguageClient } = require('vscode-languageclient/node');

let client;

function activate() {
  client = new LanguageClient(
    'gpy',
    'DensePy',
    { command: 'gpy', args: ['lsp'] },
    { documentSelector: [{ scheme: 'file', language: 'densepy' }] },
  );
  client.start();
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
