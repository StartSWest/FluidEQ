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

/**
 * The headphone layer, on the graph.
 *
 * It was the one layer the plot did not know about. Not drawing it was the
 * visible half; the half worth a test is that it was also missing from the sum
 * the plot calls "Final output" and from the headroom shown under it — so the
 * graph drew a total that was not the total, and did it silently, with every
 * other curve looking exactly right.
 *
 * A missing curve is noticed the first time somebody looks. A total that is
 * wrong by however much a published correction boosts is not noticed at all,
 * which is why these cases go through the chart's own data rather than through
 * the helpers underneath it: what has to hold is that the layer reaches the sum,
 * and only the component knows what it puts in that sum.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  FilterTypeEnum,
  IDriverSettings,
  IFiltersMap,
  IHeadphoneSettings,
  TApoLayer,
} from 'common/constants';
import { getLineGainAtFrequency } from 'renderer/graph/utils';
import { IChartCurveData } from 'renderer/graph/ChartController';

/* --- the world the chart reads ------------------------------------------ */

interface IWorld {
  filters: IFiltersMap;
  headphone?: IHeadphoneSettings;
  driver?: IDriverSettings;
  bypassed: TApoLayer[];
  isAutoPreAmpOn: boolean;
}

const mockWorld: IWorld = {
  filters: {},
  headphone: undefined,
  driver: undefined,
  bypassed: [],
  isAutoPreAmpOn: false,
};

/** Every automatic preamp the chart presented in the UI, in order. */
const mockDisplayedPreAmps: number[] = [];

/** Automatic values must never be persisted through the manual-preamp API. */
const mockSetMainPreAmp = jest.fn(() => Promise.resolve());

jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: mockWorld.filters,
    headphone: mockWorld.headphone,
    bypassed: mockWorld.bypassed,
    isAutoPreAmpOn: mockWorld.isAutoPreAmpOn,
    isGraphViewOn: true,
    isEngineUsable: true,
    isLoading: false,
    globalError: undefined,
    preAmp: 0,
    convolution: undefined,
    voicing: undefined,
    driver: mockWorld.driver,
    smartEq: undefined,
    setGlobalError: jest.fn(),
    setPreAmp: (value: number) => mockDisplayedPreAmps.push(value),
    dispatchFilter: jest.fn(),
    selectedFilterIds: [],
    setSelectedFilterIds: jest.fn(),
    hoveredFilterId: '',
    setHoveredFilterId: jest.fn(),
  }),
}));

jest.mock('renderer/utils/equalizerApi', () => ({
  setFrequency: jest.fn(),
  setGain: jest.fn(),
  setQuality: jest.fn(),
  setMainPreAmp: mockSetMainPreAmp,
}));

/**
 * The plot itself, replaced by something that only records what it was handed.
 *
 * The curves are the subject here, and the real chart is d3 measuring a box
 * jsdom gives no size — so drawing it would test the renderer's opinion of an
 * element that is zero pixels wide rather than the arithmetic above it.
 */
const mockChart: { data: IChartCurveData[] } = { data: [] };

jest.mock('renderer/graph/Chart', () => ({
  __esModule: true,
  default: (props: { data: IChartCurveData[] }) => {
    mockChart.data = props.data;
    return null;
  },
}));

// The clip badge subscribes to the analyser and refuses to render outside a
// provider. A silent frame is what these cases want anyway: no wave, no clip,
// and nothing arriving between a render and an assertion.
jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrame: () => ({ points: [], isClipping: false }),
  // The plot owns the capture while it is drawn, and claiming reads the
  // control context — which refuses outside a provider for the same reason the
  // clip badge does. These cases render the chart alone, so the claim is a
  // no-op here rather than the hook being softened: a consumer mounted outside
  // the provider is a real bug everywhere except in a test that means it.
  useLiveAudioCapture: () => undefined,
}));

// Neither takes part in deciding a curve, and both drag a stylesheet and a
// portal into a test about numbers.
jest.mock('renderer/graph/GraphViewMenu', () => () => null);
jest.mock('renderer/components/LookDesigner', () => () => null);

// eslint-disable-next-line import/first
import FrequencyResponseChart from 'renderer/graph/FrequencyResponseChart';

/* --- harness ------------------------------------------------------------ */

const band = (id: string, frequency: number, gain: number) => ({
  id,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
});

/** One band at 100 Hz, so the EQ curve is present and obviously not this. */
const EQ_BANDS: IFiltersMap = { low: band('low', 100, 3) };

/** A published correction: one clear 6 dB lift, an octave away from the band. */
const CORRECTION: IHeadphoneSettings = {
  filters: { hp: band('hp', 1000, 6) },
  intensity: 1,
};

