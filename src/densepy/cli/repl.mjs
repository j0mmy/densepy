import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { γcompileWithMap, γprelude } from '../compiler.mjs';
import { resolvePython } from './python.mjs';

// Returns null: exits with the python driver's code when stdin closes.
export function cmdRepl() {
  const driver = [
    'import sys, codeop, math',
    'ns = {"math": math}',
    `exec(compile(${JSON.stringify(γprelude())}, '<γprelude>', 'exec'), ns)`,
    "buf = ''",
    'while True:',
    '    line = sys.stdin.readline()',
    '    if not line:',
    '        break',
    '    buf += line',
    '    try:',
    "        code = codeop.compile_command(buf, '<γ>', 'single')",
    '    except SyntaxError as e:',
    "        print('SyntaxError:', e)",
    "        buf = ''",
    '        continue',
    '    if code is None:',
    '        continue',
    "    buf = ''",
    '    try:',
    '        exec(code, ns)',
    '    except SystemExit:',
    '        raise',
    '    except BaseException as e:',
    "        print(type(e).__name__ + ':', e)",
  ].join('\n');
  const py = spawn(resolvePython(), ['-u', '-c', driver], { stdio: ['pipe', 'inherit', 'inherit'] });
  process.stderr.write('GlyphPython REPL (ctrl-d to exit)\n');
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const compiled = γcompileWithMap(line, { bare: true }).code;
    py.stdin.write(`${compiled}\n`);
  });
  rl.on('close', () => py.stdin.end());
  py.on('exit', (code) => process.exit(code ?? 0));
  return null;
}
