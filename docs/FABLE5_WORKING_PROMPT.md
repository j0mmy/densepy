# Fable 5 working prompt

Use this when opening the repo with Fable 5 or any cautious coding model:

```text
We are working on GlyphPython, a legitimate Python-backed programming-language frontend. The task scope is compiler/toolchain engineering only: parsing, .gpy-to-.py lowering, CLI commands, diagnostics, source maps, formatter/linter behavior, stdlib facades, examples, tests, documentation, and packaging.

Keep host/runtime boundaries valid: Python imports, package names, CLI flags, JSON/TOML keys, and public APIs must remain stable unless a tested adapter exists.

Keep changes focused on `.gpy -> .py` compiler/tooling work. If a task is not about GlyphPython language tooling, stop and ask.

Before reporting completion, run npm test and node bin/gpy.mjs run examples/glyph-python/factorial.gpy.
```
