/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { HELP_CHAPTERS } from '../../../common/helpGuide';

/**
 * Every help figure's declared size against the screenshot actually on disk.
 *
 * Every numbered call-out in Help and in the exported guide is placed by its
 * control's box, scaled by the DECLARED width and height. Recapture a
 * screenshot at another size and the declaration is left behind — every box
 * then lands somewhere else on the picture, and every line points at the
 * wrong thing.
 *
 * That is what shipped once already, when the controls still carried a crop
 * of the screenshot beside them: the DSP page was recaptured at 1976x622 and
 * its twelve controls were moved to match, while the figure went on claiming
 * 2560x1392. The crops were stretched 1.3x across and 2.2x down onto bare
 * background, in the app's own Help and in the exported guide alike. Nothing
 * could see it — no test read the file, and the capture itself is scaled by
 * CSS, so it looked perfectly right.
 */

const DOCS = path.join(__dirname, '../../../../docs');

/** A PNG's real size: IHDR is the first chunk, big-endian at 16 and 20. */
const pngSize = (file: string): { width: number; height: number } => {
  const bytes = fs.readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const figures = HELP_CHAPTERS.flatMap((chapter) => chapter.figures);

describe('help figures', () => {
  it('declares the size the screenshot on disk actually is', () => {
    expect(figures.length).toBeGreaterThan(0);
    // Collected rather than asserted one at a time: the first wrong figure
    // would otherwise hide the rest, and they arrive in batches — a page
    // recaptured for a release brings all of its figures with it.
    const wrong = figures
      .map((figure) => {
        const file = path.join(DOCS, figure.image);
        if (!fs.existsSync(file)) {
          return `${figure.image}: no such file in docs`;
        }
        const real = pngSize(file);
        return real.width === figure.width && real.height === figure.height
          ? ''
          : `${figure.image}: declared ${figure.width}x${figure.height}, file is ${real.width}x${real.height}`;
      })
      .filter(Boolean);
    expect(wrong).toEqual([]);
  });

  // The control above passes just as well if the reader answers one constant
  // for every file, which is the way a size check quietly stops checking.
  it('reads a size out of the file rather than answering a constant', () => {
    const sizes = new Set(
      figures.map((figure) => {
        const { width, height } = pngSize(path.join(DOCS, figure.image));
        return `${width}x${height}`;
      }),
    );
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('keeps every control inside the screenshot it is on', () => {
    const outside = figures.flatMap((figure) =>
      (figure.controls ?? [])
        .filter(
          ({ box: [x, y, width, height] }) =>
            x < 0 ||
            y < 0 ||
            x + width > figure.width ||
            y + height > figure.height,
        )
        .map((control) => `${figure.image}: ${control.name}`),
    );
    expect(outside).toEqual([]);
  });
});
