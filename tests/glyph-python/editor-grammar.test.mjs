import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ΓMAP } from '../../src/glyph-python/γpy.mjs';

const ρ = new URL('../..', import.meta.url).pathname;

function τ(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

τ('VS Code extension manifest and grammar are valid JSON and wired together', () => {
  const manifest = JSON.parse(readFileSync(join(ρ, 'editors/vscode/package.json'), 'utf8'));
  const lang = manifest.contributes.languages[0];
  assert.deepEqual(lang.extensions, ['.gpy']);
  const grammarDecl = manifest.contributes.grammars[0];
  assert.equal(grammarDecl.language, lang.id);
  JSON.parse(readFileSync(join(ρ, 'editors/vscode/language-configuration.json'), 'utf8'));
  const grammar = JSON.parse(readFileSync(join(ρ, 'editors/vscode/syntaxes/gpy.tmLanguage.json'), 'utf8'));
  assert.equal(grammar.scopeName, grammarDecl.scopeName);
});

τ('every compiler glyph is covered by the TextMate grammar', () => {
  const grammarText = readFileSync(join(ρ, 'editors/vscode/syntaxes/gpy.tmLanguage.json'), 'utf8');
  const glyphs = [
    ...Object.keys(ΓMAP.word),
    ...Object.keys(ΓMAP.op),
    ...Object.keys(ΓMAP.num),
  ];
  const missing = glyphs.filter((g) => !grammarText.includes(g));
  assert.deepEqual(missing, [], `glyphs missing from grammar: ${missing.join(' ')}`);
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\nγpy editor grammar tests: 2 passed, 0 failed');
