# GlyphPython repo law

This repository is intentionally scoped to a legitimate programming-language frontend.

## Mission

Build and maintain GlyphPython: a Python-backed glyph authoring surface where `.gpy` source compiles to ordinary Python and runs on `python3`.

## Scope

Allowed work:
- parser/compiler behavior
- `.gpy -> .py` lowering
- CLI commands: run, build, check, test, fmt, lint, init, deps
- diagnostics and traceback remapping
- source maps
- formatter/linter behavior
- stdlib facades over normal Python libraries
- tests, examples, docs, packaging

Scope guard:
- Keep this repository limited to `.gpy -> .py` compiler/tooling work.
- Do not add unrelated subsystems.
- If a task is not about GlyphPython language tooling, stop and ask JT before changing files.

## γ/λ boundary

`γ` = project-owned GlyphPython authoring surface.
`λ` = host/runtime boundary: Python, Node, package names, JSON/TOML keys, CLI flags, public APIs.

Rules:
- Project-owned examples/tests/comments may be γ-first where practical.
- Host/runtime names must remain valid and stable.
- Python imports, package names, CLI flags, manifest keys, and public APIs stay ASCII/host-compatible unless a tested alias layer exists.

## Verification

Before reporting completion, run:

```bash
npm test
node bin/gpy.mjs run examples/glyph-python/factorial.gpy
```

For compiler changes, add or update tests first, then run the focused test and full `npm test`.
