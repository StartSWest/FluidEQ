/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * In the Studio's full screen the stage is the part of the screen the chat
 * and the work pane leave (Ivan, 2026-11-12: "when I go full screen the
 * image gets cut by the panels"): it ran under both, and the scene's foot
 * and right side could be neither seen nor reached. The stage measures its
 * own box and the scene fits it, so the box is what is held here; jsdom lays
 * nothing out, so it is the compiled rule, with the panels' own rules as the
 * control that they still stand over the screen where they were.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const css = compile(path.join(STYLES_DIR, 'StudioFullscreen.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
}).css.replace(/\s+/g, ' ');

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open)).trim();
};

const GRID = '.studio-bench__grid.is-full';

describe('the stage in the Studio’s full screen', () => {
  it('stops at the chat’s edge while the chat is out', () => {
    expect(rule(`${GRID}.is-chat-out .studio-bench__stage`)).toContain(
      'right: var(--studio-chat-width-now, 0px)',
    );
  });

  it('stops at the work pane’s top while the pane is out, at its height', () => {
    expect(rule(`${GRID}.is-pane-out .studio-bench__stage`)).toContain(
      'bottom: var(--studio-full-pane, 40%)',
    );
  });

  it('covers the screen with both away', () => {
    expect(rule(`${GRID} .studio-bench__stage`)).toContain('inset: 0');
  });

  it('control: the pane and the chat still stand over the screen, the pane to the chat’s edge', () => {
    expect(rule(`${GRID} .studio-work`)).toContain(
      'height: var(--studio-full-pane, 40%)',
    );
    expect(rule(`${GRID}.is-chat-out .studio-work`)).toContain(
      'right: var(--studio-chat-width-now, 0px)',
    );
    expect(rule(`${GRID} > .studio-bench__chat`)).toContain('right: 0');
  });
});
