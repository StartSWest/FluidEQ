/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import type { GraphPalette, GraphStyle } from '../../src/common/graphStyles';
import { findBrowser, openPage, type IPage } from '../help-captures/cdp';
import BUILT from './built';
import { startCoverage, takeRan, type BundlePlaces } from './coverage';
import type { IStillError } from './fit';
import PLATE_AT from './plate';
import type { IBuildAnswer, IBuildRequest, IShowRequest } from './protocol';
import {
  BOX,
  BROWSER_SWITCHES,
  GROUPS,
  OUT,
  PAGE,
  PALETTES,
  SCALE,
  SEEDS,
} from './request';
import spriteOf from './sprite';
import { STILLS_DIR, writeAtomically, type IShipped } from './stillFiles';

/**
 * The stills' page as the generator (`generate.ts`) drives it: a headless
 * browser on it, each look drawn on a freshly loaded page in every set of
 * colours, what ran while it was drawn counted, and each still laid on a
 * plate and measured against the look.
 */

/**
 * Off by more than this, in steps of 255, on more than one pixel in a
 * hundred, and the still is not the look: the run fails and names it.
 */
const MOST_OFF = 24;

/** The stills' bundle, as the page loads it and its coverage names it. */
export const BUNDLE = 'stills.js';

export const say = (line: string) => process.stdout.write(`${line}\n`);

/** `work` on each item, one after another: one page draws one thing at a time. */
export const inTurn = async <T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  await items.reduce(
    (before, item) =>
      before.then(async () => {
        results.push(await work(item));
        return undefined;
      }),
    Promise.resolve(undefined),
  );
  return results;
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

interface IDrawn {
  group: (typeof GROUPS)[number];
  answer: IBuildAnswer;
  still: IShipped;
  png: Buffer;
}

/** One look's still in one set of colours: drawn, split and written. */
const drawStill = async (
  page: IPage,
  group: (typeof GROUPS)[number],
  style: GraphStyle,
  palette: GraphPalette,
): Promise<IDrawn> => {
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
  return {
    group,
    answer,
    png,
    still: {
      style,
      palette,
      side: group.side,
      colours: group.colours,
      roles: answer.roles,
      file,
    },
  };
};

/** A drawn still laid on a plate and measured: why it fails, if it is visibly off. */
const checkStill = async (
  page: IPage,
  { group, answer, still, png }: IDrawn,
): Promise<string | undefined> => {
  const seen = await seenOnPlate(
    page,
    {
      style: still.style,
      palette: still.palette,
      side: group.side,
      colours: group.colours,
      state: 'ocean',
      url: `./stills/${still.file}`,
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
    `${still.file.padEnd(40)} ${String(Math.round(png.length / 1024)).padStart(4)} KB  roles ${roles}  drift ${answer.coverageDrift}  fit ${answer.fitted.p99.toFixed(0)}  ${measuredText(measured)}  ${(answer.took / 1000).toFixed(1)} s`,
  );
  return worst > MOST_OFF
    ? `${still.file}: p99 ${worst.toFixed(0)} of 255`
    : undefined;
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

/** What every question to a page whose renderer died ends in. */
export class PageCrashed extends Error {
  constructor() {
    super('The stills page crashed.');
    this.name = 'PageCrashed';
  }
}

/** The page, opened on the stills' page and counting what runs on it. */
export const openStillsPage = async (url: string, chrome?: string) => {
  const opened = await openPage(
    findBrowser(chrome),
    PAGE.width,
    PAGE.height,
    BROWSER_SWITCHES,
  );
  // A page whose renderer died answers nothing, and the run waited on it
  // for good (look 38 of 39, 2026-11-27): every question to the page ends
  // when the browser says the page crashed.
  let crashed: (error: Error) => void = () => undefined;
  const crash = new Promise<never>((_resolve, reject) => {
    crashed = reject;
  });
  crash.catch(() => undefined);
  opened.on('Inspector.targetCrashed', () => crashed(new PageCrashed()));
  await opened.send('Inspector.enable');
  const page: IPage = {
    ...opened,
    send: <T>(method: string, params?: object) =>
      Promise.race([opened.send<T>(method, params), crash]),
    evaluate: <T>(expression: string) =>
      Promise.race([opened.evaluate<T>(expression), crash]),
  };
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: PAGE.width,
    height: PAGE.height,
    deviceScaleFactor: SCALE,
    mobile: false,
  });
  page.on('Runtime.exceptionThrown', (details) =>
    say(`page error: ${JSON.stringify(details).slice(0, 400)}`),
  );
  // Code a worker runs is not in the page's coverage, so a still drawn with
  // one would be drawn from code the freshness cannot see.
  const workers: string[] = [];
  page.on('Target.attachedToTarget', (details) => {
    const { targetInfo } = details as {
      targetInfo: { type: string; url: string };
    };
    workers.push(`${targetInfo.type} ${targetInfo.url}`);
  });
  await page.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });
  let loaded: (() => void) | undefined;
  page.on('Page.loadEventFired', () => {
    loaded?.();
    loaded = undefined;
  });
  await startCoverage(page);
  /** A new page of the stills, its code loaded from the start. */
  const fresh = async () => {
    const done = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    await page.send('Page.navigate', { url });
    await Promise.race([done, crash]);
    await pageReady(page);
  };
  return { page, fresh, workers };
};

/**
 * One look in every set of colours, on a page of its own, and what ran
 * while it was drawn. The plates come after every still is drawn, so what
 * their code leaves behind is never under a drawing.
 */
export const drawLook = async (
  { page, fresh, workers }: Awaited<ReturnType<typeof openStillsPage>>,
  places: BundlePlaces,
  style: GraphStyle,
) => {
  // Whatever ran before belongs to no look.
  await takeRan(page, BUNDLE);
  await fresh();
  const drawn = await inTurn(
    GROUPS.flatMap((group) => PALETTES.map((palette) => ({ group, palette }))),
    ({ group, palette }) => drawStill(page, group, style, palette),
  );
  const ran = places.place(await takeRan(page, BUNDLE));
  if (workers.length > 0) {
    throw new Error(
      `A worker ran while ${style} was drawn, and its code is not counted: ${workers.join(', ')}`,
    );
  }
  const failures = (
    await inTurn(drawn, (each) => checkStill(page, each))
  ).flatMap((failure) => failure ?? []);
  return { stills: drawn.map((each) => each.still), failures, ran };
};
