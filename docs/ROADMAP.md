# GlyphPython Production Roadmap

> **For Hermes:** Use subagent-driven-development + test-driven-development for implementation. Keep internal artifacts γ-first where practical, but preserve host-forced Python/Node/package boundaries.

**Goal:** Turn GlyphPython from a token-alias proof into a production-usable glyph-swapped Python surface with reliable compilation, diagnostics, packages, tooling, tests, editor support, and deployment workflows.

**Architecture:** GlyphPython remains Python-backed: `.gpy → γ-aware compiler → `.py`/AST/bytecode → `python3`. The compiler must protect strings/comments/imports, preserve line/source mapping, and gradually add γ-native facades/macros over normal Python libraries. Python stays the runtime; GlyphPython owns the authoring surface.

**Shape:** `lexical correctness → CLI/tooling → diagnostics → macros → stdlib facades → project/package workflow → editor/dev UX → conformance/security → production release`.

---

## North star

GlyphPython should let JT write production scripts and small services in a glyph-native style while still using Python’s ecosystem. The finished system should feel like this:

```text
gpy new ops-tool
cd ops-tool
Υ add requests rich pydantic
Υ run src/main.gpy
Υ test
Υ build --emit py --source-map
```

The code body should be γ-native; library edges stay valid Python or are wrapped behind γ facades:

```text
import json
from pathlib import Path as Ρθ

Δ ≔ JSON.read("policy.json")
Ω ≔ π(υ∈Δ.users | υ.active ∧ υ.role ∈ Δ.allowed) υ.name
☉("allow:" + ",".join(Ω))
```

---

## Glyph prompt / intent packet

This is the compressed prompt Hermes should translate into concrete harness tasks and TDD implementation slices:

```text
∇GPYμ
N: GlyphPython→prod; py-runtime≔λ; γ-surface≔authoring; EN⇔JT-boundary
K={LEX,PARSE,MAP,CLI,DIAG,MACRO,STD,PKG,TEST,FMT,LSP,SEC,REL,DOG}
Law:∀artifact(project-owned∧¬host-forced)⇒γ↑;∀host(API|pkg|schema|CLI)⇒λ-stable;foreign λ→γfacade→γbody

x*=argmax(useful_prod−tool_break−debug_cost−semantic_lie)
Tie:exec_pass≻diag_clarity≻stdlib_reach≻γ_density≻portability

E:min(
 GPY001 done→
 GPY002 CLI v1→GPY003 tokenizer/source-map→GPY004 diagnostics→
 GPY005 macro engine(ΣΠπ∀)→GPY006 stdfacade(File/JSON/Path/HTTP/CSV/Table)→
 GPY007 deps/project(Υ/gpy.toml/uv|pip)→GPY008 formatter/linter→
 GPY009 test runner/conformance→GPY010 editor/LSP→
 GPY011 security/capability policy→GPY012 packaging/release→
 DOG001 real ops scripts→DOG002 parser/compiler dogfood→Ω
)

Gates:
∀slice: RED→GREEN→REFACTOR→focused gate→npm test
∀compile: strings/comments/imports preserved; py_compile pass; runtime output match; source map present if emitted
∀prod: docs command executed; no fake portability; unsupported target/lib ⇒ explicit error
Ω: JT can write/run/test/package real .gpy projects with Python libs and readable γ diagnostics.
```

---

## Phase map

| Phase | Outcome | Primary tasks |
|---|---|---|
| P0 | Current proof | `GPY001` token aliases, factorial, JSON/file fixture |
| P1 | Trustworthy compiler core | tokenizer-aware rewriting, source spans, source maps, compile/run/check behavior |
| P2 | Usable CLI | `gpy run/build/check/test/fmt`, stable exit codes, docs verified |
| P3 | Debuggable language | syntax/runtime traceback remapping, emitted Python excerpts, γ source excerpts |
| P4 | Expressive γ layer | macros: `Σ`, `Π`, `π`, `∀`, pipeline/composition, safe rewrites outside strings/comments |
| P5 | Stdlib facades | γ wrappers for File, JSON, Path, HTTP, CSV, Table, Regex, Time, Env |
| P6 | Project/dependency workflow | `gpy.toml`, `uv`/`pip` integration, project templates, lockfile policy |
| P7 | Quality tooling | formatter, linter, type-check handoff, conformance matrix, benchmark suite |
| P8 | Dev UX | VS Code/TextMate grammar, LSP diagnostics, watch mode, REPL |
| P9 | Production hardening | security/capabilities, packaging, CI templates, release artifacts |
| P10 | Dogfood | real JT utility scripts, compiler tooling pieces, maybe services/CLIs |

---

## Feature suite

### GPY002 — CLI v1

`gpy` should be a real tool, not only `node bin/gpy.mjs`.

Commands:

```bash
gpy run file.gpy
gpy build file.gpy -o file.py
gpy check file.gpy
gpy test
gpy fmt file.gpy
gpy emit-map file.gpy
```

Acceptance:

```text
run executes through python3 and preserves argv/cwd/env
build writes valid .py
check uses Python parse/py_compile without running user code
all commands have stable exit codes
README commands are executed exactly as written
```

### GPY003 — tokenizer/source-map compiler core

Current GPY001 rewrites character-by-character. Production needs a safer lexical pipeline.

Features:

```text
protect strings/comments/triple strings/f-strings/bytes/raw strings
preserve imports/public APIs
emit source map: .gpy span ↔ .py span
track line/column through replacements
snapshot emitted Python for fixtures
```

Acceptance:

```text
complicated string/comment/import fixtures compile cleanly
line count preservation where possible
source map JSON validates against schema
generated Python passes ast.parse/py_compile
```

### GPY004 — diagnostics and traceback remap

Features:

```text
compile-time syntax diagnostics with γ excerpt
Python SyntaxError remapped to .gpy line/column
runtime traceback remapped best-effort
secondary emitted-Python location shown
--show-py escape hatch
```

Acceptance:

```text
bad syntax points to .gpy source
runtime division-by-zero points to .gpy frame
import errors preserve Python module names
```

### GPY005 — macro engine v1

Move beyond token aliases into useful symbolic forms.

Macros:

```text
Σ(x∈xs) expr       → sum(expr for x in xs)
Π(x∈xs) expr       → product loop / math.prod-compatible lowering
π(x∈xs|pred) expr  → [expr for x in xs if pred]
∀x∈xs: block       → for x in xs:
(f∘g)(x)           → f(g(x))
x ▷ f ▷ g          → g(f(x)) optional pipeline
```

Acceptance:

```text
macro fixtures execute and match Python equivalents
nested macros either pass or fail with explicit diagnostic
macros do not rewrite strings/comments
```

### GPY006 — γ stdlib facades

Provide γ-native wrappers over Python libraries.

Facades:

```text
File / Ρθ       pathlib + read/write helpers
JSON            json loads/dumps/read/write
HTTP            urllib/requests adapter if installed
CSV             csv module helpers
Table / Πδ      pandas facade when installed, fallback error if absent
Regex           re facade
Time            datetime/time
Env             os.environ
Log             logging/rich optional
```

Acceptance:

```text
examples run with stdlib-only facades
optional dependency facades fail clearly when package missing
foreign imports can be wrapped into γ names
```

### GPY007 — dependency/project workflow

Features:

```text
gpy.toml
project templates
uv preferred, pip fallback
dependency add/remove/list
venv detection
lockfile policy
script entrypoints
```

Example:

```toml
[project]
name = "ops-tool"
python = ">=3.11"

