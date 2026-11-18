/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The correction panel's Applied button reached by the keyboard shows the
 * focus ring. It used to wear a flat face of its own, `box-shadow: none`,
 * and the focus ring is a shadow too: the face outranked it, so the button
 * reached by Tab showed nothing. Since the one control theme (2026-11-17) it
 * is the line tier (`button subtle`, set by the picker) with no face of its
 * own, and the line tier draws the ring. Read from the compiled stylesheets,
 * since jsdom applies none.
 */
import { compileStylesheet, styleRules } from '__tests__/utils/stylesheetRules';

const declarationsFor = (sheet: string, selector: string) =>
  styleRules(compileStylesheet(sheet))
    .filter(({ selectors }) => selectors.includes(selector))
    .map(({ declarations }) => declarations);

it('gives the Applied button nothing of its own that could hide the focus ring', () => {
  const applied = declarationsFor('AutoEQ.scss', '.auto-eq .button.is-applied');
  // The control: the rule read is the Applied one, which says it is done.
  expect(applied.map((rule) => rule.get('cursor'))).toContain('default');
  applied.forEach((rule) => {
    expect(rule.has('box-shadow')).toBe(false);
    expect(rule.has('outline')).toBe(false);
  });
  expect(
    declarationsFor('AutoEQ.scss', '.auto-eq .button.is-applied:focus-visible'),
  ).toEqual([]);
});

it('draws the ring with the line tier it wears', () => {
  const ring = declarationsFor('Button.scss', '.button.subtle:focus-visible');
  expect(ring).toHaveLength(1);
  expect(ring[0].get('box-shadow')).toMatch(/inset 0 0 0 1px/);
});
