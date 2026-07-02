# GlyphPython

GlyphPython is a small Python-backed glyph syntax compiler and CLI.

```text
.gpy source -> GlyphPython compiler -> ordinary .py -> python3
```

The goal is practical language tooling: compile, run, check, test, format, lint, and package `.gpy` projects while keeping Python's runtime and ecosystem intact.

## Install

From a fresh checkout (requires Node >= 20 and Python >= 3.11):

```bash
npm link        # makes `gpy` available on PATH
gpy --version   # gpy 0.1.0
```

Or run without installing: `node bin/gpy.mjs <command>`.

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
node bin/gpy.mjs deps add <package> [version] [--no-install]
node bin/gpy.mjs deps install
node bin/gpy.mjs deps list
node bin/gpy.mjs deps check <package>
node bin/gpy.mjs watch [file.gpy]
node bin/gpy.mjs repl
node bin/gpy.mjs lsp
node bin/gpy.mjs check <file.gpy> --types
node bin/gpy.mjs --version
```

The full language reference (glyph tables, macro grammar, identifier rules,
known limits, measured token density) lives in `docs/GLYPH_SPEC.md`.

## Project workflow

Real multi-module projects, driven by `gpy.toml`:

```bash
gpy init my-app --name my-app
cd my-app
gpy deps install            # creates .venv (uv preferred, stdlib venv fallback)
gpy deps add requests       # writes gpy.toml AND installs into .venv
gpy run                     # builds src/**/*.gpy -> build/py, runs [gpy].main
gpy build                   # compile everything without running
gpy watch                   # re-check the whole project on every save
```

Modules import each other with normal Python imports: `from helper import φ`
where `src/helper.gpy` exists. Runtime tracebacks remap every project frame
back to `.gpy` sources. A working multi-module HTTP backend lives in
`examples/glyph-python/webapp` (run `gpy run` inside it).

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

## Macros

Beyond token aliases, symbolic macro forms lower to Python:

```text
Σ(x∈xs) expr       -> sum((expr) for x in xs)
Π(x∈xs) expr       -> math.prod((expr) for x in xs)   # math import auto-injected
π(x∈xs|pred) expr  -> [(expr) for x in xs if pred]
(f∘g)(x)           -> f(g(x))
```

Known limit (v1): macro bodies and guards must not contain commas or
nested parentheses — the rewriter is regex-based. Use a plain
comprehension (`[f(ρ) ∀ ρ ∈ rows]`) for anything more complex.

## Stdlib facades

Using any of these names injects a small Python prelude into the emitted
file (names inside strings/comments do not trigger it):

```text
File.read/write        pathlib-backed text IO
JSON.loads/dumps/read/write
Path.join/exists/name  (alias Ρθ)
HTTP.get_text          urllib
CSV.read/write         csv DictReader/DictWriter
Table.read_csv         pandas facade (alias Πδ); clear error if pandas missing
```

F-strings work: literal text stays literal, glyphs inside `{...}`
expressions compile (`f"doubled: {ν × 2}"`), format specs and `{{ }}`
escapes are preserved.

A real-world example combining CSV, File, Σ, and π:

```bash
node bin/gpy.mjs run examples/glyph-python/csv-report.gpy   # needs scores.csv in cwd
```

## Editor support

VS Code syntax highlighting + live diagnostics for `.gpy`:

```bash
cd editors/vscode && npm install && cd -
ln -s "$(pwd)/editors/vscode" ~/.vscode/extensions/glyphpython-vscode
```

Then reload VS Code. Highlighting works immediately (grammar is
test-enforced to cover every compiler glyph). Diagnostics come from
`gpy lsp` — a zero-dependency language server the extension launches;
it requires `gpy` on PATH (`npm link` from the repo root).

## Security posture

GlyphPython compiles to ordinary Python and runs on your `python3` —
the runtime is **not sandboxed**. A `.gpy` program can do anything a
Python program can (files, network, subprocesses). `gpy check` parses
but never executes user code; `gpy run` executes it with your
permissions. Review code you did not write before running it.

## Repository map

```text
bin/gpy.mjs                         CLI
src/glyph-python/γpy.mjs            compiler/runtime helpers
src/glyph-python/lsp.mjs            language server (diagnostics)
examples/glyph-python/*.gpy         runnable examples
examples/glyph-python/webapp/       multi-module HTTP backend project
tests/glyph-python/*.test.mjs       executable tests
editors/vscode/                     VS Code extension (grammar + LSP client)
.github/workflows/ci.yml            CI (ubuntu + macos)
CHANGELOG.md                        release notes
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
