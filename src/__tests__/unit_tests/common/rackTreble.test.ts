/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the rack EQ's Treble choice is heard (`rackTreble.ts`).
 *
 * The choice rides a wire slot every engine decodes and none before 1.16
 * reads, so an older FluidEQ Engine plays the cookbook whatever the page
 * says. The page draws Precise only where it is heard, and offers the choice
 * only where the engine running the rack can play it; the Library player's
 * host is built with the app and always can.
 */
import {
  IRackTrebleContext,
  rackPlaysMatched,
  rackTrebleNeedsEngineUpdate,
} from 'common/dsp/rackTreble';

const context = (patch: Partial<IRackTrebleContext>): IRackTrebleContext => ({
  engine: 'fluid',
  libraryAudible: false,
  dllVersion: '1.16.0.0',
  ...patch,
});

describe('the rack EQ’s Treble choice', () => {
  it('is heard on an engine that reads it', () => {
    expect(rackPlaysMatched('precise', context({}))).toBe(true);
    expect(rackTrebleNeedsEngineUpdate(context({}))).toBe(false);
  });

  it('is not heard on an older FluidEQ Engine, which plays the cookbook', () => {
    const old = context({ dllVersion: '1.15.0.0' });
    expect(rackTrebleNeedsEngineUpdate(old)).toBe(true);
    expect(rackPlaysMatched('precise', old)).toBe(false);
  });

  it('is heard while the Library plays, whatever the engine', () => {
    // The Library player's host runs the rack then, and it reads the choice.
    const old = context({ dllVersion: '1.15.0.0', libraryAudible: true });
    expect(rackPlaysMatched('precise', old)).toBe(true);
  });

  it('is heard under Equalizer APO and before an engine is known', () => {
    // Under APO the rack runs in the Library player alone; with nothing
    // known there is nothing to say it cannot.
    expect(
      rackPlaysMatched(
        'precise',
        context({ engine: 'apo', dllVersion: undefined }),
      ),
    ).toBe(true);
    expect(
      rackTrebleNeedsEngineUpdate(
        context({ engine: null, dllVersion: undefined }),
      ),
    ).toBe(false);
    expect(
      rackTrebleNeedsEngineUpdate(context({ dllVersion: undefined })),
    ).toBe(false);
  });

  it('draws Classic as the cookbook everywhere', () => {
    // POSITIVE CONTROL for the cases above: the same contexts that play
    // Precise play Classic as Classic.
    [
      context({}),
      context({ libraryAudible: true }),
      context({ engine: 'apo' }),
    ].forEach((one) => {
      expect(rackPlaysMatched('classic', one)).toBe(false);
    });
  });
});
