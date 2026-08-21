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

import { FilterTypeEnum } from '../../../common/constants';
import {
  getAutoPreAmpGain,
  getCombinedResponsePeakGain,
  ICombinedResponse,
} from '../../../common/response';
import {
  getProgrammeChainExcessDb,
  getSmartPreAmpGain,
  IProgrammePoint,
  SMART_HEADROOM_MARGIN_DB,
} from '../../../common/smartHeadroom';

const band = (frequency: number, gain: number, quality = 1) => ({
  type: FilterTypeEnum.PK,
  frequency,
  gain,
  quality,
});

/** The geometric centres of the ten regions the capture reports on. */
const CENTRES = [28, 57, 113, 226, 453, 894, 1768, 3536, 7071, 14142];

const programme = (levels: number[]): IProgrammePoint[] =>
  CENTRES.map((frequency, index) => ({ frequency, gain: levels[index] }));

/** Flat everywhere: the chain's peak and the music's peak coincide. */
const FLAT = programme(CENTRES.map(() => -20));

/**
 * A pink-ish envelope, which is what real music looks like: bass loud, treble
 * forty-odd decibels down. The numbers are a rough −4.5 dB/octave slope, not a
 * measurement — the tests below read differences, never absolute values.
 */
const PINK = programme([-8, -13, -17, -22, -26, -31, -35, -40, -44, -49]);

describe('smart auto-normalize: the excess', () => {
  /*
   * THE NULL TEST AND ITS POSITIVE CONTROL, KEPT TOGETHER ON PURPOSE.
   *
   * "Recovers nothing" is what a correct implementation reports for flat
   * programme material AND what a broken one reports for everything. Neither
   * test means anything without the other beside it.
   */
  it('recovers nothing when the music is as flat as the chain (null)', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    const excess = getProgrammeChainExcessDb(response, FLAT);
    expect(excess).toBeCloseTo(getCombinedResponsePeakGain(response), 1);
  });

  it('recovers most of a treble boost on pink material (positive control)', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    const excess = getProgrammeChainExcessDb(response, PINK);
    // The 10 kHz boost lands where the music is ~30 dB down, so the peak of the
    // programme barely moves. Anything close to the chain's own 6 dB would mean
    // the measurement is not being read at all.
    expect(excess).toBeLessThan(1);
    expect(getCombinedResponsePeakGain(response)).toBeCloseTo(6, 0);
  });

  it('never exceeds the chain peak, for any chain and any material', () => {
    const chains: ICombinedResponse[] = [
      { filters: [band(60, 9)] },
      { filters: [band(3000, 12, 4)] },
      { filters: [band(100, 6), band(8000, 10), band(500, -4)] },
      { filters: [band(200, -8), band(4000, -3)] },
      { filters: [band(1000, 3)], constantGain: 2 },
      {
        curves: [
          [
            { frequency: 20, gain: 5 },
            { frequency: 20000, gain: -5 },
          ],
        ],
      },
    ];
    const materials = [
      FLAT,
      PINK,
      programme(CENTRES.map((_f, i) => -40 + i * 4)),
    ];
    chains.forEach((response) => {
      const peak = getCombinedResponsePeakGain(response);
      materials.forEach((material) => {
        expect(
          getProgrammeChainExcessDb(response, material),
        ).toBeLessThanOrEqual(peak + 1e-9);
      });
    });
  });

  it('is zero for a cut that misses where the music peaks', () => {
    // A notch at 3 kHz does not lower the peak of material whose peak is in the
    // bass, so there is nothing to give back. Zero is the right answer, and
    // getting a negative one here would be the loop handing out level for a cut
    // nobody's music was standing in.
    const response: ICombinedResponse = { filters: [band(3000, -6, 0.7)] };
    expect(getProgrammeChainExcessDb(response, PINK)).toBeCloseTo(0, 2);
  });

  it('is negative for a chain that cuts everywhere the music could be', () => {
    const broad: ICombinedResponse = { constantGain: -6 };
    expect(getProgrammeChainExcessDb(broad, PINK)).toBeCloseTo(-6, 1);
  });

  it('gives back only as much of a bass cut as it can see under', () => {
    // The cut is centred on PINK's own peak, so some level is genuinely
    // recoverable — but the span below 20 Hz is held at the programme's peak by
    // the no-evidence rule, and the cut has only rolled part of the way off by
    // then. The recovery is real and smaller than the 8 dB of the band itself,
    // which is the conservative direction.
    const bass: ICombinedResponse = { filters: [band(30, -8, 0.7)] };
    const excess = getProgrammeChainExcessDb(bass, PINK);
    expect(excess).toBeLessThan(0);
    expect(excess).toBeGreaterThan(-8);
  });

  it('is unchanged by the reference the levels are measured against', () => {
    const response: ICombinedResponse = { filters: [band(8000, 8)] };
    const quiet = getProgrammeChainExcessDb(response, PINK);
    const loud = getProgrammeChainExcessDb(
      response,
      PINK.map(({ frequency, gain }) => ({ frequency, gain: gain + 37 })),
    );
    expect(loud).toBeCloseTo(quiet, 6);
  });

  it('claims no recovery outside the band the capture can speak for', () => {
    // Material that peaks in the mids and is 32 dB down at the bottom of the
    // measured span. A boost below that span must NOT be paid for out of that
    // quiet bass reading: there is no evidence at 14 Hz, so the excess falls
    // back to the chain's own gain there.
    const midPeak = programme([
      -40, -30, -20, -12, -8, -12, -20, -28, -36, -44,
    ]);
    const response: ICombinedResponse = { filters: [band(14, 9, 3)] };
    expect(getProgrammeChainExcessDb(response, midPeak)).toBeCloseTo(
      getCombinedResponsePeakGain(response),
      0,
    );
    // The positive control for the line above: the same material with the same
    // boost moved inside the measured span, where the quiet reading IS evidence,
    // recovers nearly all of it.
    const inBand: ICombinedResponse = { filters: [band(60, 9, 3)] };
    expect(getProgrammeChainExcessDb(inBand, midPeak)).toBeLessThan(1);
  });

  it('reproduces the worst case when nothing has been heard yet', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    expect(getProgrammeChainExcessDb(response, [])).toBeCloseTo(
      getCombinedResponsePeakGain(response),
      6,
    );
  });
});

