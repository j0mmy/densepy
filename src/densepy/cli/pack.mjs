import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readManifest, gpySection } from './manifest.mjs';
import { findGpyFiles } from './project.mjs';

// Emit the project (or the given files) as one agent-ready context blob:
// the whole point of a dense language is cheap context loads, so loading
// context is a first-class command. Blob on stdout; accounting on stderr
// so an agent can pipe stdout straight into its context.
//
// --px renders the blob as dense PNG page(s) via pxpipe instead of text —
// vision tokens carry dense text at a fraction of BPE cost (measured on a
// real pack blob 2026-07-03: 5780 text tokens → ~851 image tokens, 0.15×).
// Lossy for byte-exact recall; page paths on stdout, PNGs into -o <dir>.
export async function cmdPack(argv) {
  const files = argv
    .slice(1)
    .filter((a, i, all) => !a.startsWith('-') && all[i - 1] !== '-o');
  let paths;
  try {
    paths = files.length
      ? files
      : findGpyFiles(join(process.cwd(), gpySection(readManifest()).source));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  let out = '';
  if (argv.includes('--packet')) {
    out += readFileSync(new URL('../../../docs/AGENT_PACKET.md', import.meta.url), 'utf8');
    out += '\n';
  }
  for (const path of paths) {
    const rel = relative(process.cwd(), path);
    out += `=== FILE: ${rel} ===\n${readFileSync(path, 'utf8')}\n`;
  }
  const tokens = Math.round(out.length / 3.5);
  if (!argv.includes('--px')) {
    process.stdout.write(out);
    process.stderr.write(`pack: ${paths.length} files, ${out.length} chars, ~${tokens} tokens (o200k approx)\n`);
    return 0;
  }
  let px;
  try {
    px = await resolvePxpipe();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  const oIdx = argv.indexOf('-o');
  const outDir = oIdx !== -1 && argv[oIdx + 1] ? argv[oIdx + 1] : 'pack-px';
  const res = await px.renderTextToImages(out, { reflow: true });
  mkdirSync(outDir, { recursive: true });
  res.pages.forEach((page, i) => {
    const file = join(outDir, `pack-${i + 1}.png`);
    writeFileSync(file, page.png);
    process.stdout.write(`${file}\n`);
  });
  // 781 px/token is pxpipe's Anthropic billing constant (1928² ≈ 4761 tokens).
  const imageTokens = Math.round(res.pixels / 781);
  process.stderr.write(
    `pack: ${paths.length} files, ${out.length} chars, ~${tokens} tokens (o200k approx)\n` +
      `px: ${res.pages.length} page(s), ~${imageTokens} image tokens (${(imageTokens / Math.max(tokens, 1)).toFixed(2)}x of text)\n`,
  );
  if (res.droppedChars > 0) {
    process.stderr.write(
      `px warn: ${res.droppedChars} chars not in the glyph atlas render blank (legacy glyph symbols; keep glyph-surface docs as text)\n`,
    );
  }
  return 0;
}

// pxpipe is an optional integration, resolved fail-closed: an explicit
// PXPIPE_HOME must contain a built checkout; otherwise try the installed
// pxpipe-proxy package. Never guessed from the filesystem.
async function resolvePxpipe() {
  const home = process.env.PXPIPE_HOME;
  if (home) {
    const entry = join(home, 'dist', 'core', 'index.js');
    if (!existsSync(entry)) {
      throw new Error(
        `pxpipe not found at PXPIPE_HOME (${entry}) — build one: git clone https://github.com/teamchong/pxpipe && cd pxpipe && pnpm install && pnpm run build`,
      );
    }
    return import(pathToFileURL(entry).href);
  }
  try {
    return await import('pxpipe-proxy/dist/core/index.js');
  } catch {
    throw new Error(
      'pxpipe not found — set PXPIPE_HOME to a built checkout or install the pxpipe-proxy package',
    );
  }
}
