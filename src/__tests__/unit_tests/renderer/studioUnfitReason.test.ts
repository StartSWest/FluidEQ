/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import unfitReason from '../../../renderer/studio/unfitReason';

/**
 * Why a Studio scene does not play yet, in plain words for the controls that
 * wait on it: the first problem, the stage's own trouble, or nothing while it
 * is only being built.
 */
describe('why a Studio scene does not play yet', () => {
  it('names the problems members meet most in their own words', () => {
    expect(
      unfitReason([{ code: 'no-daylight', file: 'pack.json' }], undefined),
    ).toEqual({ key: 'studio.unfit.noDaylight' });
    expect(
      unfitReason([{ code: 'missing-file', file: 'artwork' }], undefined),
    ).toEqual({ key: 'studio.unfit.missingFile' });
    expect(
      unfitReason([{ code: 'model-too-heavy', file: 'world' }], undefined),
    ).toEqual({ key: 'studio.unfit.world' });
  });

  it('names the file for any other problem, the first speaking for the rest', () => {
    expect(
      unfitReason(
        [
          { code: 'bad-swatch', file: 'pack.json' },
          { code: 'no-daylight', file: 'pack.json' },
        ],
        undefined,
      ),
    ).toEqual({ key: 'studio.unfit.file', file: 'pack.json' });
  });

  it('says what the stage found when the files themselves are fine', () => {
    expect(
      unfitReason(undefined, { kind: 'compile', log: 'ERROR: 0:1' }),
    ).toEqual({ key: 'studio.unfit.compile' });
    expect(unfitReason(undefined, { kind: 'heavy' })).toEqual({
      key: 'studio.unfit.heavy',
    });
    expect(unfitReason(undefined, { kind: 'unavailable' })).toEqual({
      key: 'studio.unfit.unavailable',
    });
  });

  // The controls: a world drawn with parts left out plays, and so does a
  // scene with nothing wrong — neither is a reason to hold anything back.
  it('is nothing for a scene that plays', () => {
    expect(unfitReason(undefined, undefined)).toBeUndefined();
    expect(unfitReason([], undefined)).toBeUndefined();
    expect(
      unfitReason(undefined, {
        kind: 'world',
        report: { drawn: true, notes: [] },
      } as never),
    ).toBeUndefined();
  });
});
