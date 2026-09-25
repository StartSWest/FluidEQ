/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

/**
 * The window's CSS order is `styles/cascade.ts` and nothing else
 * (`workspacePages.ts` fetches most pages on demand, and a sheet reached only
 * through one would arrive with it, last in the cascade). These hold the
 * three things that keep that true: the list is imported before anything
 * else, it names every sheet the renderer imports, and it names each once.
 */
const RENDERER = resolve(__dirname, '../../../renderer');
const STYLES = join(RENDERER, 'styles');
const CASCADE = join(STYLES, 'cascade.ts');

const SHEET_IMPORT = /^import '([^']+\.scss)';$/gm;

/** Every `.ts`/`.tsx` file under the renderer, tests excluded. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const importedSheets = (file: string): string[] =>
  Array.from(readFileSync(file, 'utf8').matchAll(SHEET_IMPORT), (match) =>
    resolve(dirname(file), match[1]),
  );

const cascade = importedSheets(CASCADE);
const byName = (sheet: string) => relative(STYLES, sheet);

describe('the stylesheet cascade', () => {
  it('is the first thing the window imports', () => {
    const index = readFileSync(join(RENDERER, 'index.tsx'), 'utf8');
    const firstImport = /^import [^;]+;$/m.exec(index);
    expect(firstImport?.[0]).toBe("import './styles/cascade';");
  });

  it('names every sheet the renderer imports', () => {
    const imported = new Set(
      sourceFiles(RENDERER)
        .filter((file) => file !== CASCADE)
        .flatMap(importedSheets),
    );
    // The scan finds what is certainly there, or "nothing missing" would
    // also be what a scan that found nothing reports.
    expect(imported.size).toBeGreaterThan(100);
    expect(imported.has(join(STYLES, 'App.scss'))).toBe(true);
    const missing = [...imported].filter((sheet) => !cascade.includes(sheet));
    expect(missing.map(byName)).toEqual([]);
  });

  it('names each sheet once, and only sheets that exist', () => {
    expect(new Set(cascade).size).toBe(cascade.length);
    expect(cascade.filter((sheet) => !existsSync(sheet)).map(byName)).toEqual(
      [],
    );
  });

  it('keeps the order the rules were written against', () => {
    // Two written down in the sheets and App.tsx: the rainbow accents win
    // against the cyan ones by coming after them, not by `!important`; and
    // the error screen, the last thing the window can show, comes last.
    const at = (name: string) => cascade.indexOf(join(STYLES, name));
    expect(at('App.scss')).toBeGreaterThanOrEqual(0);
    expect(at('Rainbow.scss')).toBe(at('App.scss') + 1);
    expect(at('ErrorBoundary.scss')).toBe(cascade.length - 1);
  });
});
