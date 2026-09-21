/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one rule that gives the level meter its height.
 *
 * The visualizer card is the only card in the left column with something
 * inside that can use the space, so it takes what the others leave and the
 * meter grows into it — more resolution per decibel, and no dead half-column
 * under the switch. The rule has now been lost twice: once written so it never
 * applied (a class alone loses to `.side-bar > div`), and once simply deleted,
 * after which the card shrank to its contents and the meter sat at its 96px
 * floor with 564px of empty column under it, measured in the running window.
 *
 * Neither failure is visible to any other test: jsdom lays nothing out, and
 * every query by role passes either way. So the rule is held here, as text.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const { css } = compile(path.join(STYLES_DIR, 'SideBar.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/** The body of the first rule whose selector contains `selector`. */
const bodyOf = (selector: string): string => {
  const at = css.indexOf(selector);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

it('gives the visualizer card the rest of the column, through the parent', () => {
  // Through `.side-bar >`, or it loses to `.side-bar > div { flex: 0 0 auto }`
  // on specificity and does nothing at all.
  const body = bodyOf('.side-bar > .side-bar__response');
  expect(body).not.toBe('');
  expect(body).toContain('flex: 1 0 158px');
  expect(body).toContain('align-self: stretch');
  // Enough room for its label, switch and the meter's own minimum: the pane
  // scrolls, and a card allowed to collapse pushed its children up through
  // the card above before the scrollbar could help.
  expect(body).toContain('min-height: 158px');
});
