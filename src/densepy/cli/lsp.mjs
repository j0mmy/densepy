import { γlspServe } from '../lsp.mjs';

// Returns null: the LSP server owns the process from here.
export function cmdLsp() {
  γlspServe(process.stdin, process.stdout);
  return null;
}
