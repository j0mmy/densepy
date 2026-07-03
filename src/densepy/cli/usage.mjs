export function printUsage() {
  console.log(`Usage:
  node bin/gpy.mjs build <file.gpy> [-o out.py]
  node bin/gpy.mjs run <file.gpy> [--agent] [--safe] [-- args...]
  node bin/gpy.mjs check <file.gpy> [--show-py] [--types] [--agent]
  node bin/gpy.mjs test [dir]
  node bin/gpy.mjs fmt [--check] [file.gpy]
  node bin/gpy.mjs watch [file.gpy]
  node bin/gpy.mjs repl
  node bin/gpy.mjs lsp
  node bin/gpy.mjs lint [file.gpy] [--agent]
  node bin/gpy.mjs init [dir] [--name name]
  node bin/gpy.mjs deps add <package> [version] [--no-install]
  node bin/gpy.mjs deps install
  node bin/gpy.mjs deps list
  node bin/gpy.mjs deps check <package>
  node bin/gpy.mjs pack [files...] [--packet]
`);
}

export function badUsage() {
  printUsage();
  return 2;
}
