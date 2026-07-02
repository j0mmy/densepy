# Changelog

## 0.5.0 — 2026-07-02

DensePy: agents-only rebrand + token-minimizing canonical form.

- Renamed to DensePy: a language made only for agents, not
  human-optimized. Glyph surface demoted to legacy (still compiles).
- `gpy fmt --dense`: semantics-preserving token minimizer — tight
  spacing (space survives only between identifier chars), 1-space
  indents, single-statement block collapse (`if x>0:return x`), blank
  lines stripped; strings/comments/continuation lines untouched;
  idempotent. Grade fixture: 54 → 40 tokens (−26%).
- docs/AGENT_PACKET.md: 574-token context packet that teaches an agent
  the whole language; README repositioned around measured numbers.

## 0.4.0 — 2026-07-02

Dense ASCII surface: token economy delivered.

- New dense forms, every spelling chosen by measured BPE cost:
  `fn name(args) = expr` (expression-bodied def), `fn name(args):` blocks,
  and `sum[v:iter|guard] body` / `prod[...]` / `sel[...]` / `any[...]` /
  `all[...]` aggregates.
- Measured result (o200k_base): dense surface = **0.84× Python tokens**
  overall (prod 0.69×), vs glyph surface 1.35×. Dense is now the
  recommended agent-authoring surface; glyph mode coexists in the same file.
- Unambiguity: aggregates lower only when a body expression follows `]`
  (invalid Python after a subscript) — real slices/subscripts untouched;
  `fn`-named variables untouched. Pipeline `|>` measured and rejected
  (loses tokens to nested calls).
- Grammar highlights dense keywords; spec gains a dense-surface section.

## 0.3.0 — 2026-07-02

Language-completeness milestone driven by stress-testing.

- `∴ ⎇` lowers to `elif` (multi-branch chains no longer need nesting).
- Nested f-strings compile at every depth.
- Macro engine v2: paren-aware, string-protecting scanner — Σ/Π/π bodies,
  guards, and iterables may contain calls, commas, strings, and nested
  macros; guards now work on Σ/Π; ∘ composition supports chains and
  multi-arg calls.
- Identifier rule: λ / numeral glyphs preceded by an identifier char are
  part of the identifier (`Tλ` stays `Tλ`); adjacent symbol glyphs (`a∧b`)
  still compile.
- Project-wide `gpy fmt` / `gpy lint` (no-file mode).
- Capability lint: process execution, network access, file writes,
  dynamic code execution.
- `gpy check --types`: pyright/mypy handoff with lines remapped to `.gpy`
  (GPY_TYPECHECKER override supported).
- `gpy repl`: interactive glyph REPL (codeop-based driver, facades and
  math preloaded).
- `scripts/density.gpy` + docs/GLYPH_SPEC.md: measured token density —
  glyph source is ~1.35× MORE BPE tokens than equivalent Python despite
  fewer characters; macro forms ≈1.10×. Documented honestly in the spec.

## 0.2.0 — 2026-07-02

Production milestone: multi-module projects, environments, live tooling.

- Module system: `gpy build` / `gpy run` with no file compile the whole
  `[gpy].source` tree to `[gpy].emit` and run the `[gpy].main` entrypoint;
  cross-module imports work.
- Dependencies: `gpy deps install` creates `.venv` (uv preferred, stdlib
  venv fallback) and installs manifest deps; `gpy deps add` installs too
  (`--no-install` to skip); `gpy run` / `deps check` prefer the venv python.
- Diagnostics: project-mode tracebacks remap every frame to `.gpy` sources.
- `gpy watch`: re-checks file or project on save with remapped diagnostics.
- `gpy lsp`: zero-dependency LSP server (framed JSON-RPC/stdio) publishing
  syntax diagnostics; VS Code extension client wired in `editors/vscode`.
- CI: GitHub Actions workflow (ubuntu + macos, Node 20, Python 3.12).

## 0.1.0 — 2026-07-01

First production-hardened cut of the single-file toolchain.

- Compiler correctness: f-string `{…}` expressions compile; facade prelude
  injection is code-scoped; diagnostics account for injected prelude lines.
- Conformance suite: γ programs verified byte-identical against plain-Python
  baselines.
- `gpy --version`; VS Code syntax highlighting with grammar-sync test.
- Dogfood example `csv-report.gpy`; documented security posture
  (unsandboxed Python runtime; `check` never executes user code).
