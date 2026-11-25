/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { HELP_CHAPTERS, isLiveFigure } from '../../src/common/helpGuide';
import BUILT from './built';
import { findBrowser, openPage, type IPage } from './cdp';
import { ROOT, buildHarness, writeAtomically } from './harnessBuild';
import { HELPERS, inPage } from './pageHelpers';
import { serve } from './serve';

/**
 * Takes the exported guide's picture of every live figure from the figure
 * itself: the guide opened in the harness's window (F1), each figure
 * scrolled to, drawn, its numbered circles placed, and cut at twice the
 * pixels, so the document shows what the app shows and never a capture older
 * than the panel.
 *
 *   pnpm docs:stills [options]
 *
 *   --only <live id>    one figure, e.g. --only rail-left (repeatable)
 *   --chrome <path>     the browser; otherwise CHROME_PATH, Chrome or Edge
 *   --docs <dir>        where the pictures go (default docs/)
 *   --skip-build        use the harness as last built
 *
 * Each picture is `<docs>/<still>`, the path its figure names (`help/<live
 * id>.png`), and for the figures the README shows (`PLAIN`) the same
 * drawing without its circles in `help/plain/`. In English and the window's
 * default colours, on a window as wide as the guide's illustrated edition
 * reads; run `pnpm docs:guide` after it.
 */

/** Wide enough that the guide's column is the illustrated edition's. */
const WINDOW = { width: 1600, height: 2000 };

/** Twice the pixels: the document is read on high-density screens too. */
const SCALE = 2;

/**
 * Painted frames a figure plays its made-up music for before it is cut, so a
 * meter or a wave is caught moving rather than at its first frame.
 */
const MUSIC_FRAMES = 45;

/** Painted frames a short count of circles must hold before it is believed. */
const STEADY_FRAMES = 60;

/**
 * The figures the README shows, also taken plain into `help/plain/<live
 * id>.png`: the README has no list for the circles to point into, so there
 * they would be numbers that say nothing.
 */
const PLAIN = new Set([
  'config-page',
  'convolution-page',
  'dsp-denoise',
  'dsp-overview',
  'dsp-room',
  'eq-page',
  'gallery-scene',
  'headphones-page',
  'karaoke-stage',
  'library-page',
  'library-record',
  'maker-editor',
  'online-page',
  'share-page',
  'sound-panel',
  'studio-bench',
]);

const argument = (name: string): string[] =>
  process.argv.flatMap((value, at) =>
    value === name && process.argv[at + 1] ? [process.argv[at + 1]] : [],
  );

const say = (line: string) => process.stdout.write(`${line}\n`);

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IWanted {
  chapter: string;
  index: number;
  live: string;
  still: string;
  controls: number;
}

const figureIn = (wanted: IWanted) =>
  `$$('.help-figure', document.getElementById(${JSON.stringify(`help-${wanted.chapter}`)})?.closest('section') ?? document)[${wanted.index}]`;

const takeStill = async (page: IPage, wanted: IWanted): Promise<Buffer> => {
  const figure = figureIn(wanted);
  // To the figure, which mounts its drawing as it nears the view, then the
  // drawing measured and every numbered circle placed on it.
  // A circle whose control the drawing does not hold is left out, as the
  // guide leaves it out for a reader: waited for until the count stops
  // changing, and said, because the reader is missing it too.
  const circles = await page.evaluate<number>(
    inPage(`
      const figure = ${figure};
      if (!figure) throw new Error('No figure ${wanted.chapter} #${wanted.index}');
      figure.scrollIntoView({ block: 'start' });
      await until(() => figure.querySelector('.help-figure__frame .help-live'));
      const count = () => figure.querySelectorAll('.help-callout').length;
      let last = -1;
      let still = 0;
      while (count() !== ${wanted.controls} && still < ${STEADY_FRAMES}) {
        await frame();
        still = count() === last ? still + 1 : 0;
        last = count();
      }
      await Promise.all(
        [...figure.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)),
      );
      await settle();
      for (let at = 0; at < ${MUSIC_FRAMES}; at += 1) await frame();
      document.activeElement?.blur?.();
      await settle();
      return count();
    `),
  );
  if (circles !== wanted.controls) {
    say(
      `${wanted.live}: ${circles} of its ${wanted.controls} circles drawn — a control it names is not in the drawing`,
    );
  }
  return cut(page, wanted, `${figure}?.querySelector('.help-figure__frame')`);
};

/** The part `finder` finds, as the window paints it now. */
const cut = async (
  page: IPage,
  wanted: IWanted,
  finder: string,
): Promise<Buffer> => {
  const rect = await page.evaluate<IRect | null>(
    inPage(`
      const part = ${finder};
      if (!part) return null;
      const box = part.getBoundingClientRect();
      return { x: box.left, y: box.top, width: box.width, height: box.height };
    `),
  );
  if (!rect) {
    throw new Error(`${wanted.live}: its frame is gone`);
  }
  if (rect.y < 0 || rect.y + rect.height > WINDOW.height) {
    throw new Error(
      `${wanted.live}: ${Math.round(rect.height)}px tall, more than the window shows`,
    );
  }
  const clip = {
    x: Math.floor(rect.x),
    y: Math.floor(rect.y),
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };
  const shot = await page.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: false,
  });
  return Buffer.from(shot.data, 'base64');
};