[dependencies]
requests = ">=2.31"
rich = ">=13"

[gpy]
source = "src"
emit = "build/py"
```

Acceptance:

```text
gpy deps add rich updates gpy.toml/pyproject bridge
gpy run uses project venv when present
missing dependency error includes install command
```

### GPY008 — formatter and linter

Features:

```text
stable γ formatting
preserve Python indentation semantics
warn on mixed γ/λ style in project-owned code
warn on host-boundary corruption risk
optional black/ruff handoff after compile
```

Acceptance:

```text
gpy fmt is idempotent
linter catches accidental glyph rewrites inside imports/API names
compiled Python can be run through ruff/black if installed
```

### GPY009 — test runner and conformance suite

Features:

```text
gpy test discovers tests/**/*.gpy
assertion helper aliases
fixture matrix: .gpy source, emitted .py, expected stdout/stderr/exit
regular Python equivalence tests
surface-density metrics
```

Acceptance:

```text
gpy test passes project fixtures
conformance suite compares gpy vs Python outputs
surface-limit suite remains green
```

### GPY010 — editor support and LSP

Features:

```text
TextMate grammar
VS Code extension stub
syntax highlighting
bracket/comment behavior
LSP diagnostics from gpy check
go-to emitted Python optional
```

Acceptance:

```text
.gpy files highlight in VS Code
diagnostics appear on syntax errors
source-map locations are clickable where possible
```

### GPY011 — security/capability policy

GlyphPython rides Python, so it can do anything Python can do. Production needs explicit posture.

Features:

```text
no false sandbox claim
optional capability manifest
lint warnings for subprocess/network/file writes
safe mode for CI/static validation
signed/reproducible emitted artifacts later
```

Acceptance:

```text
gpy check never executes user code
security lint flags subprocess/socket/open writes
README states runtime is unsandboxed Python unless capability runner is used
```

### GPY012 — packaging/release

Features:

```text
npm package or standalone node binary wrapper
Python package bridge optional
Homebrew formula later
CI workflow templates
versioned releases
changelog
```

Acceptance:

```text
fresh checkout can install and run gpy
release command builds artifact and runs full conformance
version appears in CLI and docs
```

### DOG001 — real utility dogfood

Use GlyphPython for actual JT scripts.

Candidates:

```text
JSON policy evaluator
CSV summarizer
file renamer
markdown report generator
HTTP API smoke checker
repo task report generator
```

Acceptance:

```text
each has .gpy source, expected fixture output, and emitted Python snapshot
at least one script uses file IO and JSON
at least one script uses optional dependency facade
```

### DOG002 — compiler/tooling dogfood

Start writing pieces of GlyphPython tooling in GlyphPython.

Candidates:

```text
fixture summarizer
source-map validator
docs command verifier
benchmark report renderer
```

Acceptance:

```text
repo tooling invokes at least one .gpy script in CI gate
no circular dependency that blocks bootstrap
```

---

## Definition of production-ready

GlyphPython is production-usable when all are true:

```text
1. JT can create a project, install deps, run scripts, test, and build emitted Python.
2. Diagnostics point back to .gpy source for syntax and common runtime errors.
3. Strings/comments/imports/public APIs are protected by tests.
4. File/JSON/Path/HTTP/CSV workflows are documented and verified.
5. The conformance suite compares .gpy outputs against real Python baselines.
6. Editor syntax highlighting and basic diagnostics exist.
7. Security posture is honest: Python-backed, not sandboxed by default.
8. Release/install path works from a fresh checkout.
```

---

## Immediate next implementation order

```text
GPY002 CLI v1
GPY003 tokenizer/source-map compiler core
GPY004 diagnostics
GPY005 macro engine
GPY006 stdlib facades
GPY007 project/dependency workflow
GPY009 conformance/test runner
GPY010 editor/LSP
GPY011 security policy
GPY012 packaging/release
DOG001/DOG002 ongoing
```

Do not jump to packaging before diagnostics. A glyph language without source-mapped errors will feel broken under real use.
