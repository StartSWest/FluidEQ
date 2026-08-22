/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  fromApoText,
  preampFor,
  toApoText,
} from '../../../common/dsp/apoEqFormat';
import {
  DSP_DEFAULTS,
  EQ_MAX_BAND_COUNT,
  IEqSettings,
} from '../../../common/dsp/chain';

const withBands = (
  bands: Partial<IEqSettings['bands'][number]>[],
): IEqSettings => ({
  enabled: true,
  model: 'clean',
  modelAmount: 1,
  engine: 'serial',
  phase: 'minimum',
  stereo: 'stereo',
  monoBelowHz: 0,
  oversample: 1,
  subsonicHz: 0,
  fuzzAmount: 0,
  presetId: '',
  preampDb: 0,
  trimDb: 0,
  sourceBands: [],
  bands: DSP_DEFAULTS.eq.bands.map((band, index) => ({
    ...band,
    ...(bands[index] ?? {}),
    enabled: bands[index] ? (bands[index].enabled ?? true) : false,
  })),
});

describe('APO ParametricEQ export', () => {
  it('writes the line shape every correction database publishes', () => {
    const text = toApoText(
      withBands([
        { type: 'PK', frequency: 1_200, gainDb: -2.1, quality: 1.41 },
      ]),
    );
    expect(text).toContain('Filter 1: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41');
  });

  /**
   * The rule `apoRender.ts` learned the hard way.
   *
   * APO's grammar has no Gain for a notch or a pass, and a line carrying one
   * is rejected outright — the band then silently does nothing.
   */
  it('omits Gain for the forms APO has no gain for', () => {
    ['NO', 'LPQ', 'HPQ', 'BP'].forEach((type) => {
      const text = toApoText(
        withBands([{ type, frequency: 100, gainDb: 6, quality: 0.7 }]),
      );
      expect(text).not.toContain('Gain');
    });
  });

  it('POSITIVE CONTROL: a peaking band does carry Gain', () => {
    const text = toApoText(
      withBands([{ type: 'PK', frequency: 100, gainDb: 6, quality: 0.7 }]),
    );
    expect(text).toContain('Gain 6 dB');
  });

  it('leads with a preamp line even when it is zero', () => {
    expect(toApoText(DSP_DEFAULTS.eq).split('\n')[0]).toBe('Preamp: 0 dB');
  });

  it('sets the preamp against the largest boost', () => {
    expect(
      preampFor(withBands([{ gainDb: 6 }, { gainDb: 3 }, { gainDb: -9 }])),
    ).toBe(-6);
  });

  /**
   * A curve that only cuts needs no headroom.
   *
   * Attenuating it anyway would make every preset quieter than the source for
   * no reason, which reads as the EQ being broken.
   */
  it('leaves a cut-only curve at unity', () => {
    expect(preampFor(withBands([{ gainDb: -6 }, { gainDb: -3 }]))).toBe(0);
  });

  it('writes only the bands that are switched on', () => {
    const text = toApoText(
      withBands([{ gainDb: 3 }, { gainDb: 2, enabled: false }]),
    );
    expect(text).toContain('Filter 1:');
    expect(text).not.toContain('Filter 2:');
  });
});

