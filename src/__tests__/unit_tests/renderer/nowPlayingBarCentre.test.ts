/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player bar's row in the middle of the bar (Ivan, 2026-09-26: "the play
 * bar's controls not centered vertically"). In a window up to 900px tall the
 * bar is 52px, and 6px of padding either side left 39px for a track column
 * 44px tall: the row overflowed downwards and the keys stood 14px under the
 * top edge and 8px over the bottom one. jsdom lays nothing out, so what is
 * held here is the room the rules leave the row — measured in the running
 * window at 11 and 11 once it had it.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import path from 'path';
import { compile } from 'sass';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const { css } = compile(path.join(STYLES_DIR, 'NowPlayingBar.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/** The body of the bar's own rule inside the short-window query. */
const shortBar = (): string => {
  const query = css.indexOf('@media (max-height: 900px)');
  expect(query).toBeGreaterThanOrEqual(0);
  const rule = css.indexOf('.now-playing-bar,', query);
  return css.slice(rule, css.indexOf('}', rule));
};

/** Its track column: the three lines, the press-target's padding and edge. */
const TRACK_COLUMN_PX = 38 + 2 * 2 + 2 * 1;

describe('the player bar in a short window', () => {
  it('leaves the row the whole bar, so it is centred whatever it holds', () => {
    const rule = shortBar();
    expect(rule).toContain('height: 52px');
    expect(rule).toContain('padding-block: 0');
  });

  // The control: at the padding it had, the track column did not fit, which
  // is what pushed the row down.
  it('had less room than its track column at the old padding', () => {
    const top = 1; // the bar's hairline
    expect(52 - top - 2 * 6).toBeLessThan(TRACK_COLUMN_PX);
    expect(52 - top).toBeGreaterThanOrEqual(TRACK_COLUMN_PX);
  });
});
