/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import {
  EQ_PRESETS,
  eqPresetSetup,
  isCompleteEqPreset,
} from '../../../common/dsp/eqPresets';
import {
  TRIM_MARGIN_DB,
  chainPeakDb,
  eqChainPeakDb,
  withInputTrim,
} from '../../../renderer/dsp/rack';

const RATE = 48_000;

/**
 * What a preset is allowed to sum to before the regulator has to give away
 * more level than the curve is worth. Six, plus the tenth the trim rounds by.
 */
const CEILING_DB = 6.1;

const rackFor = (preset: (typeof EQ_PRESETS)[number]): IEqSettings => {
  const setup = eqPresetSetup(preset);
  return {
    ...DSP_DEFAULTS.eq,
    ...setup,
    bands: DSP_DEFAULTS.eq.bands.map((band, index) => {
      const threshold = preset.dynamic?.[index] ?? null;
      return {
        ...band,
        gainDb: preset.gains[index],
        dynamic: threshold !== null,
        thresholdDb: threshold ?? band.thresholdDb,
      };
    }),
  };
};

describe('the EQ input regulator', () => {
  /**
   * The rule the preset list states, checked against the SUM rather than
   * against the largest band.
   *
   * This is the measurement that was missing when the presets were written:
   * every one of them obeyed "no band above +5 dB" while "Bass boost" summed
   * to +12.15 dB at 69 Hz, because bands a third of an octave apart overlap and
   * their gains add. Reading the gain array cannot see that, and neither could
   * anybody looking at the curve.
   */
  it('keeps every preset’s summed curve under the ceiling', () => {
    EQ_PRESETS.forEach((preset) => {
      const peak = eqChainPeakDb(rackFor(preset), RATE);
      expect(`${preset.id}: ${peak <= CEILING_DB}`).toBe(`${preset.id}: true`);
    });
  });

  /**
   * The invariant the whole feature rests on: after the trim, nothing boosts
   * past unity. If this can fail the graph's headroom mask is warning about a
   * rack that cannot clip, or worse, staying quiet about one that can.
   */
  it('leaves no preset above unity once trimmed', () => {
    EQ_PRESETS.forEach((preset) => {
      const trimmed = withInputTrim(
        { ...DSP_DEFAULTS, eq: rackFor(preset) },
        RATE,
      ).eq;
      const over = eqChainPeakDb(trimmed, RATE) + trimmed.trimDb;
      expect(`${preset.id}: ${over <= 0}`).toBe(`${preset.id}: true`);
    });
  });

  /**
   * The positive control, and it is not decoration.
   *
   * Both tests above pass perfectly for an implementation that reports zero for
   * every input — a null result and a correct one are the same shape. This is a
   * curve that unmistakably boosts, so a regulator that has stopped measuring
   * fails here rather than sailing through looking clean.
   */
  it('actually measures: a curve that boosts gets a negative trim', () => {
    const hot: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      bands: DSP_DEFAULTS.eq.bands.map((band) => ({ ...band, gainDb: 6 })),
    };
    expect(eqChainPeakDb(hot, RATE)).toBeGreaterThan(6);
    expect(
      withInputTrim({ ...DSP_DEFAULTS, eq: hot }, RATE).eq.trimDb,
    ).toBeLessThan(-6);
  });

  /**
   * A rack that only cuts asks for no room in its magnitude response, and
   * must never be trimmed UP — the regulator is protection, not a loudness
   * control. It still carries the margin, because a filter rings whichever
   * direction its gain points and a cut is still a filter.
   */
  it('does not trim a curve that never boosts', () => {
    const cutOnly: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      bands: DSP_DEFAULTS.eq.bands.map((band) => ({ ...band, gainDb: -4 })),
    };
    expect(eqChainPeakDb(cutOnly, RATE)).toBe(0);
    expect(
      withInputTrim({ ...DSP_DEFAULTS, eq: cutOnly }, RATE).eq.trimDb,
    ).toBe(-TRIM_MARGIN_DB);
  });

  /**
   * And a rack shaping nothing at all is left at exactly unity.
   *
   * The margin is for what filtering does to a transient, so a chain with no
   * filtering in it has nothing to reserve against. Without this, switching
   * the whole stage on would be audibly quieter than switching it off, which
   * is the one thing a transparent setting must never be.
   */
  it('leaves a rack that shapes nothing at unity', () => {
    expect(withInputTrim(DSP_DEFAULTS, RATE).eq.trimDb).toBe(0);
  });

  /**
   * Rounded UP, never to the nearest tenth.
   *
   * To nearest left as much as 0.05 dB of the peak uncovered, so the curve
   * finished fractionally past unity and the graph shaded it and printed
   * "0.0 dB over" — a warning that contradicted itself, about nothing.
   */
  it('covers the peak rather than landing near it', () => {
    EQ_PRESETS.forEach((preset) => {
      const rack = rackFor(preset);
      const { trimDb } = withInputTrim({ ...DSP_DEFAULTS, eq: rack }, RATE).eq;
      expect(`${preset.id}: ${-trimDb >= eqChainPeakDb(rack, RATE)}`).toBe(
        `${preset.id}: true`,
      );
    });
  });

  /**
   * The other two stages with gain in them, which the trim ignored at first.
   *
   * The exciter runs before the worklet and arrives at the preamp already
   * boosted; the compressor's makeup runs after the bands, so trimming the
   * input is what buys it room. A regulator watching only the EQ was right
   * until somebody opened another tab.
   */
  it('makes room for the exciter and the compressor makeup', () => {
    const flat = { ...DSP_DEFAULTS, eq: { ...DSP_DEFAULTS.eq } };
    expect(chainPeakDb(flat, RATE)).toBe(0);

    // 1 + mix at full agreement, the shaper spanning exactly ±1 either way.
    const excited = {
      ...flat,
      exciter: { ...flat.exciter, enabled: true, mix: 0.5 },
    };
    expect(chainPeakDb(excited, RATE)).toBeCloseTo(20 * Math.log10(1.5), 6);

    // The crossover means one band is in charge at any frequency, so the
    // largest makeup counts and the three do not add up.
    const compressed = {
      ...flat,
      compressor: {
        ...flat.compressor,
        enabled: true,
        bands: flat.compressor.bands.map((band, index) => ({
          ...band,
          makeupDb: [2, 5, 3][index],
        })),
      },
    };
    expect(chainPeakDb(compressed, RATE)).toBeCloseTo(5, 6);
    // Five of response plus the margin, which is not part of the response.
    expect(withInputTrim(compressed, RATE).eq.trimDb).toBe(
      -(5 + TRIM_MARGIN_DB),
    );
  });

  /** Disabled stages contribute nothing: a trim that made room for a processor
   * that is switched off is level given away for no reason at all. */
  it('ignores stages that are switched off', () => {
    const off = {
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, enabled: false, mix: 1 },
      compressor: {
        ...DSP_DEFAULTS.compressor,
        enabled: false,
        bands: DSP_DEFAULTS.compressor.bands.map((band) => ({
          ...band,
          makeupDb: 9,
        })),
      },
    };
    expect(chainPeakDb(off, RATE)).toBe(0);
  });
});

