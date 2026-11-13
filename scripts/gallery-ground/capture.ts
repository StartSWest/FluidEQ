/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findBrowser, openPage } from '../help-captures/cdp';
import { serve } from '../help-captures/serve';
import BUILT from './built';

/**
 * Takes the picture behind the signed-out Visualizers page
 * (`assets/plus/gallery-ground.jpg`) from the gallery's own components.
 * Run it before each release, so the page shows the gallery as it looks now:
 *
 *   pnpm docs:gallery-ground [--chrome <path>] [--skip-build]
 *
 * A headless Chrome or Edge draws the gallery at 1920 x 1080, one CSS pixel
 * to one device pixel, and writes it as JPEG, stepping the quality down until
 * the file is at most `MAX_BYTES`: the page covers every window with it, under
 * a veil, so the detail past that is never seen. Waits on the pictures and the
 * fonts having painted, never on a clock.
 */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets', 'plus', 'gallery-ground.jpg');
const WINDOW = { width: 1920, height: 1080 };
const MAX_BYTES = 160 * 1024;
const QUALITIES = [72, 64, 56, 48, 40];

const say = (line: string) => process.stdout.write(`${line}\n`);

const argument = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

const build = () => {
  say('Building the gallery drawing…');
  const built = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'webpack', 'bin', 'webpack.js'),
      '--config',
      path.join(__dirname, 'webpack.config.ts'),
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  if (built.status !== 0) {
    throw new Error('The gallery drawing did not build.');
  }
};

const PAINTED = `new Promise(async (done) => {
  const frame = () => new Promise((next) => requestAnimationFrame(() => next()));
  for (let at = 0; at < 1800; at += 1) {
    const pictures = [...document.querySelectorAll('.gallery-picture')];
    const ready = pictures.length > 0 && pictures.every((picture) => {
      const image = picture.querySelector('img');
      return image && image.complete && image.naturalWidth > 0;
    });
    if (ready) {
      await document.fonts.ready;
      await Promise.all(document.getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)));
      await frame();
      await frame();
      done(pictures.length);
      return;
    }
    await frame();
  }
  done(0);
})`;

const main = async () => {
  if (!process.argv.includes('--skip-build')) {
    build();
  }
  const server = await serve(BUILT);
  const page = await openPage(
    findBrowser(argument('--chrome')),
    WINDOW.width,
    WINDOW.height,
  );
  try {
    await page.send('Page.navigate', { url: server.url });
    const painted = await page.evaluate<number>(PAINTED);
    if (painted === 0) {
      throw new Error('The gallery never painted its pictures.');
    }
    say(`${painted} cards painted.`);
    // Each quality is taken only when the one before came out too big.
    const shoot = async (at: number): Promise<void> => {
      const quality = QUALITIES[at];
      const last = at === QUALITIES.length - 1;
      const { data } = await page.send<{ data: string }>(
        'Page.captureScreenshot',
        { format: 'jpeg', quality, captureBeyondViewport: false },
      );
      const bytes = Buffer.from(data, 'base64');
      if (bytes.length > MAX_BYTES && !last) {
        await shoot(at + 1);
        return;
      }
      const temporary = `${OUT}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, bytes);
      fs.renameSync(temporary, OUT);
      const size = `${Math.round(bytes.length / 1024)} KB`;
      say(
        bytes.length > MAX_BYTES
          ? `Wrote ${path.relative(ROOT, OUT)}: still ${size} at the lowest quality.`
          : `Wrote ${path.relative(ROOT, OUT)}: ${size} at quality ${quality}.`,
      );
    };
    await shoot(0);
  } finally {
    await page.close();
    await server.close();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
