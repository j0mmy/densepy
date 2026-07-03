#!/usr/bin/env node
import { cmdBuild } from '../src/densepy/cli/build.mjs';
import { cmdRun } from '../src/densepy/cli/run.mjs';
import { cmdCheck } from '../src/densepy/cli/check.mjs';
import { cmdTest } from '../src/densepy/cli/test.mjs';
import { cmdFmt } from '../src/densepy/cli/fmt.mjs';
import { cmdWatch } from '../src/densepy/cli/watch.mjs';
import { cmdRepl } from '../src/densepy/cli/repl.mjs';
import { cmdLsp } from '../src/densepy/cli/lsp.mjs';
import { cmdLint } from '../src/densepy/cli/lint.mjs';
import { cmdInit } from '../src/densepy/cli/init.mjs';
import { cmdDeps } from '../src/densepy/cli/deps.mjs';
import { cmdVersion } from '../src/densepy/cli/version.mjs';
import { cmdPack } from '../src/densepy/cli/pack.mjs';
import { badUsage } from '../src/densepy/cli/usage.mjs';

function main(argv) {
  const cmd = argv[0];
  if (cmd === '--version' || cmd === '-V' || cmd === 'version') return cmdVersion();
  if (cmd === 'build') return cmdBuild(argv);
  if (cmd === 'check') return cmdCheck(argv);
  if (cmd === 'run') return cmdRun(argv);
  if (cmd === 'test') return cmdTest(argv);
  if (cmd === 'fmt') return cmdFmt(argv);
  if (cmd === 'watch') return cmdWatch(argv);
  if (cmd === 'repl') return cmdRepl();
  if (cmd === 'lsp') return cmdLsp();
  if (cmd === 'lint') return cmdLint(argv);
  if (cmd === 'init') return cmdInit(argv);
  if (cmd === 'deps') return cmdDeps(argv);
  if (cmd === 'pack') return cmdPack(argv);
  return badUsage();
}

// watch/repl/lsp return null: they own the process lifetime.
const code = main(process.argv.slice(2));
if (code !== null) process.exit(code);
