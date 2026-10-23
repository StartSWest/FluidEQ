/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findBrowser, openPage, type IPage } from './cdp';
import { FIGURES, type IFigureSpec } from './figures';
import { serve } from './serve';
import BUILT from './built';

/**
 * Takes the guide's 2.1 figures from the real window, and measures every
 * numbered control's box in the same render as the picture.
 *
 *   pnpm exec ts-node scripts/help-captures/capture.ts [options]
 *
 *   --only <image>      one figure, e.g. --only 18-eq-mode.png (repeatable)
 *   --chrome <path>     the browser; otherwise CHROME_PATH, Chrome or Edge
 *   --docs <dir>        where the pictures go (default docs/)
 *   --boxes <file>      where the boxes go
 *                       (default src/common/helpChapters/captured.ts)
 *   --skip-build        use the harness as last built
 *
 * Each picture and its boxes are written together, so the two can never
 * disagree; a figure left out with --only keeps what the boxes file already
 * had for it. Both are written beside their target and renamed into place,
 * the way every file the app writes is. See README.md for the Windows run.
 */

const ROOT = path.resolve(__dirname, '../..');
const HERE = __dirname;
const WINDOW = { width: 2560, height: 1392 };

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ICapturedControl {
  box: [number, number, number, number];
  name: string;
  text: string;
  keys?: string;
}

interface ICapturedFigure {
  image: string;
  width: number;
  height: number;
  caption?: string;
  controls?: ICapturedControl[];
}

const argument = (name: string): string[] =>
  process.argv.flatMap((value, at) =>
    value === name && process.argv[at + 1] ? [process.argv[at + 1]] : [],
  );

/** What the run is doing, on the terminal it was started from. */
const say = (line: string) => process.stdout.write(`${line}\n`);

const writeAtomically = (file: string, bytes: string | Buffer) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
};

/**
 * What the steps and finders are written against (`figures.ts`). Waiting is
 * by frames painted, never by a clock: `until` gives up after a number of
 * frames, and `settle` waits on the fonts and on every animation that ends.
 */
const HELPERS = `
(() => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
  const $ = (css, root = document) => root.querySelector(css);
  const $$ = (css, root = document) => [...root.querySelectorAll(css)];
  const ownText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim();
  const byText = (root, words) => {
    if (!root) return null;
    const all = [root, ...root.querySelectorAll('*')];
    return all.find((element) => ownText(element).startsWith(words)) ?? null;
  };
  const rowOf = (element) =>
    element?.closest('button, [role=menuitem], [role=menuitemcheckbox], label, a') ?? element;
  const union = (...elements) => elements.filter(Boolean);
  const until = async (test, frames = 900) => {
    for (let at = 0; at < frames; at += 1) {
      if (test()) return;
      await frame();
    }
    throw new Error('Never became true: ' + test.toString());
  };
  const click = (element) => {
    if (!element) throw new Error('Nothing to click');
    const box = element.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
      button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    element.dispatchEvent(new PointerEvent('pointerdown', at));
    element.dispatchEvent(new MouseEvent('mousedown', at));
    element.dispatchEvent(new PointerEvent('pointerup', { ...at, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...at, buttons: 0 }));
  };
  const settle = async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await frame();
    await frame();
  };
  const rectOf = (found) => {
    const elements = (Array.isArray(found) ? found : [found]).filter(Boolean);
    if (elements.length === 0) return null;
    const boxes = elements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  };
  Object.assign(window, { __capture: { frame, $, $$, byText, rowOf, union, until, click, settle, rectOf } });
})();
`;

const inPage = (body: string) =>
  `(async () => { const { frame, $, $$, byText, rowOf, union, until, click, settle, rectOf } = window.__capture; ${body} })()`;

const rectOf = async (page: IPage, finder: string): Promise<IRect> => {
  const rect = await page.evaluate<IRect | null>(
    inPage(`return rectOf(${finder});`),
  );
  if (!rect) {
    throw new Error(`Found nothing for ${finder}`);
  }
  return rect;
};

