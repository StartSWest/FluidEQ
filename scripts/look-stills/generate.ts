/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { GraphStyle } from '../../src/common/graphStyles';
import { serve } from '../help-captures/serve';
import BUILT from './built';
import { BundlePlaces } from './coverage';
import {
  DEMO_SONG,
  SOURCES_FILE,
  alwaysUnits,
  piecesOf,
  readKept,
  sourcesOf,
  staleLooks,
  type IPiece,
} from './freshness';
import { GROUPS, PALETTES } from './request';
import {
  STILLS_DIR,
  writeJson,
  writeShipped,
  type IShipped,
} from './stillFiles';
import {
  BUNDLE,
  PageCrashed,
  drawLook,
  inTurn,
  openStillsPage,
  say,
} from './stillPage';
import { ROOT, SourceReader, closeOver, refOf } from './stillSources';

/**
 * Makes the look picker's shipped stills: every standard look, drawn by the
 * window's own renderer on the demo song, split into the window's colours
 * (`src/renderer/graph/lookStills/stillRoles.ts`, `fit.ts`), for each side of
 * the Brightness and for one colour or many.
 *
 *   pnpm stills:looks [--all | --only <style>...] [--skip-build] [--chrome <path>]
 *
 * By itself it draws the looks whose code has changed since their stills
 * were drawn (`freshness.ts`), which is what `lookStillsFresh.test.ts`
 * fails on, and keeps the rest; `--all` draws every look, `--only` the looks
 * named. Each look is drawn on a page of its own, loaded fresh, so what it
 * comes out as never depends on which looks were drawn before it - which is
 * also what makes drawing some of them the same as drawing all of them.
 *
 * Writes `<style>-<palette>-<side>-<colours>.png` into
 * `src/renderer/graph/lookStills/stills` - beside the code that lays them,
 * not in `assets/`, every file of which the installer also ships loose - with
 * the list of them (`stills.json`), the window's copy of it
 * (`shippedStillFiles.ts`) and what each look was drawn from
 * (`sources.json`). Every still is checked against the look drawn in the
 * listener's own colours - Ocean, a picked colour, Black, the white window -
 * in arithmetic, and once more laid on a plate by the window's own
 * component and screenshot; the run fails if one is visibly off.
 */

const STATS = path.join(BUILT, '..', 'fluideq-look-stills-stats.json');

const argument = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

const allOf = (name: string): string[] =>
  process.argv.flatMap((value, index) =>
    process.argv[index - 1] === name ? [value] : [],
  );

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
 * The app's own source files the page was built from, as webpack's stats
 * name them: whose load-time code runs with the page.
 */