describe('presets that react', () => {
  /**
   * A thresholds array shorter than the gains it accompanies would leave the
   * last bands static while their gains were applied in full — a de-esser that
   * had quietly become a dull EQ, with nothing to show for it on screen.
   */
  it('gives every band a threshold or none at all', () => {
    EQ_PRESETS.forEach((preset) => {
      expect(`${preset.id}: ${isCompleteEqPreset(preset)}`).toBe(
        `${preset.id}: true`,
      );
    });
  });

  /**
   * The two that earn it, named rather than counted.
   *
   * Pinned because the temptation with a new capability is to sprinkle it: a
   * tone curve is meant to hold still, and a preset that reacts when the user
   * did not ask for reaction is a preset that sounds different every time it is
   * auditioned. If a third one appears, somebody should have to justify it here.
   */
  it('reacts only where the problem is intermittent', () => {
    const reacting = EQ_PRESETS.filter((preset) =>
      preset.dynamic?.some((threshold) => threshold !== null),
    ).map((preset) => preset.id);
    expect(reacting).toEqual([
      'podcast',
      'lateNight',
      'deEss',
      'tameBoom',
      'liveVocal',
    ]);
  });

  /**
   * A dynamic cut must not buy headroom the rack does not have.
   *
   * At rest it is absent, so the regulator measures it as absent. This is the
   * assertion that says so: podcast's -6 dB de-ess bands cannot be counted
   * towards its trim, or the curve clips on every sibilant they were added for.
   */
  it('does not let a dynamic cut reserve headroom it will not hold', () => {
    const podcast = EQ_PRESETS.find((one) => one.id === 'podcast');
    if (!podcast) {
      throw new Error('podcast preset is missing');
    }
    const rack = rackFor(podcast);
    const asStatic = {
      ...rack,
      bands: rack.bands.map((band) => ({ ...band, dynamic: false })),
    };
    // The de-ess bands are cuts, so ignoring them can only raise the peak.
    expect(eqChainPeakDb(rack, RATE)).toBeGreaterThanOrEqual(
      eqChainPeakDb(asStatic, RATE),
    );
  });
});

describe('the regulator can be switched off entirely', () => {
  /**
   * A third position that is not a quieter version of the other two: no
   * reserve, no margin, no give-back. The rack gets the signal at unity and
   * what happens to it is between the curve and the preamp, which is the right
   * answer for anyone driving the level by hand.
   */
  it('leaves the input at unity whatever the curve asks for', () => {
    const hot: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      trimMode: 'off',
      bands: DSP_DEFAULTS.eq.bands.map((band) => ({ ...band, gainDb: 6 })),
    };
    const settings = { ...DSP_DEFAULTS, eq: hot };
    // The curve still wants the room — this is a decision, not a measurement
    // that came out at zero.
    expect(chainPeakDb(settings, RATE)).toBeGreaterThan(6);
    expect(withInputTrim(settings, RATE).eq.trimDb).toBe(0);
  });

  /** And a stored trim from before it was switched off does not linger. */
  it('clears a reserve it inherited', () => {
    const stale: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      trimMode: 'off',
      trimDb: -7.5,
    };
    expect(withInputTrim({ ...DSP_DEFAULTS, eq: stale }, RATE).eq.trimDb).toBe(
      0,
    );
  });
});
