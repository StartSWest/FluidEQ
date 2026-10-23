/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each band's response along the DSP EQ's curve, kept between frames
 * (`dspEqResponses.ts`): it has to be the filter's own response, worked out
 * again whenever anything it depends on changes and never otherwise.
 */
import { FilterTypeEnum } from '../../../common/constants';
import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
} from '../../../renderer/dsp/biquad';
import { createEqResponses } from '../../../renderer/dsp/dspEqResponses';
import { toSpec } from '../../../renderer/dsp/dspEqGraphScale';

const RATE = 48000;
const STEPS = 200;
/** The band given a bell at 16 kHz, where the design rate shows. */
const BELL = 13;

const eqWith = (overrides: Partial<IEqSettings> = {}): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  enabled: true,
  bands: DSP_DEFAULTS.eq.bands.map((band, index) =>
    index === BELL
      ? {
          ...band,
          type: FilterTypeEnum.PK,
          frequency: 16000,
          gainDb: 6,
          quality: 2,
        }
      : band,
  ),
  ...overrides,
});

const worstApart = (a: Float64Array, b: Float64Array) =>
  a.reduce(
    (most, value, index) => Math.max(most, Math.abs(value - b[index])),
    0,
  );

describe("the DSP EQ curve's band responses", () => {
  it("is each band's own filter, point for point", () => {
    const eq = eqWith();
    const responses = createEqResponses()(eq, RATE, false, STEPS);
    expect(responses.hz).toHaveLength(STEPS + 1);
    const band = eq.bands[BELL];
    const coefficients = biquadCoefficients(
      toSpec(band),
      RATE,
      eq.model,
      eq.modelAmount,
      false,
    );
    const expected = responses.hz.map((hz) =>
      biquadMagnitudeDb(coefficients, hz, RATE),
    );
    expect(
      worstApart(responses.bands[BELL] ?? new Float64Array(0), expected),
    ).toBe(0);
  });

  it('is worked out once per edit, and again for anything that changes it', () => {
    const responsesFor = createEqResponses();
    const eq = eqWith();
    const first = responsesFor(eq, RATE, false, STEPS);
    expect(responsesFor(eq, RATE, false, STEPS)).toBe(first);
    expect(responsesFor(eqWith(), RATE, false, STEPS)).not.toBe(first);
    const second = responsesFor(eq, RATE, false, STEPS);
    expect(responsesFor(eq, 96000, false, STEPS)).not.toBe(second);
    const third = responsesFor(eq, RATE, false, STEPS);
    expect(responsesFor(eq, RATE, true, STEPS)).not.toBe(third);
    const fourth = responsesFor(eq, RATE, false, STEPS);
    expect(responsesFor(eq, RATE, false, STEPS + 1)).not.toBe(fourth);
  });

  it('is drawn at the rate the bands are built at', () => {
    const responsesFor = createEqResponses();
    const at = (eq: IEqSettings) =>
      responsesFor(eq, RATE, false, STEPS).bands[BELL] ?? new Float64Array(0);
    const plain = at(eqWith());
    const doubled = at(eqWith({ oversample: 2 }));
    // Near Nyquist a bell designed at twice the rate is a different shape.
    expect(worstApart(plain, doubled)).toBeGreaterThan(0.5);
    const coefficients = biquadCoefficients(
      toSpec(eqWith().bands[BELL]),
      RATE * 2,
    );
    const { hz } = responsesFor(eqWith(), RATE, false, STEPS);
    expect(
      worstApart(
        doubled,
        hz.map((frequency) =>
          biquadMagnitudeDb(coefficients, frequency, RATE * 2),
        ),
      ),
    ).toBeLessThan(1e-9);
    // Linear phase is built at the base rate whatever oversampling says.
    expect(
      worstApart(plain, at(eqWith({ oversample: 2, phase: 'linear' }))),
    ).toBe(0);
  });

  it('leaves a band switched off out, and the subsonic cut at the session rate', () => {
    const responsesFor = createEqResponses();
    const off = eqWith({
      bands: eqWith().bands.map((band, index) =>
        index === BELL ? { ...band, enabled: false } : band,
      ),
    });
    expect(responsesFor(off, RATE, false, STEPS).bands[BELL]).toBeUndefined();
    expect(
      responsesFor(eqWith({ subsonicHz: 0 }), RATE, false, STEPS).subsonic,
    ).toBeUndefined();
    const cut = responsesFor(
      eqWith({ subsonicHz: 30, oversample: 4 }),
      RATE,
      false,
      STEPS,
    );
    const coefficients = biquadCoefficients(
      { type: FilterTypeEnum.HPQ, frequency: 30, gainDb: 0, quality: 0.707 },
      RATE,
    );
    expect(
      worstApart(
        cut.subsonic ?? new Float64Array(0),
        cut.hz.map((hz) => biquadMagnitudeDb(coefficients, hz, RATE)),
      ),
    ).toBeLessThan(1e-9);
  });
});
