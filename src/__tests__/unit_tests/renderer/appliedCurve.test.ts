/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * One curve, one "applied", whichever tab applied it (Ivan, 2026-10-25: My
 * curves offered Apply again for the curve OPRA had just applied), and the
 * name the main EQ gives it, renamed with the list.
 */
import {
  AutoEqFormat,
  FilterTypeEnum,
  type IFiltersMap,
  type IHeadphoneSettings,
} from 'common/constants';
import { curveTextOf } from 'common/curveText';
import type { IMyCurve } from 'common/myCurves';
import { isCurveApplied, keptCurveName } from 'renderer/eq/appliedCurve';

const filters: IFiltersMap = {
  shelf: {
    id: 'shelf',
    type: FilterTypeEnum.LSC,
    frequency: 105,
    gain: 1.8,
    quality: 0.7,
  },
  bell: {
    id: 'bell',
    type: FilterTypeEnum.PK,
    frequency: 332,
    gain: 5.5,
    quality: 1.25,
  },
};
/** The text an OPRA pick's bands write, as Save and GET_OPRA_CURVES keep it. */
const opraText = curveTextOf({ preAmp: 0, filters });
const otherText = curveTextOf({
  preAmp: 0,
  filters: { bell: { ...filters.bell, gain: -3 } },
});
/** A Squiglink paste, preamp and all, as it was imported. */
const pasted = 'Preamp: -6.2 dB\nFilter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1';

const fromOpra: IHeadphoneSettings = { filters, intensity: 1 };
const fromImport: IHeadphoneSettings = {
  filters,
  intensity: 1,
  eqImport: {
    source: 'squiglink',
    sourceUrl: 'https://squig.link/',
    label: 'anything',
    eqFormat: AutoEqFormat.PARAMETRIC,
    filterCount: 1,
    text: pasted,
  },
};

const curve = (name: string, text: string): IMyCurve => ({
  id: name,
  name,
  text,
  source: 'opra',
  ears: 'both',
  addedAt: 0,
});

describe('whether a curve is the correction playing', () => {
  it('knows an OPRA pick by the text its bands write, with no import behind it', () => {
    expect(isCurveApplied(opraText, fromOpra)).toBe(true);
    // Spaces around it do not make it another curve.
    expect(isCurveApplied(`  ${opraText}\n`, fromOpra)).toBe(true);
    // The control: another curve is not playing.
    expect(isCurveApplied(otherText, fromOpra)).toBe(false);
  });

  it('knows a curve applied from My curves or Squiglink by the text it came from', () => {
    expect(isCurveApplied(pasted, fromImport)).toBe(true);
    expect(isCurveApplied(otherText, fromImport)).toBe(false);
  });

  it('says no with nothing playing or nothing to compare', () => {
    expect(isCurveApplied(opraText, undefined)).toBe(false);
    expect(isCurveApplied('', fromOpra)).toBe(false);
    expect(isCurveApplied(undefined, fromOpra)).toBe(false);
  });
});

describe('the name the main EQ gives the correction', () => {
  it('is the My curves name of the curve playing, and follows a rename', () => {
    const list = [curve('Bright', otherText), curve('My Kraken', pasted)];
    expect(keptCurveName(list, fromImport)).toBe('My Kraken');
    const renamed = [curve('Bright', otherText), curve('Desk cans', pasted)];
    expect(keptCurveName(renamed, fromImport)).toBe('Desk cans');
  });

  it('is nothing for a correction the list does not keep', () => {
    expect(keptCurveName([curve('Bright', otherText)], fromImport)).toBe(
      undefined,
    );
    expect(keptCurveName([], fromOpra)).toBe(undefined);
  });
});
