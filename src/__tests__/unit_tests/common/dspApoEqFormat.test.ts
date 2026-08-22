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
import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';

const withBands = (
  bands: Partial<IEqSettings['bands'][number]>[],
): IEqSettings => ({
  enabled: true,
  presetId: '',
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
   * The rack is fixed at fifteen, so a longer file has to lose something —
   * and the caller has to be told, or bands vanish silently.
   */
  it('truncates past the band count and counts what it dropped', () => {
    const lines: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      lines.push(
        `Filter ${index + 1}: ON PK Fc ${100 + index} Hz Gain 1 dB Q 1`,
      );
    }
    const { bands, skipped } = fromApoText(lines.join('\n'));
    expect(bands).toHaveLength(15);
    expect(skipped).toBe(5);
  });
});
