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
import { readdirSync, readFileSync } from 'fs';
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

// A raw numeric font-weight is the one typographic mistake nothing else here
// can see.
//
// Compiling proves a rule builds, not that it renders as intended, and jest
// queries by role and never looks at a face. So the app quietly grew eighteen
// distinct weight literals — 650, 680, 720, 730, 750, 760, 780, 820, 840, 850,
// 880, 950 among them — that measured as four faces in the running window,
// with everything from 800 up landing on `Segoe UI Black`. Every one of those
// passed the whole suite; the titlebar tabs shipped looking flattened.
//
// Only `_theme.scss` may state a weight as a number, because that is where the
// scale is defined — and `@font-face`, where `font-weight: 100 900` is not a
// weight at all but the range of the variable axis, and has to be two numbers.
// That pair is the reason the test below looks for a number with no second
// number after it rather than simply for a digit.
const weightOffenders: string[] = [];

readdirSync(STYLES_DIR)
  .filter((name) => name.endsWith('.scss') && name !== '_theme.scss')
  .forEach((name) => {
    readFileSync(path.join(STYLES_DIR, name), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const match = /font-weight:\s*(\d+)(?!\s*\d)/.exec(line);
        if (match) {
          weightOffenders.push(`${name}:${index + 1}  font-weight: ${match[1]}`);
        }
      });
  });

if (weightOffenders.length > 0) {
  console.error(
    `\n${weightOffenders.length} raw font-weight value(s) — use the $weight-* scale in _theme.scss:\n\n${weightOffenders.join('\n')}\n`,
  );
  process.exit(1);
}

console.log(`All stylesheets compile, and every font-weight uses the scale.`);
