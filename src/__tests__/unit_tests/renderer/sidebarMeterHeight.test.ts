/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rules that give the level meter its height.
 *
 * The meter is the only thing in the left column that can use the space, so
 * it takes what the others leave and grows into it — more resolution per
 * decibel, and no dead half-column under the switches. The rule has been lost
 * twice: once written so it never applied (a class alone lost to
 * `.side-bar > div { flex: 0 0 auto }`), and once simply deleted, after which
 * the card shrank to its contents and the meter sat at its floor with 564px
 * of empty column under it, measured in the running window.
 *
 * Neither failure is visible to any other test: jsdom lays nothing out, and
 * every query by role passes either way. So the rules are held here, as text.
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

/** The bodies of every rule whose selector contains `selector`. */
const bodiesOf = (selector: string): string[] => {
  const bodies: string[] = [];
  let at = css.indexOf(selector);
  while (at >= 0) {
    const open = css.indexOf('{', at);
    const close = css.indexOf('}', open);
    bodies.push(css.slice(open + 1, close));
    at = css.indexOf(selector, close);
  }
  return bodies;
};

it('gives the meter section the rest of the column', () => {
  const meter = bodyOf('.side-bar__meter {');
  expect(meter).not.toBe('');
  expect(meter).toContain('flex: 1 1 auto');
  // Enough room for its heading, its well and a legible strip: the pane
  // scrolls, and a section allowed to collapse pushed its children up
  // through the rows above before the scrollbar could help.
  expect(meter).toContain('min-height: 220px');
});

it('lets the meter itself grow inside its section', () => {
  // A section that grows around a well that does not leaves the strips at
  // their floor with the gained height empty beneath them.
  const well = bodyOf('.side-bar__well {');
  expect(well).not.toBe('');
  expect(well).toContain('flex: 1 1 auto');
  expect(well).toContain('min-height: 160px');
});

it('stretches the column across, and fixes no child against growing', () => {
  expect(bodyOf('.side-bar {')).toContain('align-items: stretch');
  // The trap that once made the meter's rule do nothing: a rule through the
  // parent that pins every child's flex, and outranks a class on its own.
  // The control: the reader finds every rule of a selector that has several.
  expect(bodiesOf('.side-bar__head').length).toBeGreaterThan(1);
  bodiesOf('.side-bar >').forEach((body) => {
    expect(body).not.toContain('flex:');
  });
});
