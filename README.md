# GlyphPython

GlyphPython is a small Python-backed glyph syntax compiler and CLI.

```text
.gpy source -> GlyphPython compiler -> ordinary .py -> python3
```

The goal is practical language tooling: compile, run, check, test, format, lint, and package `.gpy` projects while keeping Python's runtime and ecosystem intact.

## Quick start

```bash
npm test
node bin/gpy.mjs run examples/glyph-python/factorial.gpy
node bin/gpy.mjs build examples/glyph-python/factorial.gpy -o /tmp/factorial.py
python3 /tmp/factorial.py
```

Expected output for the factorial example:

```text
720
```

## CLI

```bash
node bin/gpy.mjs build <file.gpy> [-o out.py] [--map file.map.json]
node bin/gpy.mjs run <file.gpy> [-- args...]
node bin/gpy.mjs check <file.gpy> [--show-py]
node bin/gpy.mjs test [dir]
node bin/gpy.mjs fmt [--check] <file.gpy>
node bin/gpy.mjs lint <file.gpy>
node bin/gpy.mjs init [dir] [--name name]
node bin/gpy.mjs deps add <package> [version]
node bin/gpy.mjs deps list
node bin/gpy.mjs deps check <package>
```

If installed through npm, the same commands are available as `gpy ...`.

## Tiny example

```text
λ φ(ν):
    ⎇ ν ≤ 1:
        ⊢ 1
    ∴:
        ⊢ ν × φ(ν − 1)

☉(φ(6))
```

Compiles to normal Python using aliases such as:

```text
λ -> def
⎇ -> if
∴ -> else
⊢ -> return
☉ -> print
≤ -> <=
× -> *
− -> -
```

## Repository map

```text
bin/gpy.mjs                         CLI
src/glyph-python/γpy.mjs            compiler/runtime helpers
examples/glyph-python/*.gpy         runnable examples
tests/glyph-python/*.test.mjs       executable tests
docs/GLYPHPYTHON_ROADMAP.md         buildout roadmap
AGENTS.md                           contributor/agent rules
```

## Working with Fable 5 or another coding model

Use a narrow compiler-tooling prompt:

```text
We are working on GlyphPython, a legitimate Python-backed programming-language frontend. Scope: parser/compiler behavior, CLI, diagnostics, source maps, formatter/linter, stdlib facades, tests, docs, and packaging. Keep Python/Node/package/API boundaries stable. Keep changes focused on `.gpy -> .py` tooling. Verify with npm test and a direct gpy example run.
```

## Development rule

Compiler behavior should be changed test-first:

1. Add or update the smallest failing test.
2. Run the focused test and see it fail for the expected reason.
3. Implement the smallest fix.
4. Run the focused test.
5. Run `npm test`.
