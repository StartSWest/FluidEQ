/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import type { GraphPalette, GraphStyle } from '../../src/common/graphStyles';
import {
  STILL_BOX,
  STILL_GAP,
  STILL_PIXELS,
  STILL_SCALE,
} from '../../src/renderer/graph/lookStills/stillSize';
import { findBrowser, openPage, type IPage } from '../help-captures/cdp';
import { serve } from '../help-captures/serve';
import BUILT from './built';
import { ROOT, SOURCES_FILE, hashSources } from './freshness';
import type { IStillError } from './fit';
import PLATE_AT from './plate';
import type {
  IBuildAnswer,
  IBuildRequest,
  IShowRequest,
  TRealState,
} from './protocol';
import encodePng from './png';

/**
 * Makes the look picker's shipped stills: every standard look, drawn by the
 * window's own renderer on the demo song, split into the window's colours
 * (`src/renderer/graph/lookStills/stillRoles.ts`, `fit.ts`), for each side of
 * the Brightness and for one colour or many. Run it whenever a look changes;
 * `lookStillsFresh.test.ts` says when one has.
 *
 *   pnpm stills:looks [--only <style>]... [--skip-build] [--chrome <path>]
 *
 * Writes `<style>-<palette>-<side>-<colours>.png` into
 * `src/renderer/graph/lookStills/stills` - beside the code that lays them,
 * not in `assets/`, every file of which the installer also ships loose - with
 * the list of them (`stills.json`), the window's copy of it
 * (`shippedStillFiles.ts`) and, on a run of every look, what they were drawn
 * from (`sources.json`); `--only` remakes the looks named and keeps the rest. Every still is checked against the look drawn in the listener's own
 * colours - Ocean, a picked colour, Black, the white window - in arithmetic,
 * and once more laid on a plate by the window's own component and
 * screenshot; the run fails if one is visibly off.
 */

const BOX = STILL_BOX;
const SCALE = STILL_SCALE;
const OUT = STILL_PIXELS;
const GAP = STILL_GAP;
/** The page, in CSS pixels: room for the stage and, under it, the plate. */
const PAGE = { width: 800, height: 600 };

/** The mixed states each still is solved from: three equations each. */
const SEEDS = Array.from({ length: 16 }, (_, index) => 7919 * (index + 1));

/** The palette each form is shown in until the listener picks another. */
const PALETTES: readonly GraphPalette[] = ['auto'];

const GROUPS: ReadonlyArray<{
  side: IBuildRequest['side'];
  colours: IBuildRequest['colours'];
  checks: readonly TRealState[];
}> = [
  { side: 'dark', colours: 'one', checks: ['ocean', 'picked', 'black'] },
  { side: 'dark', colours: 'many', checks: ['ocean', 'picked'] },
  { side: 'light', colours: 'one', checks: ['ocean', 'picked'] },
  { side: 'light', colours: 'many', checks: ['ocean', 'picked'] },
];

/**
 * Off by more than this, in steps of 255, on more than one pixel in a
 * hundred, and the still is not the look: the run fails and names it.
 */
const MOST_OFF = 24;

const STILLS_DIR = path.join(
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
const DEMO = path.join(ROOT, 'assets', 'studio', 'publish-demo-loop.m4a');
const STATS = path.join(BUILT, '..', 'fluideq-look-stills-stats.json');

const say = (line: string) => process.stdout.write(`${line}\n`);

const argument = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

const allOf = (name: string): string[] =>
  process.argv.flatMap((value, index) =>
    process.argv[index - 1] === name ? [value] : [],
  );

const writeAtomically = (file: string, bytes: string | Buffer) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
};

const build = () => {
  say('Building the stills page...');
  fs.rmSync(BUILT, { recursive: true, force: true });
  const built = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'webpack', 'bin', 'webpack.js'),
      '--config',
      path.join(__dirname, 'webpack.config.ts'),
      '--json',
      STATS,
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  if (built.status !== 0) {
    throw new Error('The stills page did not build.');
  }
};

/**
 * The app's own source files the page was built from, and the stills' own
 * making: what decides the pictures. Not the translations: a still is drawn
 * with its key off and holds no words, and the strings change by the day.
 */
