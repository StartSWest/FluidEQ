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
 * The two answers have to agree with what plays: a layer drawn by another
 * group's choice would show one shape while the other plays, and a graph
 * drawing matched ahead of an engine that still plays the cookbook would show
 * treble bands up to 3 dB fuller than they are heard.
 */

import { APO_FEATURES } from '../../../common/constants';
import {
  ENGINE_MATCHED_DESIGN_SINCE,
  enginePlaysMatched,
  layerGroupOf,
  MATCHED_DESIGN_DIRECTIVE,
} from '../../../common/filterDesign';

describe('layerGroupOf', () => {
  it('puts the headphone correction alone under the Corrections row', () => {
    expect(layerGroupOf('headphone')).toBe('curves');
  });

  it("puts everything that shapes the sound to taste under Your EQ's row", () => {
    const taste = APO_FEATURES.filter((feature) => feature !== 'headphone');
    // POSITIVE CONTROL: the list is every other layer by name, so `every`
    // below proves something about each of them rather than about none, and
    // a layer added later has to be placed here on purpose.
    expect(taste).toEqual(['driver', 'eq', 'tone', 'voicing', 'smart']);
    expect(taste.every((feature) => layerGroupOf(feature) === 'eq')).toBe(true);
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
