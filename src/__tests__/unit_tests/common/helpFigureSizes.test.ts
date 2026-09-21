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
 * The icon beside each control in Help and in the exported guide is a crop of
 * the screenshot: the element is given a `background-size` computed from the
 * DECLARED width and height, and a `background-position` from the control's
 * own coordinates. Recapture a screenshot at another size and the declaration
 * is left behind — every crop is then scaled by the ratio between the two and
 * lands somewhere else in the image, which shows as an empty square beside
 * each control.
 *
 * That is exactly what shipped: the DSP page was recaptured at 1976x622 and
 * its twelve controls were moved to match, while the figure went on claiming
 * 2560x1392. The crops were stretched 1.3x across and 2.2x down, off the end
 * of the rail and onto bare background, in the app's own Help as well as the
 * exported guide. Nothing could see it — no test reads the file, and the
 * `<img>` beside it is scaled by CSS, so the screenshot itself looked right.
 *
 * The declared size is also what `helpCaptureWidth` lays the figure out by, so
 * a wrong one gives the capture the wrong aspect ratio as well.
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

  it('keeps every crop inside the screenshot it is cut from', () => {
    figures.forEach((figure) => {
      (figure.controls ?? []).forEach((control) => {
        [control.box, control.icon].forEach((area) => {
          if (!area) {
            return;
          }
          const [x, y, width, height] = area;
          expect({
            image: figure.image,
            right: x + width <= figure.width,
            bottom: y + height <= figure.height,
          }).toEqual({ image: figure.image, right: true, bottom: true });
        });
      });
    });
  });
});
