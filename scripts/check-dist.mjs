#!/usr/bin/env node
/* Verifies that dist/invoice-designer/ matches invoice-designer/src/.
 *
 * The bundle is committed (index.html loads it directly, and the app has no
 * build step of its own), so it can silently drift from source. This rebuilds
 * into a temporary directory and compares, leaving the committed dist/ alone.
 *
 *   node scripts/check-dist.mjs          exit 1 if stale
 *   node scripts/check-dist.mjs --fix    rebuild dist/ in place instead
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, rmSync, mkdtempSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = join(ROOT, 'invoice-designer');
const DIST = join(ROOT, 'dist', 'invoice-designer');
const FIX = process.argv.includes('--fix');

const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);

/** Hash every file in a directory, keyed by name. */
function fingerprint(dir) {
  if (!existsSync(dir)) return null;
  return Object.fromEntries(
    readdirSync(dir).filter((f) => !f.startsWith('.')).sort().map((f) => [f, sha(join(dir, f))])
  );
}

if (!existsSync(join(MODULE, 'node_modules'))) {
  die(`invoice-designer/node_modules is missing.\n  Run: cd invoice-designer && npm install`);
}
if (!existsSync(DIST)) {
  die(`dist/invoice-designer/ does not exist.\n  Run: cd invoice-designer && npm run build`);
}

const committed = fingerprint(DIST);

if (FIX) {
  console.log('Rebuilding dist/invoice-designer …');
  execFileSync('npm', ['run', 'build'], { cwd: MODULE, stdio: 'inherit' });
  const rebuilt = fingerprint(DIST);
  const changed = Object.keys(rebuilt).filter((f) => committed[f] !== rebuilt[f]);
  console.log(changed.length ? `✓ dist updated (${changed.join(', ')})` : '✓ dist was already current');
  process.exit(0);
}

/* Build into a scratch copy so a stale check never mutates the working tree. */
const tmp = mkdtempSync(join(tmpdir(), 'dist-check-'));
let rebuilt;
try {
  cpSync(join(ROOT, 'dist'), join(tmp, 'dist'), { recursive: true });
  execFileSync('npm', ['run', 'build', '--', '--outDir', join(tmp, 'dist', 'invoice-designer'), '--emptyOutDir'], {
    cwd: MODULE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rebuilt = fingerprint(join(tmp, 'dist', 'invoice-designer'));
} catch (e) {
  const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
  die(`the invoice-designer build failed, so dist/ cannot be verified:\n${out.trim() || e.message}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const names = [...new Set([...Object.keys(committed), ...Object.keys(rebuilt)])].sort();
const stale = names.filter((f) => committed[f] !== rebuilt[f]);

if (stale.length) {
  console.error('✗ dist/invoice-designer is stale — it does not match invoice-designer/src.');
  for (const f of stale) {
    const was = committed[f] ?? '(absent)';
    const now = rebuilt[f] ?? '(absent)';
    console.error(`    ${f}: committed ${was} → rebuilt ${now}`);
  }
  console.error('\n  Rebuild and commit it:  npm run build:dist');
  process.exit(1);
}

console.log(`✓ dist/invoice-designer matches source (${names.length} files)`);
