# Changelog

## 0.10.0 — 2026-07-02

- `try[expr]default` / `try[expr|ExcType]default`: expression-position
  fallback, 9 tokens vs 13 for try/except. Both expr and default are lazy
  (default only evaluates on failure); typed form catches one exception,
  others propagate. Runtime helper `_dp_try` injected on use.
- `gpy run --safe`: runtime capability sandbox via a PEP-578 audit hook
  (src/densepy/runtime/safe_guard.py) — blocks subprocess, network, and
  file writes before user code runs. Defense-in-depth for machine-written
  code; installed out-of-band so diagnostics line up.

## 0.9.0 — 2026-07-02

- `data[Name f1,f2=dflt]` records: 8 tokens vs 21 (tight dataclass) vs 71
  (plain class), measured. Single-line lowering keeps diagnostics aligned;
  default_factory makes mutable defaults safe by construction.
- `gpy pack [files] [--packet]`: emit the project as one agent-ready
  context blob with token accounting on stderr — context loading as a
  first-class command.

## 0.8.1 — 2026-07-02

- Fix: real dependency installs on machines with uv — uv-created venvs
  ship without pip, so installs now go through `uv pip --python <venv>`
  (stdlib-venv fallback keeps `-m pip`). Found by the new host-interop
  test, which installs a real PyPI package into a project venv and uses
  it from .gpy (`npm run interop`; runs in CI).
- Fix: `gpy test` now uses the project venv python like run/check/watch.
- Fix: `gpy fmt` no longer mistakes single-dash flags for filenames.
- CI: python 3.11/3.12/3.13 matrix; selfhost bootstrap and interop run
  on every push. docs/SPEC.md carries a version + stability promise.

## 0.8.0 — 2026-07-02

A Philosophy of Software Design pass — zero behavior change, verified
byte-identical compiler output via the selfhost differential.

- Deep module: src/densepy/walk.mjs owns ALL string/comment/f-string/
  bracket-depth mechanics behind a 10-export interface; the five scanners
  that each re-implemented quote rules now consume it.
- CLI: bin/gpy.mjs is a 35-line dispatcher over src/densepy/cli/
  per-command modules.
- Obscurity removed: toolchain internals renamed to descriptive English
  (compileWithSourceMap, densify, lintSource, facadePrelude, ...);
  the DensePy language surface is unchanged.
- Known oddities preserved deliberately and documented (gpy test ignores
  project venv; fmt/init ad-hoc arg scans) — queued as fixes, not snuck in.

## 0.7.0 — 2026-07-02

DensePy compiles itself.

- Self-hosting: selfhost/src/compiler.gpy is a DensePy→Python compiler
  written in DensePy (298 lines, ~3.9k tokens, canonical dense style,
  lint-clean). `npm run selfhost` proves the full bootstrap: 30/30 corpus
  programs byte-identical to the JS compiler's output, and gen1==gen2 —
  a byte-identical self-compilation fixpoint. Built by a Fable-tier agent.
- Rename: internals are now densepy (src/densepy/compiler.mjs,
  tests/densepy/, examples/densepy/, docs/SPEC.md, docs/ROADMAP.md);
  history preserved via git mv. CLI stays `gpy`, sources stay `.gpy`.
- Lint honesty: capability/style rules no longer fire inside string
  literals (string contents blanked before matching; open()-mode check
  anchors on code). Removed the escape-sequence workaround the bootstrap
  agent had used to silence string-content lint.

## 0.6.3 — 2026-07-02

- Fix: aggregate bodies stop at a top-level `:` — `if all[x:xs]x>0:...`
  compiles. Found by the compound chess-engine benchmark (the DensePy
  agent's mate-2 search used exactly this form; 0/8 -> 8/8 after fix).
  Parenthesize aggregates used mid-ternary.

## 0.6.1 — 2026-07-02

- Fix: `gpy run` now forwards stdin to the program (file and project
  modes). Found by the sonnet A/B benchmark — the JSON-parser task was
  the first stdin-reading program ever run under gpy.

## 0.6.0 — 2026-07-02

AXI-style agent diagnostics.

- `check|run|lint --agent`: one line per event — `ok <file>`,
  `err <file>:<line> <message>`, `warn <file>:<line> <message>`.
  Raw Python tracebacks suppressed; program stdout untouched.
  Measured (o200k_base): a check failure costs 116 tokens as a raw
  traceback, 23 as JSON, 12 as an agent line.
- AGENT_PACKET.md documents the grammar ("always pass --agent");
  packet is 661 tokens.

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