describe('smart auto-normalize: the preamp', () => {
  it('is never quieter than the shipped worst case, for any chain', () => {
    // The load-bearing promise of the whole feature: moving the switch from
    // Normalize to Smart can add level and can leave it alone, and can never
    // take it away. Everything else here is an optimisation; this is the part a
    // user would notice going wrong.
    const chains: ICombinedResponse[] = [
      { filters: [band(10000, 6)] },
      { filters: [band(60, 9)] },
      { filters: [band(3000, 12, 4)] },
      { filters: [band(1000, 0.5)] },
      { filters: [band(200, -8), band(4000, -3)] },
      { filters: [band(100, 6), band(8000, 10), band(500, -4)] },
      { constantGain: -6 },
      { filters: [band(1000, 3)], constantGain: 2 },
    ];
    [FLAT, PINK].forEach((material) => {
      chains.forEach((response) => {
        expect(getSmartPreAmpGain(response, material)).toBeGreaterThanOrEqual(
          getAutoPreAmpGain(response),
        );
      });
    });
  });

  it('actually recovers level where the music leaves room (positive control)', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    expect(getSmartPreAmpGain(response, PINK)).toBeGreaterThan(
      getAutoPreAmpGain(response) + 2,
    );
  });

  it('leaves an empty chain alone', () => {
    expect(getSmartPreAmpGain({ filters: [], curves: [] }, PINK)).toBe(0);
  });

  it('reserves the estimate plus the margin', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    const excess = getProgrammeChainExcessDb(response, PINK);
    expect(getSmartPreAmpGain(response, PINK)).toBeCloseTo(
      -(excess + SMART_HEADROOM_MARGIN_DB),
      1,
    );
  });

  it('lets the supervisor take level away but never add it', () => {
    const response: ICombinedResponse = { filters: [band(10000, 6)] };
    const plain = getSmartPreAmpGain(response, PINK);
    expect(getSmartPreAmpGain(response, PINK, -4)).toBeCloseTo(plain - 4, 2);
    // A positive trim would be the supervisor making the output louder, which
    // is the one thing it exists to prevent.
    expect(getSmartPreAmpGain(response, PINK, 4)).toBeCloseTo(plain, 2);
  });
});
