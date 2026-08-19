/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The all-pass, which is the one band whose correctness the graph cannot show.
 *
 * Every other type is checked by looking at its curve. This one is defined by
 * having no curve — unity magnitude at every frequency — so "it draws a flat
 * line" is exactly as true of a working all-pass as of one whose coefficients
 * are nonsense, or of a type the biquad forgot and left at zero. The only way
 * to tell those apart is to assert the flatness across the spectrum *and* to
 * prove the same code produces a shape for something else, which is what the
 * peak below is doing here.
 */

import {
  SAMPLE_FREQUENCIES,
  gainAtFrequency,
  getTFCoefficients,
} from '../../../common/response';
import { parseEqText } from '../../../common/apoText';
import { stateToString } from '../../../main/apoRender';
import {
  FilterTypeEnum,
  IFilter,
  NO_GAIN_FILTER_TYPES,
  getDefaultState,
} from '../../../common/constants';

const bandOf = (type: FilterTypeEnum, gain = 0): IFilter => ({
  id: 'a',
  frequency: 500,
  gain,
  quality: 1,
  type,
});

const responseOf = (filter: IFilter) => {
  const coefficients = getTFCoefficients(filter);
  return SAMPLE_FREQUENCIES.map((frequency) =>
    gainAtFrequency(frequency, coefficients),
  );
};

describe('the all-pass band', () => {
  it('leaves the magnitude alone at every frequency', () => {
    responseOf(bandOf(FilterTypeEnum.AP)).forEach((dB) => {
      // Not "close to flat": an all-pass is unity by construction, so anything
      // beyond floating-point noise means the coefficients are wrong.
      expect(dB).toBeCloseTo(0, 6);
    });
  });

  it('stays flat wherever it is placed and however narrow it is', () => {
    [
      { ...bandOf(FilterTypeEnum.AP), frequency: 30, quality: 0.1 },
      { ...bandOf(FilterTypeEnum.AP), frequency: 12000, quality: 10 },
    ].forEach((filter) => {
      responseOf(filter).forEach((dB) => expect(dB).toBeCloseTo(0, 6));
    });
  });

  it('is flat because it is an all-pass, not because the maths returned zero', () => {
    // The positive control the flatness assertions need. Same coefficients,
    // same sampling, same helper — a peak has to come out shaped, or "flat"
    // above means nothing more than "unimplemented".
    const peak = responseOf({ ...bandOf(FilterTypeEnum.PK, 6) });
    expect(Math.max(...peak)).toBeGreaterThan(5);
  });

  it('is written without a Gain token, which APO has no room for', () => {
    // Emitting one makes Equalizer APO reject the whole line, so the band
    // would sit in the config doing nothing at all.
    expect(NO_GAIN_FILTER_TYPES).toContain(FilterTypeEnum.AP);

    const state = getDefaultState();
    state.isFlat = false;
    state.filters = { a: bandOf(FilterTypeEnum.AP) };

    const line = stateToString(state)
      // Joined with '\n\r' rather than '\r\n', so a plain newline split leaves
      // the carriage return glued to the front of the next line.
      .split(/\r?\n\r?/)
      .find((entry) => entry.includes(' AP '));

    expect(line).toBe('Filter 1: ON AP Fc 500 Hz Q 1');
  });

  it('is read back from a config that carries one', () => {
    // Before this it counted as unsupported, and one unsupported band makes
    // the whole file refuse to be adopted.
    const parsed = parseEqText('Filter: ON AP Fc 500 Hz Q 0.70');

    expect(parsed.unsupported).toBe(0);
    const [filter] = Object.values(parsed.filters);
    expect(filter.type).toBe(FilterTypeEnum.AP);
    expect(filter.frequency).toBe(500);
    expect(filter.quality).toBeCloseTo(0.7, 6);
  });
});
