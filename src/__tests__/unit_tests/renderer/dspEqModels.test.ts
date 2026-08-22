/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../../common/constants';
import { TEqModel } from '../../../common/dsp/chain';
import {
  IBandSpec,
  biquadCoefficients,
  biquadMagnitudeDb,
} from '../../../renderer/dsp/biquad';

/** The rate the cramping was measured at, and the one it is worst on. */
const RATE = 44_100;

const responseAt = (spec: IBandSpec, hz: number, model: TEqModel): number =>
  biquadMagnitudeDb(biquadCoefficients(spec, RATE, model), hz, RATE);

const highShelf: IBandSpec = {
  type: FilterTypeEnum.HSC,
  frequency: 16_000,
  gainDb: 6,
  quality: 0.7,
};

const bell = (gainDb: number): IBandSpec => ({
  type: FilterTypeEnum.PK,
  frequency: 1_000,
  gainDb,
  quality: 1,
});

describe('the clean model', () => {
  /**
   * Unchanged, and that is a requirement rather than an accident.
   *
   * A curve exported to an Equalizer APO config has to behave the same on both
   * paths. The other models are offered BESIDE the cookbook, never instead of
   * it, so the default cannot drift.
   */
  it('is the cookbook, so an exported curve still matches APO', () => {
    // Asserted by the cookbook's own definitions rather than by a copied
    // coefficient: a bell reaches its full gain at centre, and a shelf reaches
    // exactly half of it at the corner frequency. A magic constant here would
    // only prove that whatever the file does today is what it did yesterday.
    expect(responseAt(bell(6), 1_000, 'clean')).toBeCloseTo(6, 2);
    expect(responseAt(highShelf, 16_000, 'clean')).toBeCloseTo(3, 1);
    expect(biquadCoefficients(bell(6), RATE, 'clean')).toEqual(
      biquadCoefficients(bell(6), RATE),
    );
  });

  /**
   * The measurement that killed a planned fourth model, kept so nobody plans
   * it again.
   *
   * An "analog matched" design was going to undo the bilinear transform's
   * cramping near Nyquist, on the roadmap's claim that a 16 kHz shelf asked
   * for +6 dB "delivers 3-6 dB". It does not: it delivers 5.92 at 20 kHz and a
   * full 6 at Nyquist. The 3 dB the roadmap saw was the shelf's own corner
   * frequency, which is where a shelf is defined to be half its gain.
   */
  it('reaches the gain a high shelf asks for, cramping notwithstanding', () => {
    expect(responseAt(highShelf, 20_000, 'clean')).toBeGreaterThan(5.5);
  });

  /**
   * Where the cookbook genuinely is squeezed, for whoever picks this up next.
   *
   * A bell near Nyquist loses its upper skirt: at 16 kHz the octave below
   * reads 0.6 dB of the boost and the octave above reads 0.03. That asymmetry
   * is real, it is what "cramping" actually means here, and it is small enough
   * that correcting it is a refinement rather than a character.
   */
  it('squeezes a bell against Nyquist, asymmetrically', () => {
    const high = { ...bell(6), frequency: 16_000 };
    const below = responseAt(high, 8_000, 'clean');
    const above = responseAt(high, 21_609, 'clean');
    expect(below).toBeGreaterThan(above * 4);
  });
});

describe('the wide model', () => {
  it('spreads a band well past where the clean one reaches', () => {
    const octaveUp = responseAt(bell(6), 2_000, 'wide');
    expect(octaveUp).toBeGreaterThan(responseAt(bell(6), 2_000, 'clean') * 1.5);
  });

  it('still hits the gain it was asked for at the centre', () => {
    expect(responseAt(bell(6), 1_000, 'wide')).toBeCloseTo(6, 1);
  });

  it('takes a shelf shallower than a bell, which is its whole character', () => {
    const shelf = {
      type: FilterTypeEnum.HSC,
      frequency: 8_000,
      gainDb: 6,
      quality: 0.7,
    };
    // Two octaves below the corner a shallow shelf has already started to
    // lift, where the standard one has barely begun.
    expect(responseAt(shelf, 2_000, 'wide')).toBeGreaterThan(
      responseAt(shelf, 2_000, 'clean') + 0.5,
    );
  });
});

describe('the proportional model', () => {
  /** Where a bell has fallen to half its boost, as a measure of its width. */
  const widthAt = (gainDb: number, model: TEqModel): number =>
    responseAt(bell(gainDb), 2_000, model) / Math.max(0.001, gainDb);

  it('narrows as the band is driven harder', () => {
    // An octave up from centre, a hard boost has spread proportionally less of
    // itself than a gentle one — which is the whole character of the thing.
    expect(widthAt(12, 'proportional')).toBeLessThan(
      widthAt(2, 'proportional'),
    );
  });

  it('CONTROL: the clean model does not do that', () => {
    // The cookbook's Q is whatever the dial says at any gain, so its relative
    // width barely moves. Without this the test above would pass on any filter.
    const spread = Math.abs(widthAt(12, 'clean') - widthAt(2, 'clean'));
    const proportionalSpread = Math.abs(
      widthAt(12, 'proportional') - widthAt(2, 'proportional'),
    );
    expect(proportionalSpread).toBeGreaterThan(spread * 2);
  });

  it('still hits the gain it was asked for at the centre', () => {
    // Narrowing must not cost the band its actual boost, or the dial lies.
    expect(responseAt(bell(12), 1_000, 'proportional')).toBeCloseTo(12, 1);
  });
});

describe('every model', () => {
  it('agrees exactly where there is no gain to shape', () => {
    const notch: IBandSpec = {
      type: FilterTypeEnum.NO,
      frequency: 1_000,
      gainDb: 6,
      quality: 4,
    };
    const models: TEqModel[] = ['clean', 'proportional', 'wide'];
    const rendered = models.map((model) =>
      biquadCoefficients(notch, RATE, model),
    );
    expect(rendered[1]).toEqual(rendered[0]);
    expect(rendered[2]).toEqual(rendered[0]);
  });

  it('leaves a flat band alone whichever is chosen', () => {
    const flat = bell(0);
    expect(biquadCoefficients(flat, RATE, 'wide')).toEqual(
      biquadCoefficients(flat, RATE, 'clean'),
    );
  });

  /**
   * The point of the feature, as one assertion.
   *
   * Same curve on the dials, three different renderings. If any two of these
   * agreed there would be nothing to choose between them.
   */
  it('POSITIVE CONTROL: sounds different with identical settings', () => {
    // One octave up from a 12 dB bell, the three models are three different
    // amounts of lift. If any pair agreed there would be nothing to choose.
    const clean = responseAt(bell(12), 2_000, 'clean');
    const proportional = responseAt(bell(12), 2_000, 'proportional');
    const wide = responseAt(bell(12), 2_000, 'wide');
    expect(Math.abs(proportional - clean)).toBeGreaterThan(1);
    expect(Math.abs(wide - clean)).toBeGreaterThan(1);
    expect(Math.abs(wide - proportional)).toBeGreaterThan(2);
  });
});
