/* Node runs TypeScript natively (type stripping) but its ESM resolver requires
   file extensions, while the source uses bundler-style extensionless imports
   ("./constants"). This hook appends the extension so the tests can import the
   real source files without modifying them or the build config. */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.(ts|tsx|js|mjs|json|css)$/.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of CANDIDATES) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
