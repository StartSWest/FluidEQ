/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Tone panel's Bass, Mid and Treble as a layer of their own: what the
 * dials may hold, the filters they are written as, and how those play.
 */

import { FilterTypeEnum, getDefaultState, IState } from 'common/constants';
import {
  getToneFilters,
  hasTone,
  isToneValues,
  TONE_MAX_DB,
  TONE_SHAPES,
  toTone,
} from 'common/tone';
import { stateToApoFiles } from 'main/apoRender';
import {
  getDesignedFilterLineData,
  getLineGainAtFrequency,
  playsAnalogMatched,
} from '../../../renderer/graph/utils';

describe('the Tone’s dials', () => {
  it('holds each within its travel, to the tenth it steps by', () => {
    expect(toTone({ bass: 30, mid: -3.14159, treble: -40 })).toEqual({
      bass: TONE_MAX_DB,
      mid: -3.1,
      treble: -TONE_MAX_DB,
    });
  });

  it('is no tone at all when every dial is at zero', () => {
    expect(toTone({ bass: 0, mid: 0, treble: 0 })).toBeUndefined();
    expect(toTone(null)).toBeUndefined();
    expect(hasTone(undefined)).toBe(false);
    expect(hasTone({ bass: 0, mid: 0.1, treble: 0 })).toBe(true);
  });

  it('reads a missing or broken dial as zero when stored', () => {
    expect(toTone({ bass: 'loud', treble: 2 })).toEqual({
      bass: 0,
      mid: 0,
      treble: 2,
    });
  });

  it('refuses a message that is not three finite numbers', () => {
    // Read as flat, a malformed message would clear somebody's tone.
    expect(isToneValues({ bass: 1, mid: 0, treble: 0 })).toBe(true);
    expect(isToneValues({ bass: 1, mid: 0 })).toBe(false);
    expect(isToneValues({ bass: Infinity, mid: 0, treble: 0 })).toBe(false);
    expect(isToneValues({ bass: '1', mid: 0, treble: 0 })).toBe(false);
    expect(isToneValues(null)).toBe(false);
  });
});

describe('the Tone’s filters', () => {
  it('writes one filter for each dial away from zero', () => {
    expect(getToneFilters({ bass: 6, mid: 0, treble: -3 })).toEqual([
      { ...TONE_SHAPES.bass, gain: 6 },
      { ...TONE_SHAPES.treble, gain: -3 },
    ]);
    expect(getToneFilters(undefined)).toEqual([]);
  });

  it('builds all three analog-matched, so Precise and Classic both move them', () => {
    // A shelf is matched only at Butterworth; at 0.5 the shelves stayed on
    // the cookbook whatever the choice.
    Object.values(TONE_SHAPES).forEach((shape) => {
      expect(playsAnalogMatched(shape)).toBe(true);
    });
    expect(TONE_SHAPES.bass.type).toBe(FilterTypeEnum.LSC);
    expect(TONE_SHAPES.treble.type).toBe(FilterTypeEnum.HSC);
  });

  it('works where an amplifier’s tone controls do', () => {
    const at = (knob: 'bass' | 'treble', frequency: number) =>
      getLineGainAtFrequency(
        getDesignedFilterLineData(
          { id: knob, ...TONE_SHAPES[knob], gain: 6 },
          true,
          48000,
        ),
        frequency,
      );
    // Bass is the bass and Treble the top, leaving the middle alone.
    expect(at('bass', 50)).toBeCloseTo(5.6, 0);
    expect(at('bass', 300)).toBeLessThan(0.3);
    expect(at('treble', 10000)).toBeCloseTo(3, 0);
    expect(at('treble', 3000)).toBeLessThan(0.3);
  });
});

describe('the Tone as the engine is told it', () => {
  const stateWith = (overrides: Partial<IState>): IState => ({
    ...getDefaultState(),
    isAutoPreAmpOn: false,
    tone: { bass: 4, mid: 0, treble: 0 },
    ...overrides,
  });
  const toneLines = (state: IState) =>
    stateToApoFiles(state)?.features.find(
      (feature) => feature.feature === 'tone',
    )?.lines ?? [];

  it('is its own file, written even while the bands are flat', () => {
    expect(toneLines(stateWith({ isFlat: true }))).toEqual([
      expect.stringContaining('LSC Fc 100 Hz Gain 4 dB Q 0.71'),
    ]);
  });

  it('follows Your EQ’s strength and not the corrections’', () => {
    expect(toneLines(stateWith({ eqMode: 'studio' }))[0]).toContain(
      'Gain 6 dB',
    );
    // CONTROL: the corrections' Studio leaves it as dialled.
    expect(toneLines(stateWith({ curveEqMode: 'studio' }))[0]).toContain(
      'Gain 4 dB',
    );
  });

  it('is left out while it is switched off', () => {
    expect(toneLines(stateWith({ bypassed: ['tone'] }))).toEqual([]);
  });

  it('keeps the curves stage, and its delay, off on its own', () => {
    const directives = stateToApoFiles(stateWith({}))?.engineDirectives ?? [];
    expect(directives).not.toContain('# FluidEQCurveStage: ON');
    // CONTROL: a correction does switch it on.
    const withCorrection = stateToApoFiles(
      stateWith({
        headphone: {
          intensity: 1,
          filters: {
            dip: {
              id: 'dip',
              frequency: 3000,
              gain: -4,
              quality: 2,
              type: FilterTypeEnum.PK,
            },
          },
        },
      }),
    );
    expect(withCorrection?.engineDirectives).toContain(
      '# FluidEQCurveStage: ON',
    );
  });
});
