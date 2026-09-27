/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The expanded graph is flush with its column, and every side of the column
 * already has a hairline — the side panes', the title bar's, the player
 * bar's. The card's own line ran just inside each of them as a second one
 * (2026-09-26: "no double border on expanded mode UIs on any").
 */

import path from 'path';
import { compile } from 'sass';

const STYLES = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const rulesFor = (sheet: string, selector: string) => {
  const { css } = compile(path.join(STYLES, sheet), {
    loadPaths: [STYLES],
    quietDeps: true,
  });
  const blocks: string[] = [];
  let at = css.indexOf(`\n${selector} {`);
  while (at >= 0) {
    const open = css.indexOf('{', at);
    blocks.push(css.slice(open + 1, css.indexOf('}', open)));
    at = css.indexOf(`\n${selector} {`, open);
  }
  return blocks.join(' ').replace(/\s+/g, ' ');
};

describe('the expanded graph', () => {
  it('draws no edge of its own beside the column’s', () => {
    const card = rulesFor(
      'GraphTheme.scss',
      '.center-workspace.is-graph-full > .graph-wrapper',
    );
    // Positive control: the rule that places the card was found.
    expect(card).toContain('inset: 0');
    expect(card).toContain('border: 0');
    expect(card).not.toMatch(/border: 1px/);
  });
});
