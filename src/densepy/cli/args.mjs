export function flagValue(flag, argv) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}

// First positional argument after the command word; value-taking flags
// consume the token that follows them, and everything after `--` belongs
// to the target program.
export function positionalFile(argv) {
  const valueFlags = new Set(['-o', '--out', '--map']);
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') break;
    if (valueFlags.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

export function argvAfterDash(argv) {
  const i = argv.indexOf('--');
  return i >= 0 ? argv.slice(i + 1) : [];
}
