# GlyphPython Language Specification (v0.3)

The canonical reference for writing correct `.gpy` first try. GlyphPython is
a glyph authoring surface over Python: everything Python can do is available;
glyphs and macro forms replace common keywords and aggregate patterns.

## Design intent and an honest density note

GlyphPython is designed agent-first: compact symbolic forms with predicate
logic operators. Measured with `scripts/density.gpy` (o200k_base BPE):
glyph source is ~10% fewer characters but **~1.35× more tokens** than
equivalent Python, because BPE tokenizers split rare Unicode glyphs into
multiple tokens while `def`/`return`/`if` are single tokens. Macro forms
score best (Σ/π ≈ 1.10× — structural compression nearly offsets glyph cost).
Claims of token savings on current tokenizers are therefore **false**; the
value of the surface is its unambiguous, regular structure and the macro
layer, not raw token economy.

## Word glyphs

| γ | Python | | γ | Python |
|---|---|---|---|---|
| λ | def | | ⊤ | True |
| ⎇ | if | | ⊥ | False |
| ∴ | else | | ∅ | None |
| ∴ ⎇ | elif | | ∧ | and |
| ↻ | while | | ∨ | or |
| ∀ | for | | ¬ | not |
| ∈ | in | | ☉ | print |
| ⊢ | return | | | |

`⎇` also serves as the comprehension/ternary `if`: `[χ ∀ χ ∈ ξ ⎇ χ > 0]`.
`∴ ⎇` (else + if, whitespace allowed between) lowers to `elif`.

## Operator glyphs

| γ | Python | | γ | Python |
|---|---|---|---|---|
| ≔ | = | | ≥ | >= |
| ≅ | == | | × | * |
| ≠ | != | | ÷ | / |
| ≤ | <= | | − | - |

## Numeral glyphs

Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ Ⅵ Ⅶ Ⅷ Ⅸ Ⅹ Ⅺ Ⅻ → 1–12.

## Identifier rule

λ and the Roman numerals are valid Python identifier characters. When
preceded by an identifier character they are part of the identifier, not a
keyword: `Tλ` is a variable named Tλ; `T λ` is `T def`. Identifiers must not
*start* with a numeral glyph. Symbol glyphs (∧ ∨ ¬ ∈ …) never join
identifiers, so `a∧b` compiles to `a and b`.

## Macros (v2 — paren-aware)

```text
Σ(v∈iter)        body   -> sum((body) for v in iter)
Σ(v∈iter|guard)  body   -> sum((body) for v in iter if guard)
Π(v∈iter[|guard]) body  -> math.prod(...)        # import math auto-injected
π(v∈iter[|guard]) body  -> [(body) for v in iter[ if guard]]
(f∘g∘h)(args)           -> f(g(h(args)))
```

Bodies, guards, and iterables may contain calls, commas, strings, subscripts,
and nested macros. Body extent: a balanced expression ending at a top-level
newline, `,`, `#`, or closing bracket. Composition requires an immediate call
and simple identifier names.

Not lowered: a macro glyph preceded by an identifier character (`xπ(…)`),
or composition without an immediate call (`h = f∘g`).

## Strings and f-strings

Plain strings and comments are never rewritten. In f-strings, literal text,
`{{ }}` escapes, and format specs (after the top-level `:`) stay raw; glyphs
inside `{…}` expressions compile; nested f-strings compile recursively.
Caveat: a dict literal inside an f-string expression treats its first `:` as
a format-spec separator — hoist it to a variable.

## Stdlib facades

Using File / JSON / Path (Ρθ) / HTTP / CSV / Table (Πδ) in code injects a
Python prelude into the emitted file (never triggered from strings or
comments). Table requires pandas and raises a clear ImportError otherwise.
Diagnostics subtract injected prelude lines automatically.

## Projects

```toml
# gpy.toml
[project]
name = "app"
python = ">=3.11"

[dependencies]
requests = ">=2.31"

[gpy]
source = "src"
emit = "build/py"
main = "src/main.gpy"
```

Modules import each other with plain Python imports (`from helper import φ`
for `src/helper.gpy`). Module names must stay ASCII at the import boundary.

## CLI

```text
gpy run [file] [-- args]   compile+run file, or whole project via gpy.toml
gpy build [file] [-o out]  emit Python (project mode with no file)
gpy check <file> [--show-py] [--types]   parse check; --types runs pyright/mypy remapped
gpy test [dir]             run .gpy tests (exit code = failures)
gpy fmt [--check] [file]   format file or whole project
gpy lint [file]            style + host-boundary + capability lint
gpy watch [file]           re-check on save
gpy repl                   interactive glyph REPL
gpy lsp                    LSP server (diagnostics)
gpy deps install|add|list|check   .venv management, real installs
gpy init [dir]             new project
```

## Security posture

The runtime is unsandboxed Python. `gpy check` and `gpy lsp` never execute
user code; `gpy run/test/repl` do, with your permissions. `gpy lint` flags
capabilities: process execution, network access, file writes, dynamic code
execution (`eval`/`exec`).

## Known limits

- Format-spec `:` inside f-string dict-literal expressions (hoist instead).
- Composition (`∘`) needs identifier-only chains and an immediate call.
- Identifiers must not start with numeral glyphs.
- Glyph token cost exceeds Python keywords on current BPE tokenizers (see
  density note above).
