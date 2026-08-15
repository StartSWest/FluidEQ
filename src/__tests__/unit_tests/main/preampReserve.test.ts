/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { getResolvedPreAmp, stateToString } from '../../../main/flush';
import { getChainPeakGain } from '../../../common/response';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  getDefaultState,
} from '../../../common/constants';

const withBands = (): IState => {
  const state = getDefaultState();
  state.isFlat = false;
  state.isAutoPreAmpOn = true;
  state.filters = {
    a: {
      id: 'a',
      frequency: 100,
      gain: 6,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  };
  return state;
};

const preampLines = (
  state: IState,
  convolutionFileName = state.convolution?.fileName,
) =>
  stateToString(state, convolutionFileName)
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.startsWith('Preamp:'));

const preampValue = (state: IState, convolutionFileName?: string) =>
  Number(/-?[\d.]+/.exec(preampLines(state, convolutionFileName)[0])?.[0]);

/**
 * Every layer shares one preamp, and its value is derived from what was
 * actually written rather than stored.
 *
 * That is what makes it self-correcting. A stored value goes stale the moment a
 * layer changes somewhere the response graph is not watching, and the output
 * stays attenuated for a boost that is no longer in the chain.
 */
describe('preamp headroom', () => {
  it('writes exactly one preamp however many layers are active', () => {
    const state = withBands();
    state.voicing = { profileId: 'music', intensity: 1 };
    state.driver = { profileId: 'balanced-armature-iem', intensity: 1 };

    expect(preampLines(state)).toHaveLength(1);
  });

  it('reserves more headroom as layers are added', () => {
    const bands = preampValue(withBands());

    const voiced = withBands();
    voiced.voicing = { profileId: 'music', intensity: 1 };

    const both = withBands();
    both.voicing = { profileId: 'music', intensity: 1 };
    both.driver = { profileId: 'balanced-armature-iem', intensity: 1 };

    expect(preampValue(voiced)).toBeLessThan(bands);
    expect(preampValue(both)).toBeLessThan(preampValue(voiced));
  });

  it('gives the headroom back when a layer is removed', () => {
    const before = preampValue(withBands());

    const withLayers = withBands();
    withLayers.voicing = { profileId: 'music', intensity: 1 };
    withLayers.driver = { profileId: 'balanced-armature-iem', intensity: 1 };
    expect(preampValue(withLayers)).toBeLessThan(before);

    // Removing them must land back on the original value, not somewhere near
    // it — the whole point is that nothing is left over.
    const after = withBands();
    expect(preampValue(after)).toBe(before);
  });

  it('does not compound a previous automatic preamp value', () => {
    const state = withBands();
    const resolved = preampValue(state);

    // The persisted field may still describe an earlier render. Automatic
    // normalization is derived from the post-EQ chain, not from its own last
    // answer, so neither the right answer nor a stale lower one can be fed back
    // into the next pass and attenuated again.
    state.preAmp = resolved;
    expect(preampValue(state)).toBe(resolved);

    state.preAmp = resolved - 6;
    expect(preampValue(state)).toBe(resolved);
  });

  it('hands the reserve over when automatic mode is switched off', () => {
    // What the SET_AUTO_PREAMP handler does: ask the resolver with the flag
    // forced on, then flip the flag and publish that number either way.
    //
    // The failure this pins is a level jump, not a wrong number. A profile that
    // never set a preamp by hand carries 0 underneath an automatic value of
    // -11, so publishing that 0 on the way out made a chain reserving 11 dB
    // eleven decibels louder — from the switch whose entire purpose is to stop
    // it clipping.
    const state = withBands();
    state.isAutoPreAmpOn = true;
    state.preAmp = 0;

    const held = getResolvedPreAmp({ ...state, isAutoPreAmpOn: true });
    expect(held).toBeLessThan(-1);

    state.isAutoPreAmpOn = false;
    state.preAmp = held;

    expect(getResolvedPreAmp(state)).toBe(held);
    expect(getResolvedPreAmp(state)).not.toBe(0);
  });

  it('publishes the newly computed reserve when automatic mode is switched on', () => {
    // The other direction of the same trap. `resolvePreAmp` returns the stored
    // manual value while the flag is off, so a handler that reads it before
    // flipping answers with the very number it is supposed to be replacing —
    // and that number is what the switch then puts on screen.
    //
    // It looked correct anywhere the response graph was mounted, because the
    // graph recomputed and overwrote the display straight afterwards. On the
    // Karaoke tab, which mounts no graph, the stale manual value just stayed.
    const state = withBands();
    state.isAutoPreAmpOn = false;
    state.preAmp = -3;

    // Read with the flag as it stands, this is the manual value and nothing
    // else — which is exactly why the handler does not ask it that way.
    expect(getResolvedPreAmp(state)).toBe(-3);

    const automatic = getResolvedPreAmp({ ...state, isAutoPreAmpOn: true });
    expect(automatic).not.toBe(-3);

    state.isAutoPreAmpOn = true;
    state.preAmp = automatic;

    // And it settles there: automatic mode derives from the chain, so storing
    // its own answer back does not attenuate a second time.
    expect(getResolvedPreAmp(state)).toBe(automatic);
  });

  it('replaces a manual root value when automatic mode is enabled', () => {
    const state = withBands();
    state.preAmp = -5;

    const automatic = getResolvedPreAmp(state);

    expect(automatic).toBe(preampValue(state));
    expect(automatic).not.toBe(-5);
  });

  it('includes a generated convolution in the synchronized root value', () => {
    const state = getDefaultState();
    state.isAutoPreAmpOn = true;
    state.convolution = {
      name: 'Generated room correction',
      filters: {
        boost: {
          id: 'boost',
          frequency: 1000,
          gain: 6,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
    };

    expect(getResolvedPreAmp(state)).toBe(
      preampValue(state, 'generated-convolution.wav'),
    );
    expect(getResolvedPreAmp(state)).toBeLessThan(-5);
  });

  it('does not invent makeup gain for a peaking cut', () => {
    // Away from a peaking cut the chain still reaches unity. Strict peak
    // normalization therefore applies only the shared safety ceiling; adding
    // makeup here would push the unaffected frequencies over full scale.
    const state = withBands();
    state.filters.a.gain = -6;

    expect(preampValue(state)).toBe(-0.2);
  });

  it('leaves a narrow cut alone, because nothing was taken away', () => {
    // The distinction that makes the rule safe rather than merely generous.
    // A peaking cut lowers its own neighbourhood and nothing else — away from
    // its centre the chain is still at unity, so the loudest point never moved
    // and there is nothing to restore. Restoring anyway would be inventing
    // volume, which is what a compressor does and this is not one.
    const state = withBands();
    state.filters.a.gain = -6;
    state.filters.a.quality = 3;

    expect(Math.abs(preampValue(state))).toBeLessThan(0.5);
  });

  it('restores a shelf that took the whole band down with it', () => {
    // A wide shelf IS the case worth restoring: everything below its corner
    // comes down together, so the chain's loudest point genuinely drops and
    // the preamp is what puts it back.
    const state = withBands();
    state.filters = {
      a: {
        id: 'a',
        frequency: 12000,
        gain: -6,
        quality: 0.7,
        type: FilterTypeEnum.LSC,
      },
    };

    expect(preampValue(state)).toBeGreaterThan(1);
  });

  it('reserves nothing when the EQ is cleared and no layer is active', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;

    expect(preampValue(state)).toBe(0);
  });

  it('leaves a manual preamp completely alone', () => {
    const state = withBands();
    state.isAutoPreAmpOn = false;
    state.preAmp = -9.5;

    expect(preampValue(state)).toBe(-9.5);
  });

  it('cancels the peak of the combined chain, not the sum of the peaks', () => {
    // Two boosts far apart never coincide, so reserving both would throw away
    // headroom the user can hear as lost volume.
    const apart = getChainPeakGain([
      { type: FilterTypeEnum.PK, frequency: 60, gain: 6, quality: 2 },
      { type: FilterTypeEnum.PK, frequency: 8000, gain: 6, quality: 2 },
    ]);
    expect(apart).toBeGreaterThan(5.5);
    expect(apart).toBeLessThan(7);

    // Stacked at the same spot they genuinely do add up.
    const stacked = getChainPeakGain([
      { type: FilterTypeEnum.PK, frequency: 1000, gain: 6, quality: 2 },
      { type: FilterTypeEnum.PK, frequency: 1000, gain: 6, quality: 2 },
    ]);
    expect(stacked).toBeGreaterThan(11);
  });

  it('ignores non-finite filters rather than returning NaN', () => {
    expect(
      getChainPeakGain([
        { type: FilterTypeEnum.PK, frequency: NaN, gain: NaN, quality: NaN },
      ]),
    ).toBe(0);
  });
  it('reserves headroom for a GraphicEQ curve, which writes no Filter lines', () => {
    // GraphicEQ is a single line, not a filter list, so nothing lands in the
    // written-filter set. Deriving only from that set handed APO a +9 dB curve
    // with no attenuation at all.
    const state = getDefaultState();
    state.isFlat = false;
    state.isAutoPreAmpOn = true;
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 20, gain: 0 },
      { frequency: 100, gain: 9 },
      { frequency: 1000, gain: 0 },
    ];

    expect(preampValue(state)).toBe(-9.2);
  });

  it('reserves headroom for a convolution, which is one line too', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.convolution = {
      name: 'HRTF',
      filters: {
        x: {
          id: 'x',
          frequency: 120,
          gain: 5,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
    };

    // Needs the convolution filename, since the Convolution line is only
    // written when there is a file to point at.
    const line = stateToString(state, 'hrtf.wav')
      .replace(/\r/g, '')
      .split('\n')
      .filter((entry) => entry.startsWith('Preamp:'))[0];
    const preamp = Number(/-?[\d.]+/.exec(line)?.[0]);

    expect(preamp).toBeLessThan(0);
    expect(preamp).toBeCloseTo(-5, 0);
  });

  it('uses the measured response of a file-backed convolution', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.convolution = {
      name: 'Measured AutoEq IR',
      filters: {},
      fileName: 'measured.wav',
      peakGainDb: -1.92,
      response: [
        { frequency: 10, gain: -2.5 },
        { frequency: 17.5, gain: -1.92 },
        { frequency: 20000, gain: -8 },
      ],
    };

    expect(preampValue(state)).toBe(1.72);
  });

  it('strictly normalizes the affected AutoEq profile instead of weighting program material', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.headphone = {
      intensity: 1,
      filters: {
        lowShelf: {
          id: 'lowShelf',
          frequency: 105,
          gain: 6.4,
          quality: 0.7,
          type: FilterTypeEnum.LSC,
        },
        broadCut: {
          id: 'broadCut',
          frequency: 152,
          gain: -6.1,
          quality: 0.56,
          type: FilterTypeEnum.PK,
        },
        broadBoost: {
          id: 'broadBoost',
          frequency: 1011,
          gain: 10.8,
          quality: 0.18,
          type: FilterTypeEnum.PK,
        },
        cut1433: {
          id: 'cut1433',
          frequency: 1433,
          gain: -12,
          quality: 0.51,
          type: FilterTypeEnum.PK,
        },
        cut8474: {
          id: 'cut8474',
          frequency: 8474,
          gain: -7.3,
          quality: 1.28,
          type: FilterTypeEnum.PK,
        },
        highShelf: {
          id: 'highShelf',
          frequency: 10000,
          gain: -0.3,
          quality: 0.7,
          type: FilterTypeEnum.HSC,
        },
        cut2391: {
          id: 'cut2391',
          frequency: 2391,
          gain: -2.2,
          quality: 3.82,
          type: FilterTypeEnum.PK,
        },
        boost1706: {
          id: 'boost1706',
          frequency: 1706,
          gain: 1.8,
          quality: 4.47,
          type: FilterTypeEnum.PK,
        },
        cut1149: {
          id: 'cut1149',
          frequency: 1149,
          gain: -0.4,
          quality: 1.75,
          type: FilterTypeEnum.PK,
        },
        boost3244: {
          id: 'boost3244',
          frequency: 3244,
          gain: 2,
          quality: 6,
          type: FilterTypeEnum.PK,
        },
      },
    };

    const peak = getChainPeakGain(Object.values(state.headphone.filters));
    expect(peak).toBe(6.23);
    expect(preampValue(state)).toBe(-6.43);
  });

  it('reserves headroom for the measurable part of the custom FX file', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.customFx = {
      fileName: 'fluideq-device-custom.txt',
      preAmp: 2,
      filters: {
        custom: {
          id: 'custom',
          frequency: 1000,
          gain: 4,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
    };

    expect(preampValue(state)).toBeLessThan(-5);
  });

  it('reserves makeup level for a custom GraphicEQ that cuts everywhere', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.customFx = {
      fileName: 'fluideq-device-custom.txt',
      preAmp: 0,
      filters: {},
      graphicEq: [
        { frequency: 20, gain: -6 },
        { frequency: 1000, gain: -6 },
        { frequency: 20000, gain: -6 },
      ],
    };

    expect(preampValue(state)).toBeCloseTo(6, 0);
  });

  it('does not reserve for a bypassed custom FX file', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.bypassed = ['custom'];
    state.customFx = {
      fileName: 'fluideq-device-custom.txt',
      preAmp: 6,
      filters: {},
    };

    expect(preampValue(state)).toBe(0);
  });
});