const draw = (world: Partial<IWorld>) => {
  Object.assign(mockWorld, {
    filters: EQ_BANDS,
    headphone: undefined,
    driver: undefined,
    bypassed: [],
    isAutoPreAmpOn: false,
    ...world,
  });
  mockChart.data = [];
  mockDisplayedPreAmps.length = 0;
  mockSetMainPreAmp.mockClear();
  return render(<FrequencyResponseChart />);
};

const curve = (id: string) => mockChart.data.find((entry) => entry.id === id);

/** The headroom the chart settled on, which is the last one it displayed. */
const displayedPreAmp = () =>
  mockDisplayedPreAmps[mockDisplayedPreAmps.length - 1];

const gainAt = (id: string, frequency: number) => {
  const points = curve(id)?.line.points;
  if (!points) {
    throw new Error(`no curve on the plot with the id ${id}`);
  }
  return getLineGainAtFrequency(points, frequency);
};

describe('the headphone layer on the frequency response graph', () => {
  it('draws the published correction as a curve of its own', () => {
    draw({ headphone: CORRECTION });

    // Its own line, not folded into the bands: the EQ curve is still only the
    // one band at 100 Hz, which is the whole complaint that started this — a
    // correction shown as if the user had dialled it in.
    expect(gainAt('Headphone Correction', 1000)).toBeCloseTo(6, 1);
    expect(gainAt('EQ Response', 1000)).toBeCloseTo(0, 1);
    expect(gainAt('EQ Response', 100)).toBeCloseTo(3, 1);
  });

  it('names it in the legend, beside the layers that already had a chip', () => {
    draw({ headphone: CORRECTION });

    expect(screen.getByRole('button', { name: 'Headphone' })).toBeVisible();
  });

  /**
   * THE PART THAT WAS WRONG RATHER THAN MISSING.
   *
   * A curve nobody drew is a gap. A curve labelled "Final output" that leaves
   * out the largest correction in the chain is a claim, and it was false —
   * silently, because the line was there and looked like a total.
   */
  it('adds it into the final output', () => {
    draw({ headphone: CORRECTION });

    const total = gainAt('Total Response', 1000);
    expect(total).toBeCloseTo(6, 1);
    // The sum of the layers, and not merely "not zero": the EQ contributes
    // almost nothing an octave up, so the total there IS the correction.
    expect(total).toBeCloseTo(
      gainAt('EQ Response', 1000) + gainAt('Headphone Correction', 1000),
      1,
    );
    // And still the sum of the two down where the bands are, so the layer was
    // added rather than swapped in for them.
    expect(gainAt('Total Response', 100)).toBeCloseTo(
      gainAt('EQ Response', 100) + gainAt('Headphone Correction', 100),
      1,
    );
    expect(gainAt('EQ Response', 100)).toBeCloseTo(3, 1);
  });

  /*
   * THE GRAPH REPORTS THE PREAMP; IT NO LONGER DERIVES IT.
   *
   * This used to recompute the worst case from the drawn chain and assert the
   * two agreed. They cannot any more, and should not: auto normalize now
   * reserves what the music needs, half of which is a measurement only the main
   * process holds. A second derivation here would be a second, always-different
   * answer — and because the chart mirrors this value straight into `setPreAmp`,
   * it would overwrite the real one on every render. Which is not hypothetical:
   * measured in the running app, the config carried -4.36 dB while the sidebar
   * sat at -20.00 dB and never moved.
   *
   * That the headphone layer is reserved for at all is still guaranteed and
   * still tested — against the resolver that actually writes the config, in
   * `main/smartHeadroomPreamp.test.ts`.
   */
  it('shows the preamp the writer settled on, without deriving its own', () => {
    draw({ headphone: CORRECTION, isAutoPreAmpOn: true });

    expect(displayedPreAmp()).toBeCloseTo(0, 2);
    // Still never writes back. The renderer mirrors this number; it does not
    // own it, and a write from here would be a second author for one value.
    expect(mockSetMainPreAmp).not.toHaveBeenCalled();
  });

  it('takes the curve and the chip away when it is bypassed', () => {
    draw({
      headphone: CORRECTION,
      bypassed: ['headphone'],
      isAutoPreAmpOn: true,
    });

    // Switched off means not in the config, so it is not on the plot either —
    // the rule every other layer already followed, and what makes the A/B
    // honest. The headroom half of this moved to the resolver; see above.
    expect(curve('Headphone Correction')).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Headphone' })).toBeNull();
  });

  it('draws a native GraphicEQ file edit in its original layer and the total', () => {
    draw({
      driver: {
        profileId: 'apo-custom',
        intensity: 1,
        apoOverride: {
          filters: {},
          graphicEq: [
            { frequency: 20, gain: 0 },
            { frequency: 1000, gain: 4.25 },
            { frequency: 20000, gain: 0 },
          ],
        },
      },
    });

    expect(gainAt('Driver', 1000)).toBeCloseTo(4.25, 2);
    expect(gainAt('Total Response', 1000)).toBeCloseTo(
      gainAt('EQ Response', 1000) + 4.25,
      1,
    );
  });
});
