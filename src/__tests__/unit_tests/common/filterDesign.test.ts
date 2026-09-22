/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which layers the FluidEQ Engine builds analog-matched, and from which
 * engine on the graph may draw them that way.
 *
 * The two answers have to agree with what plays: a headphone correction
 * drawn matched would show a curve AutoEQ never fitted, and a graph drawing
 * matched ahead of an engine that still plays the cookbook would show treble
 * bands up to 3 dB fuller than they are heard.
 */

import { APO_FEATURES } from '../../../common/constants';
import {
  ENGINE_MATCHED_DESIGN_SINCE,
  enginePlaysMatched,
  MATCHED_DESIGN_DIRECTIVE,
  usesMatchedDesign,
} from '../../../common/filterDesign';

describe('usesMatchedDesign', () => {
  it('keeps a headphone correction on the cookbook it was fitted with', () => {
    expect(usesMatchedDesign('headphone')).toBe(false);
  });

  it('builds every layer FluidEQ shapes itself analog-matched', () => {
    const own = APO_FEATURES.filter((feature) => feature !== 'headphone');
    // POSITIVE CONTROL: the list is not empty, so `every` below proves
    // something about each layer rather than about none.
    expect(own).toEqual(['driver', 'eq', 'voicing', 'smart']);
    expect(own.every(usesMatchedDesign)).toBe(true);
  });
});

describe('MATCHED_DESIGN_DIRECTIVE', () => {
  it('is a comment line, so Equalizer APO and older engines read past it', () => {
    expect(MATCHED_DESIGN_DIRECTIVE.startsWith('#')).toBe(true);
    expect(MATCHED_DESIGN_DIRECTIVE).not.toMatch(/[\r\n]/);
  });
});

describe('enginePlaysMatched', () => {
  it.each([
    ['1.13.0.0', true],
    ['1.13', true],
    ['1.14.0.0', true],
    ['2.0.0.0', true],
    ['1.12.0.0', false],
    ['1.9.0.0', false],
    ['', false],
    [undefined, false],
    ['1.13-beta', false],
  ])('%s → %s', (version, expected) => {
    expect(enginePlaysMatched(version)).toBe(expected);
  });

  it('draws matched from exactly the first engine that plays it', () => {
    const [major, minor] = ENGINE_MATCHED_DESIGN_SINCE;
    expect(enginePlaysMatched(`${major}.${minor}.0.0`)).toBe(true);
    expect(enginePlaysMatched(`${major}.${minor - 1}.0.0`)).toBe(false);
  });
});
