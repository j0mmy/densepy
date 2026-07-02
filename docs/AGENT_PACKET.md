# DensePy agent packet

Load this into context to author correct DensePy (.gpy) first try.
DensePy = Python semantics, token-minimized surface. Anything valid in
Python is valid here; dense forms lower to Python at compile.

## Dense forms

```text
fn name(args)=expr        -> def name(args): return expr
fn name(args):            -> def name(args):
sum[v:iter|guard] body    -> sum((body) for v in iter if guard)
prod[v:iter] body         -> math.prod(...)  (math auto-imported)
sel[v:iter|guard] body    -> [(body) for v in iter if guard]
any[v:iter] body / all[v:iter] body
```

## Style (canonical; `gpy fmt --dense` enforces)

- Tight spacing: `x%2==0`, `f(a,b)`, `return"A"`, `in[1,2]` — space kept
  only between two identifier/keyword characters (`if x`, `not y`).
- 1-space indent per block level.
- Single simple statement collapses onto its header: `if x>0:return x`.
- No blank lines.

## Rules

- Aggregates lower ONLY when a body expression follows `]`; `sum[a:b]`
  with no body is a normal slice. Header var must be a bare identifier.
- `fn` lowers only at statement start followed by `name(`.
- First top-level `|` in the header splits iter|guard — parenthesize
  bitwise-or in iterables.
- Strings/comments/f-string literal text are never rewritten; glyph forms
  (λ ⎇ ∴ ↻ ∀ ∈ ⊢ ☉ Σ Π π ≔ ≅ ≤ ≥ × ÷ −, ∴⎇=elif) also compile but cost
  MORE tokens — prefer dense ASCII.

## Toolchain

```text
gpy run [file] [-- args]     run file or project (gpy.toml: source/emit/main)
gpy build / check [--types] / test / fmt --dense / lint / watch / repl / lsp
gpy deps install|add|list|check    .venv + real installs
```

## Diagnostics: always pass --agent

`check|run|lint --agent` emit one line per event (AXI-style; 12 tokens vs
116 for a raw traceback):

```text
ok <file>
err <file>:<line> <message>      # exit code != 0
warn <file>:<line> <message>
```

Program stdout is never touched; only error/report channels compact.

Modules: plain Python imports between .gpy files in src/. Tracebacks and
diagnostics point at .gpy lines. Runtime = unsandboxed Python; lint flags
process/network/write/eval capabilities.

## Measured (o200k_base)

Dense surface 0.84× Python tokens; + fmt --dense canonical style ≈ 0.74×
total on block-structured code. Glyph surface 1.35× (legacy).