const bundledFiles = (): string[] => {
  const stats = JSON.parse(fs.readFileSync(STATS, 'utf8')) as {
    modules?: { name?: string; modules?: { name?: string }[] }[];
  };
  const names = new Set<string>();
  const visit = (list: { name?: string; modules?: { name?: string }[] }[]) =>
    list.forEach((module) => {
      if (module.name) {
        names.add(module.name.replace(/^\.\//, '').split(' ')[0]);
      }
      if (module.modules) {
        visit(module.modules);
      }
    });
  visit(stats.modules ?? []);
  return [...names]
    .filter((name) => /^(src|scripts\/look-stills)\/.*\.tsx?$/.test(name))
    .filter((name) => fs.existsSync(path.join(ROOT, name)))
    .sort();
};

/** Which looks this run draws, and why. */
const lookWanted = (forms: readonly string[], reader: SourceReader) => {
  const only = allOf('--only');
  if (only.length > 0) {
    return only.filter((style) => forms.includes(style));
  }
  if (process.argv.includes('--all')) {
    return forms;
  }
  const stale = staleLooks(readKept(), reader, forms);
  stale.forEach((changed, look) =>
    say(
      `${look}: ${
        changed.length === 0
          ? 'never drawn'
          : changed
              .slice(0, 4)
              .map(({ file, key, how }) => `${file} ${key} ${how}`)
              .join(', ') +
            (changed.length > 4 ? ` and ${changed.length - 4} more` : '')
      }`,
    ),
  );
  return forms.filter((style) => stale.has(style));
};

const main = async () => {
  if (!process.argv.includes('--skip-build')) {
    build();
  }
  fs.copyFileSync(path.join(ROOT, DEMO_SONG), path.join(BUILT, 'demo.m4a'));
  const reader = new SourceReader();
  const bundled = bundledFiles();
  const places = new BundlePlaces(
    fs.readFileSync(path.join(BUILT, BUNDLE), 'utf8'),
    JSON.parse(fs.readFileSync(path.join(BUILT, `${BUNDLE}.map`), 'utf8')),
    reader,
  );
  const always = alwaysUnits(reader);
  const kept = readKept();
  const shipped: IShipped[] = [];
  const failures: string[] = [];
  const pieces = new Map<string, readonly IPiece[]>();
  /**
   * The list and what each look was drawn from, as far as the run has got:
   * written after every look, so a run that dies keeps every look it
   * finished, and the next run draws only the rest. A look not drawn keeps
   * what it was drawn from, changed or not: the check goes on saying so
   * until it is drawn again.
   */
  const record = async (forms: readonly string[]) => {
    await writeShipped(shipped, new Set(forms));
    const listed = new Map(
      forms.flatMap((style): [string, readonly IPiece[]][] => {
        const drawn = pieces.get(style);
        if (drawn) {
          return [[style, drawn]];
        }
        return kept?.looks[style] ? [[style, piecesOf(kept, style)]] : [];
      }),
    );
    await writeJson(SOURCES_FILE, sourcesOf(listed));
  };
  const server = await serve(BUILT);
  // The server and the browser go however the run ends: left open, either
  // keeps this process alive after it has failed.
  try {
    let opened = await openStillsPage(server.url, argument('--chrome'));
    /**
     * A look on the page, and once more on a new browser if the page dies
     * under it: renderers were seen to die mid-run with memory to spare, and
     * every look finished before is already recorded. Twice on one look is
     * not chance, and ends the run.
     */
    const drawn = async (style: GraphStyle) => {
      try {
        return await drawLook(opened, places, style);
      } catch (error: unknown) {
        if (!(error instanceof PageCrashed)) {
          throw error;
        }
        say(`The page crashed while ${style} was drawn: drawing it again.`);
        await opened.page.close();
        opened = await openStillsPage(server.url, argument('--chrome'));
        return drawLook(opened, places, style);
      }
    };
    try {
      await opened.fresh();
      const forms = await opened.page.evaluate<GraphStyle[]>(
        'window.lookStills.forms()',
      );
      const wanted = lookWanted(forms, reader);
      say(
        `${wanted.length} of ${forms.length} looks to draw, ${PALETTES.length} palette(s), ${GROUPS.length} sets of colours.`,
      );
      fs.mkdirSync(STILLS_DIR, { recursive: true });
      // One look at a time, on one page.
      await inTurn(wanted, async (style) => {
        const made = await drawn(style as GraphStyle);
        shipped.push(...made.stills);
        failures.push(...made.failures);
        const included = closeOver(reader, {
          ran: made.ran.ran,
          at: made.ran.at,
          always,
          bundled,
        });
        pieces.set(
          style,
          [...included].flatMap(([id, leftOut]) => {
            const ref = refOf(id);
            const hash = reader.hashOf(ref, leftOut);
            return hash === undefined ? [] : [{ ref, hash, leftOut }];
          }),
        );
        const neverRan = [...included.values()].reduce(
          (sum, leftOut) => sum + leftOut.length,
          0,
        );
        say(
          `${style}: drawn from ${included.size} pieces of code (${made.ran.ran.size} ran; ${neverRan} functions inside them never ran; ${made.ran.skipped} functions not the app's own)`,
        );
        await record(forms);
      });
      // Also when nothing was stale: a look no longer standard loses its
      // stills and its sources.
      await record(forms);
    } finally {
      await opened.page.close();
    }
  } finally {
    await server.close();
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
