/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import BUILT from './built';
import { findBrowser, openPage, type IPage } from './cdp';
import { serve } from './serve';

/**
 * What's New's slides for this release, taken to be looked at — never
 * shipped: the tour draws its own pictures, so these are only for judging
 * them, at the guide's window size in English and at a small window in the
 * two languages with the longest text.
 *
 *   pnpm exec ts-node scripts/help-captures/tour.ts --out <dir> [--slides 4]
 *
 * Run `capture.ts` first: this reads the harness it built.
 */

const argument = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

const VIEWS: readonly { locale: string; width: number; height: number }[] = [
  { locale: 'en', width: 2560, height: 1392 },
  { locale: 'de', width: 1280, height: 800 },
  { locale: 'ru', width: 1280, height: 800 },
];

/** Painted, its fonts in, and every animation that ends ended. */
const SETTLE = `document.fonts.ready
  .then(() => Promise.all(document.getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))))
  .then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))`;

const UNTIL_RAIL = `new Promise((done, fail) => {
  let frames = 0;
  const look = () => {
    if (document.querySelector('.feature-tour__rail-item')) done();
    else if ((frames += 1) > 900) fail(new Error('The tour never opened.'));
    else requestAnimationFrame(look);
  };
  look();
})`;

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const takeSlides = async (
  page: IPage,
  url: string,
  view: (typeof VIEWS)[number],
  slides: number,
  out: string,
) => {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: view.width,
    height: view.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // The tour opens by itself on a version not yet dismissed.
  const settings = encodeURIComponent(
    JSON.stringify({
      'fluideq.featureTourDismissed': '',
      'fluideq.locale': view.locale,
    }),
  );
  await page.send('Page.navigate', { url: `${url}?settings=${settings}` });
  await page.evaluate(UNTIL_RAIL);
  const indexes = Array.from({ length: slides }, (_, at) => at);
  await indexes.reduce(
    (before, at) =>
      before.then(async () => {
        await page.evaluate(
          `document.querySelectorAll('.feature-tour__rail-item')[${at}].click()`,
        );
        await page.evaluate(SETTLE);
        const clip = await page.evaluate<IRect>(
          `(() => { const box = document.querySelector('.feature-tour').getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })()`,
        );
        const shot = await page.send<{ data: string }>(
          'Page.captureScreenshot',
          { format: 'png', clip: { ...clip, scale: 1 } },
        );
        fs.writeFileSync(
          path.join(
            out,
            `whats-new-${at + 1}-${view.locale}-${view.width}x${view.height}.png`,
          ),
          Buffer.from(shot.data, 'base64'),
        );
        return undefined;
      }),
    Promise.resolve(),
  );
};

const main = async () => {
  const out = path.resolve(argument('--out') ?? 'whats-new');
  const slides = Number(argument('--slides') ?? 4);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve(BUILT);
  const page = await openPage(findBrowser(argument('--chrome')), 2560, 1392);
  try {
    await VIEWS.reduce(
      (before, view) =>
        before.then(() => takeSlides(page, server.url, view, slides, out)),
      Promise.resolve(),
    );
  } finally {
    await page.close();
    await server.close();
  }
  process.stdout.write(`What's New slides written to ${out}\n`);
};

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