describe('APO ParametricEQ import', () => {
  it('reads a file AutoEq would produce', () => {
    const { bands, preampDb, skipped } = fromApoText(
      [
        'Preamp: -6.3 dB',
        'Filter 1: ON LSC Fc 105 Hz Gain 5.5 dB Q 0.70',
        'Filter 2: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
      ].join('\n'),
    );
    expect(preampDb).toBeCloseTo(-6.3, 5);
    expect(skipped).toBe(0);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toEqual({
      enabled: true,
      // A published file describes a static curve; the format cannot say
      // otherwise.
      dynamic: false,
      thresholdDb: -24,
      type: 'LSC',
      frequency: 105,
      gainDb: 5.5,
      quality: 0.7,
    });
  });

  it('round-trips its own output', () => {
    const original = withBands([
      { type: 'PK', frequency: 1_000, gainDb: 4.5, quality: 2 },
      { type: 'HSC', frequency: 8_000, gainDb: -3, quality: 0.7 },
    ]);
    const { bands } = fromApoText(toApoText(original));
    expect(bands[0].frequency).toBe(1_000);
    expect(bands[0].gainDb).toBe(4.5);
    expect(bands[1].type).toBe('HSC');
    expect(bands[1].gainDb).toBe(-3);
  });

  it('reads a filter with no Q as Butterworth', () => {
    const { bands } = fromApoText('Filter 1: ON PK Fc 500 Hz Gain 3 dB');
    expect(bands[0].quality).toBeCloseTo(0.707, 3);
  });

  it('reads a pass filter with no Gain as flat', () => {
    const { bands } = fromApoText('Filter 1: ON HPQ Fc 30 Hz Q 0.71');
    expect(bands[0].gainDb).toBe(0);
    expect(bands[0].type).toBe('HPQ');
  });

  it('keeps an OFF filter but marks it off', () => {
    const { bands } = fromApoText('Filter 1: OFF PK Fc 500 Hz Gain 3 dB Q 1');
    expect(bands[0].enabled).toBe(false);
  });

  /**
   * One odd line must not cost the other thirty-nine.
   *
   * These files are pasted, hand-edited and produced by a dozen tools. An
   * import that refused the whole file over a stray line would be useless on
   * exactly the files people actually have.
   */
  it('skips what it cannot read and imports the rest', () => {
    const { bands, skipped } = fromApoText(
      [
        '# headphone: something',
        'Filter 1: ON PK Fc 500 Hz Gain 3 dB Q 1',
        'GraphicEQ: 20 -3; 25 -3',
        'Filter 2: ON PK Fc 900 Hz Gain 1 dB Q 1',
      ].join('\n'),
    );
    expect(bands).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it('NULL TEST: an empty file imports nothing and reports nothing skipped', () => {
    expect(fromApoText('')).toEqual({ bands: [], preampDb: 0, skipped: 0 });
  });

  /**
   * The rack takes the file's count, not the other way round.
   *
   * Cutting a twenty-filter curve to fifteen threw away the filters its author
   * put at the top and produced a curve that was not the published one.
   */
  it('keeps every filter past the default rack size', () => {
    const lines: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      lines.push(
        `Filter ${index + 1}: ON PK Fc ${100 + index} Hz Gain 1 dB Q 1`,
      );
    }
    const { bands, skipped } = fromApoText(lines.join('\n'));
    expect(bands).toHaveLength(20);
    expect(skipped).toBe(0);
  });

  it('POSITIVE CONTROL: still stops at the CPU ceiling', () => {
    const lines: string[] = [];
    for (let index = 0; index < EQ_MAX_BAND_COUNT + 5; index += 1) {
      lines.push(`Filter: ON PK Fc 1000 Hz Gain 1 dB Q 1`);
    }
    const { bands, skipped } = fromApoText(lines.join('\n'));
    expect(bands).toHaveLength(EQ_MAX_BAND_COUNT);
    expect(skipped).toBe(5);
  });
});

/**
 * The exact file the user pasted, which imported NOTHING before this.
 *
 * Two independent reasons, both silent: the lines carry no filter index, and
 * the shelves are spelled `LS`/`HS` rather than APO's own `LSC`/`HSC`. The
 * first dropped all ten lines at the regex; the second would have dropped the
 * two shelves at `clampEqBand`, which is how a curve loses the bands that
 * shape its ends and still looks like it worked.
 */
describe('Squiglink exports', () => {
  const SQUIGLINK = [
    'Preamp: -5.4 dB',
    'Filter: ON LS Fc 105.0 Hz Gain -2.8 dB Q 0.70',
    'Filter: ON PK Fc 7164 Hz Gain 4.7 dB Q 1.27',
    'Filter: ON PK Fc 1555 Hz Gain -2.9 dB Q 1.63',
    'Filter: ON PK Fc 155.0 Hz Gain -1.5 dB Q 1.49',
    'Filter: ON PK Fc 3115 Hz Gain 2.3 dB Q 2.70',
    'Filter: ON HS Fc 10000 Hz Gain -5.3 dB Q 0.70',
    'Filter: ON PK Fc 63.00 Hz Gain 0.4 dB Q 1.75',
    'Filter: ON PK Fc 722.0 Hz Gain 0.4 dB Q 2.07',
    'Filter: ON PK Fc 6471 Hz Gain 1.7 dB Q 5.99',
    'Filter: ON PK Fc 4424 Hz Gain -1.0 dB Q 6.00',
  ].join('\n');

  it('reads every filter from an unnumbered file', () => {
    const { bands, skipped } = fromApoText(SQUIGLINK);
    expect(bands).toHaveLength(10);
    expect(skipped).toBe(0);
  });

  it('translates the short shelf spellings this app does not use', () => {
    const { bands } = fromApoText(SQUIGLINK);
    expect(bands[0].type).toBe('LSC');
    expect(bands[5].type).toBe('HSC');
    // Every type has to be one `clampEqBand` will keep, or the band is dropped
    // after a clean-looking import.
    bands.forEach((band) => {
      expect(['PK', 'NO', 'LSC', 'HSC', 'LPQ', 'HPQ', 'BP']).toContain(
        band.type,
      );
    });
  });

  it('carries the preamp out, since the curve clips without it', () => {
    expect(fromApoText(SQUIGLINK).preampDb).toBeCloseTo(-5.4, 5);
  });

  it('reads the values off the line it was given', () => {
    const { bands } = fromApoText(SQUIGLINK);
    expect(bands[0]).toEqual({
      enabled: true,
      // A published file describes a static curve; the format cannot say
      // otherwise.
      dynamic: false,
      thresholdDb: -24,
      type: 'LSC',
      frequency: 105,
      gainDb: -2.8,
      quality: 0.7,
    });
    expect(bands[9].frequency).toBe(4424);
    expect(bands[9].gainDb).toBe(-1);
  });

  /**
   * A shape with no coefficients here must not become a bell.
   *
   * Coercing it would invent a filter the file never described, which is worse
   * than saying one line could not be used.
   */
  it('counts a shape it cannot build rather than guessing at one', () => {
    const { bands, skipped } = fromApoText(
      'Filter: ON AP Fc 500 Hz Gain 0 dB Q 1\nFilter: ON PK Fc 900 Hz Gain 1 dB Q 1',
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].frequency).toBe(900);
    expect(skipped).toBe(1);
  });
});