const sourcesOfBuild = (): string[] => {
  const stats = JSON.parse(fs.readFileSync(STATS, 'utf8')) as {
    modules?: { name?: string; modules?: { name?: string }[] }[];
  };
  const names = new Set<string>();
  const visit = (list: { name?: string; modules?: { name?: string }[] }[]) =>
    list.forEach((module) => {
      if (module.name) {
        names.add(module.name);
      }
      if (module.modules) {
        visit(module.modules);
      }
    });
  visit(stats.modules ?? []);
  return [...names]
    .map((name) => name.replace(/^\.\//, '').split(' ')[0])
    .filter((name) => /^(src|scripts\/look-stills)\/.*\.tsx?$/.test(name))
    .filter((name) => !/^src\/common\/i18n\/[^/]+\//.test(name))
    .filter((name) => fs.existsSync(path.join(ROOT, name)));
};

const fromBase64 = (text: string) =>
  new Uint8Array(Buffer.from(text, 'base64'));

/**
 * The layers stacked top to bottom, `GAP` clear rows apart: the rest as it
 * is, then each role's mask in the alpha alone.
 */
const spriteOf = (answer: IBuildAnswer) => {
  const layer = OUT.width * OUT.height;
  const layers = answer.roles.length + 1;
  const height = layers * OUT.height + (layers - 1) * GAP;
  const rgba = new Uint8Array(OUT.width * height * 4);
  const rowOf = (index: number) => index * (OUT.height + GAP);
  rgba.set(fromBase64(answer.rest), 0);
  const masks = fromBase64(answer.masks);
  answer.roles.forEach((_, index) => {
    const top = rowOf(index + 1) * OUT.width * 4;
    for (let pixel = 0; pixel < layer; pixel += 1) {
      rgba[top + pixel * 4 + 3] = masks[index * layer + pixel];
    }
  });
  return encodePng(rgba, OUT.width, height);
};

const camel = (text: string) =>
  text.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

interface IShipped {
  style: GraphStyle;
  palette: GraphPalette;
  side: string;
  colours: string;
  roles: readonly string[];
  file: string;
}

/**
 * A list as JSON, laid out as the commit hook lays JSON out, so a run that
 * changes nothing leaves the file as it was.
 */
const writeJson = async (file: string, value: unknown) => {
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
const readShipped = (): IShipped[] =>
  fs.existsSync(MANIFEST)
    ? (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as IShipped[])
    : [];

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
 * The still laid on a plate by the window's own component, screenshot, and
 * compared with the look drawn on the same plate (`composeStill.tsx`): what
 * the browser composites, not only what the arithmetic says it would.
 */
const seenOnPlate = async (
  page: IPage,
  request: IShowRequest,
  png: Buffer,
): Promise<IStillError> => {
  const served = path.join(BUILT, 'stills', path.basename(request.url));
  fs.mkdirSync(path.dirname(served), { recursive: true });
  fs.writeFileSync(served, png);
  await page.evaluate(
    `window.lookStills.showStill(${JSON.stringify(request)})`,
  );
  const { data } = await page.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: PLATE_AT.left,
      y: PLATE_AT.top,
      width: BOX.width,
      height: BOX.height,
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  return page.evaluate<IStillError>(
    `window.lookStills.compareShot(${JSON.stringify(data)})`,
  );
};

const measuredText = (checks: ReadonlyArray<{ name: string } & IStillError>) =>
  checks
    .map(
      (check) =>
        `${check.name} ${check.mean.toFixed(1)}/${check.p99.toFixed(0)}/${check.max.toFixed(0)}`,
    )
    .join('  ');

/**
 * One look's still in one set of colours: drawn, split, written, laid on a
 * plate and measured. Says why it fails, if it is visibly off.
 */
const makeStill = async (
  page: IPage,
  {
    group,
    style,
    palette,
  }: {
    group: (typeof GROUPS)[number];
    style: GraphStyle;
    palette: GraphPalette;
  },
): Promise<{ still: IShipped; failure?: string }> => {
  const request: IBuildRequest = {
    style,
    palette,
    side: group.side,
    colours: group.colours,
    seeds: SEEDS,
    checks: group.checks,
    box: BOX,
    out: OUT,
  };
  const answer = await page.evaluate<IBuildAnswer>(
    `window.lookStills.build(${JSON.stringify(request)})`,
  );
  const file = `${style}-${palette}-${group.side}-${group.colours}.png`;
  const png = spriteOf(answer);
  writeAtomically(path.join(STILLS_DIR, file), png);
  const seen = await seenOnPlate(
    page,
    {
      style,
      palette,
      side: group.side,
      colours: group.colours,
      state: 'ocean',
      url: `./stills/${file}`,
      roles: answer.roles,
      box: BOX,
      out: OUT,
    },
    png,
  );
  const measured = [...answer.checks, { name: 'seen', ...seen }];
  const worst = Math.max(...measured.map((check) => check.p99));
  // Each role once, with how often it is laid on where its light adds up.
  const roles =
    [...new Set(answer.roles)]
      .map((role, index) => {
        const times = answer.roles.filter((each) => each === role).length;
        return `${role}${times > 1 ? `x${times}` : ''}:${answer.gains[index].toFixed(1)}`;
      })
      .join(',') || '-';
  say(
    `${file.padEnd(40)} ${String(Math.round(png.length / 1024)).padStart(4)} KB  roles ${roles}  drift ${answer.coverageDrift}  fit ${answer.fitted.p99.toFixed(0)}  ${measuredText(measured)}  ${(answer.took / 1000).toFixed(1)} s`,
  );
  return {
    still: {
      style,
      palette,
      side: group.side,
      colours: group.colours,
      roles: answer.roles,
      file,
    },
    failure:
      worst > MOST_OFF ? `${file}: p99 ${worst.toFixed(0)} of 255` : undefined,
  };
};

/** The page's bundle has run: looked for on the page's own frames, a few hundred at most. */
const pageReady = async (page: IPage) => {
  const ready = await page.evaluate<boolean>(`new Promise((done) => {
    let frames = 0;
    const look = () => {
      frames += 1;
      if (window.lookStills || frames > 600) {
        done(Boolean(window.lookStills));
      } else {
        requestAnimationFrame(look);
      }
    };
    look();
  })`);
  if (!ready) {
    throw new Error('The stills page never came up.');
  }
};

/** Every look named (all of them, without `--only`) in every set of colours. */
const drawAll = async (page: IPage, url: string, only: ReadonlySet<string>) => {
  const shipped: IShipped[] = [];
  const failures: string[] = [];
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: PAGE.width,
    height: PAGE.height,
    deviceScaleFactor: SCALE,
    mobile: false,
  });
  page.on('Runtime.exceptionThrown', (details) =>
    say(`page error: ${JSON.stringify(details).slice(0, 400)}`),
  );
  await page.send('Page.navigate', { url });
  await pageReady(page);
  const forms = (
    await page.evaluate<GraphStyle[]>('window.lookStills.forms()')
  ).filter((style) => only.size === 0 || only.has(style));
  fs.mkdirSync(STILLS_DIR, { recursive: true });
  say(
    `${forms.length} looks, ${PALETTES.length} palette(s), ${GROUPS.length} sets of colours.`,
  );
  const jobs = GROUPS.flatMap((group) =>
    forms.flatMap((style) =>
      PALETTES.map((palette) => ({ group, style, palette })),
    ),
  );
  // One look at a time, on one page.
  await jobs.reduce(
    (before, job) =>
      before.then(async () => {
        const made = await makeStill(page, job);
        shipped.push(made.still);
        if (made.failure) {
          failures.push(made.failure);
        }
        return undefined;
      }),
    Promise.resolve(),
  );
  return { shipped, failures };
};

const main = async () => {
  if (!process.argv.includes('--skip-build')) {
    build();
  }
  fs.copyFileSync(DEMO, path.join(BUILT, 'demo.m4a'));
  const only = new Set(allOf('--only'));
  const server = await serve(BUILT);
  let drawn: Awaited<ReturnType<typeof drawAll>>;
  // The server and the browser go however the run ends: left open, either
  // keeps this process alive after it has failed.
  try {
    const page = await openPage(
      findBrowser(argument('--chrome')),
      PAGE.width,
      PAGE.height,
      ['--disable-gpu', '--disable-background-timer-throttling'],
    );
    try {
      drawn = await drawAll(page, server.url, only);
    } finally {
      await page.close();
    }
  } finally {
    await server.close();
  }
  const { shipped, failures } = drawn;
  // A run of some looks keeps the others' stills as they were; a whole run
  // is the list, and only it says what the stills were drawn from.
  const made = new Set(shipped.map((still) => still.file));
  const kept =
    only.size === 0
      ? []
      : readShipped().filter((still) => !made.has(still.file));
  const listed = [...kept, ...shipped].sort((left, right) =>
    left.file.localeCompare(right.file),
  );
  await writeJson(MANIFEST, listed);
  await writeFilesModule(listed);
  if (only.size === 0) {
    await writeJson(SOURCES_FILE, hashSources(sourcesOfBuild()));
  }
  if (failures.length > 0) {
    throw new Error(
      `These stills are visibly off from their look:\n${failures.join('\n')}`,
    );
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
