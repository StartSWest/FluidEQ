/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The title bar's wave ends in the app's own corners (Ivan, 2026-09-26: "add
 * our border radius to the top wave wrapper too"), with still no fill and no
 * rim of its own (2026-09-25). The corners are a clip on the drawing: a
 * radius alone does not clip a composited canvas in Chromium, which is why
 * the path is held here beside it. jsdom lays nothing out, so the rules are
 * held as text; how they look was checked in the served window.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const { css } = compile(path.join(STYLES_DIR, 'WaveformVisualizer.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/** The body of the first rule whose selector is exactly `selector`. */
const bodyOf = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};

describe('the title bar wave', () => {
  it('clips its drawing to the app corners', () => {
    const stage = bodyOf('.waveform-visualizer__stage');
    expect(stage).toContain('border-radius: 8px');
    expect(stage).toContain('clip-path: inset(0 round 8px)');
  });

  it('rounds its focus ring the same way and still draws no box', () => {
    const pane = bodyOf('.waveform-visualizer');
    expect(pane).toContain('border-radius: 8px');
    expect(pane).toContain('background: transparent');
    expect(pane).toContain('border: 1px solid transparent');
  });
});