const takeFigure = async (
  page: IPage,
  url: string,
  figure: IFigureSpec,
): Promise<{ picture: Buffer; captured: ICapturedFigure }> => {
  const viewport = figure.viewport ?? WINDOW;
  await page.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const settings = encodeURIComponent(JSON.stringify(figure.settings ?? {}));
  await page.send('Page.navigate', { url: `${url}?settings=${settings}` });
  await page.evaluate(
    `new Promise((done) => document.readyState === 'complete' ? done() : addEventListener('load', () => done(), { once: true }))`,
  );
  await page.evaluate(HELPERS);
  await page.evaluate(inPage(`await until(() => $('#root > *'));`));
  // Steps one at a time, each followed by the page settling, as a person
  // waits to see what a press did before pressing the next thing.
  const runStep = async (step: string) => {
    try {
      await page.evaluate(inPage(`${step}; await settle();`));
    } catch (error) {
      throw new Error(`${figure.image}, at ${step}: ${String(error)}`);
    }
  };
  await figure.steps.reduce(
    (before, step) => before.then(() => runStep(step)),
    Promise.resolve(),
  );
  if (figure.blur) {
    await page.evaluate(
      inPage(
        `$$(${JSON.stringify(figure.blur)}).forEach((element) => { element.style.filter = 'blur(7px)'; }); await settle();`,
      ),
    );
  }
  // Nothing under the pointer: a hover state is not part of any figure.
  await page.evaluate(
    inPage(`document.activeElement?.blur?.(); await settle();`),
  );

  const pad = figure.pad ?? 0;
  const crop =
    figure.crop === 'window'
      ? { x: 0, y: 0, ...viewport }
      : await rectOf(page, figure.crop);
  const left = Math.max(0, Math.floor(crop.x - pad));
  const top = Math.max(0, Math.floor(crop.y - pad));
  const right = Math.min(viewport.width, Math.ceil(crop.x + crop.width + pad));
  const bottom = Math.min(
    viewport.height,
    Math.ceil(crop.y + crop.height + pad),
  );
  const clip = { x: left, y: top, width: right - left, height: bottom - top };

  const controls = await figure.controls.reduce<Promise<ICapturedControl[]>>(
    async (before, control) => {
      const done = await before;
      const box = await rectOf(page, control.find);
      const x = Math.round(box.x - clip.x);
      const y = Math.round(box.y - clip.y);
      return [
        ...done,
        {
          box: [x, y, Math.round(box.width), Math.round(box.height)],
          name: control.name,
          text: control.text,
          ...(control.keys ? { keys: control.keys } : {}),
        },
      ];
    },
    Promise.resolve([]),
  );

  const shot = await page.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: false,
  });
  return {
    picture: Buffer.from(shot.data, 'base64'),
    captured: {
      image: figure.image,
      width: clip.width,
      height: clip.height,
      ...(figure.caption ? { caption: figure.caption } : {}),
      ...(controls.length > 0 ? { controls } : {}),
    },
  };
};

const HEADER = `/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpFigure } from './model';

/**
 * WRITTEN BY \`scripts/help-captures/capture.ts\`; do not edit by hand.
 *
 * The figures that script takes, each with the boxes of its numbered
 * controls as measured in the same render as the picture in \`docs/\`. Retake
 * a picture and its boxes come with it: run the script again (its README says
 * how), never move a box here.
 */
`;

const readExisting = (file: string): Record<string, ICapturedFigure> => {
  if (!fs.existsSync(file)) {
    return {};
  }
  // This script runs under ts-node, which reads the boxes file as it reads
  // any other module.
  // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-require-imports -- the file named on the command line, read once
  const loaded = require(file) as { default: Record<string, ICapturedFigure> };
  return { ...loaded.default };
};

const writeBoxes = (file: string, figures: Record<string, ICapturedFigure>) => {
  writeAtomically(
    file,
    `${HEADER}const CAPTURED = ${JSON.stringify(figures, null, 2)} as const satisfies Record<string, IHelpFigure>;\n\nexport default CAPTURED;\n`,
  );
  spawnSync('pnpm', ['exec', 'prettier', '--write', file], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

const build = () => {
  // Emptied here rather than by either compiler, which share the folder.
  fs.rmSync(BUILT, { recursive: true, force: true });
  const built = spawnSync(
    'pnpm',
    ['exec', 'webpack', '--config', path.join(HERE, 'webpack.config.ts')],
    {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TS_NODE_TRANSPILE_ONLY: 'true',
      },
    },
  );
  if (built.status !== 0) {
    throw new Error('The harness did not build.');
  }
};

const main = async () => {
  const only = argument('--only');
  const docs = path.resolve(argument('--docs')[0] ?? path.join(ROOT, 'docs'));
  const boxes = path.resolve(
    argument('--boxes')[0] ??
      path.join(ROOT, 'src/common/helpChapters/captured.ts'),
  );
  const chosen = FIGURES.filter(
    (figure) => only.length === 0 || only.includes(figure.image),
  );
  if (chosen.length === 0) {
    throw new Error(`No figure called ${only.join(', ')}.`);
  }
  if (!process.argv.includes('--skip-build')) {
    build();
  }
  fs.mkdirSync(docs, { recursive: true });
  const server = await serve(BUILT);
  const page = await openPage(
    findBrowser(argument('--chrome')[0]),
    WINDOW.width,
    WINDOW.height,
  );
  page.on('Runtime.exceptionThrown', (raw) => {
    const thrown = raw as {
      exceptionDetails: { exception?: { description?: string } };
    };
    process.stderr.write(
      `${thrown.exceptionDetails.exception?.description ?? 'An exception'}\n`,
    );
  });
  const captured = readExisting(boxes);
  try {
    await chosen.reduce(
      (before, figure) =>
        before.then(async () => {
          say(`${figure.image}: taking`);
          const taken = await takeFigure(page, server.url, figure);
          writeAtomically(path.join(docs, figure.image), taken.picture);
          captured[figure.image] = taken.captured;
          say(
            `${figure.image}: ${taken.captured.width} x ${taken.captured.height}, ${taken.captured.controls?.length ?? 0} boxes`,
          );
          return undefined;
        }),
      Promise.resolve(),
    );
    const unanswered = await page.evaluate<string[]>(
      `[...(window.fluidEqHarness?.unanswered ?? [])]`,
    );
    if (unanswered.length > 0) {
      say(`Channels the harness left unanswered: ${unanswered.join(' ')}`);
    }
  } finally {
    await page.close();
    await server.close();
  }
  // In the guide's own order, whatever order they were taken in.
  const ordered = Object.fromEntries(
    FIGURES.flatMap((figure) =>
      captured[figure.image] ? [[figure.image, captured[figure.image]]] : [],
    ),
  );
  writeBoxes(boxes, ordered);
};

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
