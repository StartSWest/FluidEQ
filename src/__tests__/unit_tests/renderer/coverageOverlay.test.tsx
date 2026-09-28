/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart EQ's lines on the graph are dragged with the pointer captured. A drag
 * used to end only when the pointer lifted, so one the system cancelled — a
 * touch turned into a scroll, the window losing the pointer — stayed armed,
 * and the next pass over the same strip moved the line with no button held.
 */

import { fireEvent, render } from '@testing-library/react';
import { scaleLinear, scaleLog } from 'd3';
import CoverageOverlay from '../../../renderer/graph/CoverageOverlay';
import { setCorrectionLimit } from '../../../renderer/utils/correctionLimit';
import { setPresenceLine } from '../../../renderer/utils/presenceThreshold';

jest.mock('../../../renderer/audio/smartEqMeasurement', () => ({
  useSmartEqMeasurement: () => ({
    progress: {
      regions: [
        {
          label: 'bass',
          lowFrequency: 60,
          highFrequency: 250,
          centreFrequency: 122,
          confidence: 0.5,
          isCovered: false,
          liveDb: -30,
          typicalDb: -30,
          weight: 1,
        },
      ],
    },
    presenceLevels: [],
    presenceTypical: [],
  }),
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useGraphCoverageHidden: () => false,
}));
jest.mock('../../../renderer/utils/presenceThreshold', () => ({
  getPresenceLine: (edge: string) => (edge === 'floor' ? -40 : -20),
  hasCustomPresenceRange: () => false,
  movePresenceRange: jest.fn(),
  presenceAllowance: () => 0.5,
  resetPresenceRange: jest.fn(),
  setPresenceLine: jest.fn(),
  usePresenceLines: () => undefined,
}));
jest.mock('../../../renderer/utils/smartEqMode', () => ({
  useSmartEqMode: () => undefined,
}));
jest.mock('../../../renderer/utils/correctionLimit', () => ({
  DEFAULT_CORRECTION_LIMIT_DB: 6,
  setCorrectionLimit: jest.fn(),
  useCorrectionLimit: () => 6,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The test DOM has no PointerEvent, so every pointer arrives without an id;
// what is held here is only whether something is captured at all.
const captured = new Set<number>();

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    setPointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.add(pointerId),
    },
    hasPointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.has(pointerId),
    },
    releasePointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.delete(pointerId),
    },
  });
});

afterEach(() => {
  captured.clear();
  jest.clearAllMocks();
});

const showOverlay = () => {
  const view = render(
    <svg>
      <CoverageOverlay
        xScale={scaleLog().domain([20, 20000]).range([0, 1000])}
        yScale={scaleLinear().domain([0, -80]).range([0, 400])}
        eqScale={scaleLinear().domain([20, -20]).range([0, 400])}
        top={0}
        plotHeight={400}
        isResponseHidden={false}
        isOverScene={false}
      />
    </svg>,
  );
  const strip = (selector: string) => {
    const found = view.container.querySelector(selector);
    if (!found) {
      throw new Error(`no ${selector} on the graph`);
    }
    return found;
  };
  return {
    limit: strip('.chart-limit__grab'),
    floor: strip('.chart-presence--floor .chart-presence__grab'),
  };
};

describe.each([
  ['cancelled', fireEvent.pointerCancel],
  ['losing its capture', fireEvent.lostPointerCapture],
])('a drag %s', (_name, end) => {
  it('leaves the correction limit where it was left', () => {
    const { limit } = showOverlay();
    fireEvent.pointerDown(limit, { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(limit, { pointerId: 1, clientY: 120 });
    expect(setCorrectionLimit).toHaveBeenCalledTimes(1);
    end(limit, { pointerId: 1 });
    fireEvent.pointerMove(limit, { pointerId: 1, clientY: 160 });
    expect(setCorrectionLimit).toHaveBeenCalledTimes(1);
  });

  it('leaves a presence line where it was left', () => {
    const { floor } = showOverlay();
    fireEvent.pointerDown(floor, { pointerId: 2, clientY: 200 });
    fireEvent.pointerMove(floor, { pointerId: 2, clientY: 210 });
    expect(setPresenceLine).toHaveBeenCalledTimes(1);
    end(floor, { pointerId: 2 });
    fireEvent.pointerMove(floor, { pointerId: 2, clientY: 260 });
    expect(setPresenceLine).toHaveBeenCalledTimes(1);
  });
});

it('still ends a drag on the lift, and lets the pointer go', () => {
  const { limit } = showOverlay();
  fireEvent.pointerDown(limit, { pointerId: 3, clientY: 100 });
  expect(captured.size).toBe(1);
  fireEvent.pointerUp(limit, { pointerId: 3 });
  expect(captured.size).toBe(0);
  fireEvent.pointerMove(limit, { pointerId: 3, clientY: 160 });
  expect(setCorrectionLimit).not.toHaveBeenCalled();
});
