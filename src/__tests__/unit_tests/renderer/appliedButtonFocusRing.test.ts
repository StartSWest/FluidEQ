/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The correction panel's Applied button wears a flat face, `box-shadow:
 * none`, and the focus ring is a shadow too: the face outranked it, so the
 * button reached by Tab showed nothing. Read from the compiled stylesheet,
 * since jsdom applies none.
 */
import { compileStylesheet, styleRules } from '__tests__/utils/stylesheetRules';

const RULES = styleRules(compileStylesheet('AutoEQ.scss'));

const shadowsFor = (selector: string) =>
  RULES.filter(({ selectors }) => selectors.includes(selector)).map(
    ({ declarations }) => declarations.get('box-shadow'),
  );

it('draws the focus ring on the Applied button reached by the keyboard', () => {
  const ring = shadowsFor('.auto-eq .button.is-applied:focus-visible');
  expect(ring).toHaveLength(1);
  expect(ring[0]).toMatch(/inset 0 0 0 1px/);
});

it('keeps the Applied face flat otherwise (positive control)', () => {
  expect(shadowsFor('.auto-eq .button.is-applied')).toEqual(['none']);
});
