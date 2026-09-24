/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The word each layer's file is named by — `fluideq-<slug>-<word>.txt` —
 * which is also what the Config page calls the layer. The voicing's is
 * `preset`; it was `voicing` until 2026-09-21, and that name must go on
 * reading as the voicing's, or a config written before would lose it.
 */
import {
  APO_FEATURES,
  APO_FEATURE_FILE_WORD_PATTERN,
  apoFeatureFileWord,
  apoFeatureOfFileWord,
} from 'common/constants';

it('names the voicing’s file preset and every other feature’s by itself', () => {
  expect(APO_FEATURES.map((feature) => apoFeatureFileWord(feature))).toEqual([
    'driver',
    'headphone',
    'eq',
    'tone',
    'preset',
    'smart',
  ]);
});

it('reads every word back to its feature, the old voicing word included', () => {
  APO_FEATURES.forEach((feature) => {
    expect(apoFeatureOfFileWord(apoFeatureFileWord(feature))).toBe(feature);
  });
  expect(apoFeatureOfFileWord('voicing')).toBe('voicing');
  expect(apoFeatureOfFileWord('PRESET')).toBe('voicing');
  expect(apoFeatureOfFileWord('loudness')).toBeUndefined();
  expect(apoFeatureOfFileWord('custom')).toBeUndefined();
});

it('matches every word a feature file is or was named by, and no other', () => {
  const file = new RegExp(
    `^fluideq-[0-9a-f]{12}-(${APO_FEATURE_FILE_WORD_PATTERN})\\.txt$`,
  );
  expect(file.test('fluideq-0123456789ab-preset.txt')).toBe(true);
  expect(file.test('fluideq-0123456789ab-voicing.txt')).toBe(true);
  expect(file.test('fluideq-0123456789ab-eq.txt')).toBe(true);
  expect(file.test('fluideq-0123456789ab-custom.txt')).toBe(false);
  expect(file.test('fluideq-0123456789ab-presets.txt')).toBe(false);
});
