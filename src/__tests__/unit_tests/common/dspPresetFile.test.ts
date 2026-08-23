/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import { fromPresetFile, toPresetFile } from '../../../common/dsp/presetFile';

/** A rack using the settings APO text has no way to describe. */
const richRack = (): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  engine: 'parallel',
  phase: 'linear',
  model: 'wide',
  fuzzAmount: 0.3,
  subsonicHz: 25,
  monoBelowHz: 80,
  bands: DSP_DEFAULTS.eq.bands.map((band, index) =>
    index === 12
      ? { ...band, gainDb: -6, dynamic: true, thresholdDb: -26 }
      : { ...band, gainDb: index === 2 ? 4 : 0 },
  ),
});

describe('the shareable preset file', () => {
  /**
   * The reason this format exists rather than exporting APO text: APO can say a
   * filter is at 3 kHz with a Q of 2.4, and has no way to say the band only
   * acts above -26 dBFS, that the rack runs in parallel, or that the phase is
   * linear. A round trip has to bring all of it back or the format is a
   * prettier way of losing settings.
   */
  it('carries everything APO text cannot', () => {
    const rack = richRack();
    const read = fromPresetFile(toPresetFile('Night', rack));
    if (!read) {
      throw new Error('a file this module wrote was not readable');
    }
    expect(read.name).toBe('Night');
    expect(read.eq.engine).toBe('parallel');
    expect(read.eq.phase).toBe('linear');
    expect(read.eq.model).toBe('wide');
    expect(read.eq.fuzzAmount).toBeCloseTo(0.3, 6);
    expect(read.eq.subsonicHz).toBe(25);
    expect(read.eq.monoBelowHz).toBe(80);
    expect(read.eq.bands[12].dynamic).toBe(true);
    expect(read.eq.bands[12].thresholdDb).toBe(-26);
    expect(read.eq.bands[12].gainDb).toBe(-6);
    expect(read.eq.bands[2].gainDb).toBe(4);
  });

  /**
   * Undefined rather than a throw, because the caller's other option is APO
   * text: this runs first on every import and "not a preset file" is the
   * ordinary answer rather than a fault.
   */
  it('declines anything that is not one, quietly', () => {
    expect(fromPresetFile('Preamp: -5.6 dB\nFilter 1: ON PK Fc 29 Hz')).toBe(
      undefined,
    );
    expect(fromPresetFile('')).toBe(undefined);
    expect(fromPresetFile('{ not json')).toBe(undefined);
    // Valid JSON, wrong thing entirely.
    expect(fromPresetFile('{"hello":"world"}')).toBe(undefined);
    // Ours in shape but missing the marker that makes it ours.
    expect(fromPresetFile('{"name":"x","eq":{}}')).toBe(undefined);
  });

  /**
   * A file is something a person can edit, so it is something a person can get
   * wrong. Everything inside goes through the same clamp a stored setting does,
   * or a hand-typed Q of 900 reaches the coefficient maths.
   */
  it('clamps what a hand-edited file might contain', () => {
    const read = fromPresetFile(
      JSON.stringify({
        format: 'fluideq-preset',
        version: 1,
        name: 'Wild',
        eq: {
          ...DSP_DEFAULTS.eq,
          fuzzAmount: 40,
          subsonicHz: 9_000,
          bands: [
            {
              enabled: true,
              type: 'PK',
              frequency: 1e9,
              gainDb: 400,
              quality: 900,
            },
          ],
        },
      }),
    );
    if (!read) {
      throw new Error('a well-formed file was rejected');
    }
    expect(read.eq.fuzzAmount).toBeLessThanOrEqual(1);
    expect(read.eq.subsonicHz).toBeLessThanOrEqual(40);
    expect(read.eq.bands[0].quality).toBeLessThan(900);
    expect(Math.abs(read.eq.bands[0].gainDb)).toBeLessThan(400);
  });

  /** The bypass switch and which preset was showing are not part of a curve,
   * and shipping them would turn somebody else's rack off on import. */
  it('does not carry the bypass or the selection', () => {
    const file = toPresetFile('Anything', {
      ...richRack(),
      enabled: true,
      presetId: 'rock',
    });
    const read = fromPresetFile(file);
    expect(read?.eq.enabled).toBe(DSP_DEFAULTS.eq.enabled);
    expect(read?.eq.presetId).toBe('');
  });
});