/**
 * The same figure, just drawn, with no circle, lead or ring over it: for a
 * page that shows the picture without the list its numbers point into.
 */
const takePlain = async (page: IPage, wanted: IWanted): Promise<Buffer> => {
  const figure = figureIn(wanted);
  await page.evaluate(
    inPage(`
      const bare = document.createElement('style');
      bare.id = 'stills-plain';
      bare.textContent = '.help-callouts, .help-callout, .help-figure__ring { visibility: hidden !important; }';
      document.head.append(bare);
      await settle();
    `),
  );
  try {
    return await cut(
      page,
      wanted,
      `${figure}?.querySelector('.help-figure__live')`,
    );
  } finally {
    await page.evaluate(
      `(() => { document.getElementById('stills-plain')?.remove(); return 1; })()`,
    );
  }
};

const main = async () => {
  const only = argument('--only');
  const docs = path.resolve(argument('--docs')[0] ?? path.join(ROOT, 'docs'));
  const wanted: IWanted[] = HELP_CHAPTERS.flatMap((chapter) =>
    chapter.figures.flatMap((figure, index) =>
      isLiveFigure(figure) && (only.length === 0 || only.includes(figure.live))
        ? [
            {
              chapter: chapter.id,
              index,
              live: figure.live,
              still: figure.still,
              controls: figure.controls?.length ?? 0,
            },
          ]
        : [],
    ),
  );
  if (wanted.length === 0) {
    throw new Error(`No live figure called ${only.join(', ')}.`);
  }
  if (!process.argv.includes('--skip-build')) {
    buildHarness();
  }
  const server = await serve(BUILT);
  // Software GL: a run beside somebody's work must not take their GPU.
  const page = await openPage(
    findBrowser(argument('--chrome')[0]),
    WINDOW.width,
    WINDOW.height,
    ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  );
  page.on('Runtime.exceptionThrown', (raw) => {
    const thrown = raw as {
      exceptionDetails: { exception?: { description?: string } };
    };
    process.stderr.write(
      `${thrown.exceptionDetails.exception?.description ?? 'An exception'}\n`,
    );
  });
  // A figure that crashes is caught by the window's error boundary, which
  // logs it and takes the figure's frame down: said here, or all the run
  // can report is a frame that went missing.
  page.on('Runtime.consoleAPICalled', (raw) => {
    const called = raw as {
      type: string;
      args: { value?: unknown; description?: string }[];
    };
    if (called.type === 'error') {
      process.stderr.write(
        `${called.args.map((arg) => String(arg.value ?? arg.description)).join(' ')}\n`,
      );
    }
  });
  try {
    await page.send('Emulation.setDeviceMetricsOverride', {
      ...WINDOW,
      deviceScaleFactor: SCALE,
      mobile: false,
    });
    say('Opening the window');
    await page.send('Page.navigate', { url: server.url });
    await page.evaluate(
      `new Promise((done) => document.readyState === 'complete' ? done() : addEventListener('load', () => done(), { once: true }))`,
    );
    await page.evaluate(HELPERS);
    await page.evaluate(inPage(`await until(() => $('#root > *'));`));
    say('Opening the guide');
    await page.evaluate(
      inPage(`

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
        await until(() => $('.help-figure'));
        // Only the guide is pictured, and in software GL the window behind
        // it and the blur over that cost most of every frame: measured at 3
        // frames a second with them, 8 without, 60 with nothing shown.
        const guide = $('.help-guide');
        [...document.body.children].forEach((child) => {
          if (child !== guide && !child.contains(guide)) child.style.display = 'none';
        });
        const plain = document.createElement('style');
        plain.textContent = 'dialog::backdrop { backdrop-filter: none !important; background: #000 !important; } dialog, dialog * { backdrop-filter: none !important; }';
        document.head.append(plain);
        await settle();
      `),
    );
    await wanted.reduce(
      (before, one) =>
        before.then(async () => {
          say(`${one.still}: taking`);
          const picture = await takeStill(page, one);
          const file = path.join(docs, one.still);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          writeAtomically(file, picture);
          say(`${one.still}: ${one.chapter}, figure ${one.index + 1}`);
          if (PLAIN.has(one.live)) {
            const plain = path.join(docs, 'help', 'plain', `${one.live}.png`);
            fs.mkdirSync(path.dirname(plain), { recursive: true });
            writeAtomically(plain, await takePlain(page, one));
            say(`help/plain/${one.live}.png`);
          }
          return undefined;
        }),
      Promise.resolve(),
    );
  } finally {
    await page.close();
    await server.close();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
