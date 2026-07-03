import { serveLsp } from '../lsp.mjs';

// Returns null: the LSP server owns the process from here.
export function cmdLsp() {
  serveLsp(process.stdin, process.stdout);
  return null;
}
