/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A band's id is a map key, and JavaScript lists integer-like keys first,
 * whatever order they were added in. Band ids were eight random hex
 * characters, all digits about one time in forty, so a curve file read back
 * now and then came out with a band jumped to the front (a CI failure in
 * myCurvesFile on 2026-10-21). Here the random part is forced to digits, the
 * case that broke, every time.
 */

const mockIds = ['20000000', '10000000', '30000000'];
jest.mock('uid', () => ({ uid: () => mockIds.shift() ?? 'ffffffff' }));

/* eslint-disable import/first -- the uid mock must be installed first */
import { parseEqText } from '../../../common/apoText';
import { getDefaultFilterWithId } from '../../../common/constants';
/* eslint-enable import/first */

it('never makes a band id that looks like a number', () => {
  mockIds.splice(0, mockIds.length, '12345678');
  expect(getDefaultFilterWithId().id).not.toMatch(/^\d+$/);
});

it('reads a curve back in the order it was written, even when the ids are digits', () => {
  mockIds.splice(0, mockIds.length, '20000000', '10000000', '30000000');
  const read = parseEqText(
    [
      'Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1',
      'Filter 2: ON PK Fc 1000 Hz Gain 2 dB Q 1',
      'Filter 3: ON PK Fc 10000 Hz Gain 3 dB Q 1',
    ].join('\n'),
  );
  expect(Object.values(read.filters).map((band) => band.frequency)).toEqual([
    100, 1000, 10000,
  ]);
});
