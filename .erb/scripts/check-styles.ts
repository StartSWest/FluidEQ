/**
 * Compile every stylesheet, and say which one does not.
 *
 * Sass is the one language in this repo nothing checks. `pnpm typecheck` does
 * not see it, jest does not import it, and prettier will happily format a file
 * that cannot compile — so a broken rule passes every gate in the runbook and
 * turns up as something looking wrong in the window, which is the most
 * expensive place to find it.
 *
 * That is not hypothetical. `$radius-xl` was used in GraphTheme.scss, which
 * imports `color` and not `theme`; Sass threw the whole declaration away and
 * the graph's corners stayed square through several rounds of "still not
 * rounded". Two seconds of compiling would have said so.
 *
 * Partials are skipped: a file beginning with `_` is meant to be used from
 * somewhere else and is not expected to stand alone. Everything else is a real
 * entry point, imported by a component, and has to build on its own.
 */

import { compile } from 'sass';
import { readdirSync } from 'fs';
import path from 'path';

const STYLES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'renderer',
  'styles',
);

const failures: string[] = [];

readdirSync(STYLES_DIR)
  .filter((name) => name.endsWith('.scss') && !name.startsWith('_'))
  .forEach((name) => {
    try {
      compile(path.join(STYLES_DIR, name), {
        loadPaths: [STYLES_DIR],
        // Third-party deprecations are not this check's business; it is looking
        // for stylesheets that do not build.
        quietDeps: true,
      });
    } catch (error) {
      failures.push(`${name}\n${(error as Error).message}`);
    }
  });

if (failures.length > 0) {
  console.error(
    `\n${failures.length} stylesheet(s) failed to compile:\n\n${failures.join('\n\n')}\n`,
  );
  process.exit(1);
}

console.log(`All stylesheets compile.`);
