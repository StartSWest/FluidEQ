/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import type { GraphPalette, GraphStyle } from '../../src/common/graphStyles';
import { ROOT } from './stillSources';

/**
 * Where the generator (`generate.ts`) writes: the stills, the list of them
 * (`stills.json`) and the window's copy of that list
 * (`shippedStillFiles.ts`).
 */

export const STILLS_DIR = path.join(
  ROOT,
  'src',
  'renderer',
  'graph',
  'lookStills',
  'stills',
);
/** The list of stills and the roles each is painted in, which runs merge into. */
const MANIFEST = path.join(STILLS_DIR, 'stills.json');
const FILES_MODULE = path.join(
  ROOT,
  'src',
  'renderer',
  'graph',
  'lookStills',
  'shippedStillFiles.ts',
);

export interface IShipped {
  style: GraphStyle;
  palette: GraphPalette;
  side: string;
  colours: string;
  roles: readonly string[];
  file: string;
}

/**
 * Written beside and renamed over: the app's dev server may read any file
 * under `src` at any moment, and a half-written one is garbage to it.
 */
export const writeAtomically = (file: string, bytes: string | Buffer) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
};

/**
 * A list as JSON, laid out as the commit hook lays JSON out, so a run that
 * changes nothing leaves the file as it was.
 */
export const writeJson = async (file: string, value: unknown) => {
  const options = await prettier.resolveConfig(file);
  writeAtomically(
    file,
    await prettier.format(JSON.stringify(value), {
      ...options,
      parser: 'json',
    }),
  );
};

/** Every still shipped, as the last run left the list. */
export const readShipped = (): IShipped[] =>
  fs.existsSync(MANIFEST)
    ? (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as IShipped[])
    : [];

const camel = (text: string) =>
  text.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/** The window's copy of the list, formatted as the project formats code. */
const writeFilesModule = async (sorted: readonly IShipped[]) => {
  const imports = sorted.map(
    (still) =>
      `import ${camel(path.basename(still.file, '.png'))} from './stills/${still.file}';`,
  );
  const entries = sorted.map(
    (still) =>
      `'${still.style} ${still.palette} ${still.side} ${still.colours}': { url: ${camel(path.basename(still.file, '.png'))}, roles: [${still.roles.map((role) => `'${role}'`).join(', ')}] },`,
  );
  const text = `/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Written by \`pnpm stills:looks\` (scripts/look-stills/generate.ts). Do not
// edit: run it again.

${imports.join('\n')}
import type { IShippedStillFile } from './shippedStill';

/** Each still, by \`style palette side colours\` (\`shippedStillKey\`). */
const SHIPPED_STILL_FILES: Readonly<Record<string, IShippedStillFile>> = {
${entries.join('\n')}
};

export default SHIPPED_STILL_FILES;
`;
  const options = await prettier.resolveConfig(FILES_MODULE);
  writeAtomically(
    FILES_MODULE,
    await prettier.format(text, { ...options, filepath: FILES_MODULE }),
  );
};

/**
 * The list after a run: the stills just made, and every other still kept
 * as it was while its look is still a standard one. A look no longer among
 * them loses its stills.
 */
export const writeShipped = async (
  made: readonly IShipped[],
  forms: ReadonlySet<string>,
) => {
  const madeFiles = new Set(made.map((still) => still.file));
  const before = readShipped();
  before
    .filter((still) => !forms.has(still.style))
    .forEach((still) =>
      fs.rmSync(path.join(STILLS_DIR, still.file), { force: true }),
    );
  const kept = before.filter(
    (still) => forms.has(still.style) && !madeFiles.has(still.file),
  );
  const listed = [...kept, ...made].sort((left, right) =>
    left.file.localeCompare(right.file),
  );
  await writeJson(MANIFEST, listed);
  await writeFilesModule(listed);
};
