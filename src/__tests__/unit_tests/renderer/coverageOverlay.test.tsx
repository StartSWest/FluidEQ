/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart EQ's progress on the graph is a strip of its regions along the foot,
 * and nothing more. Its lines — the presence floor and ceiling and the
 * correction limit, dragged with the pointer captured — left the plot on
 * 2026-11-16 with the listening bands (01afe84f6), and the cases that held
 * their drags with them: what is held now is that none is drawn to drag, and
 * that the strip takes no pointer from the plot it lies on.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { scaleLog } from 'd3';
import CoverageOverlay from '../../../renderer/graph/CoverageOverlay';

// The ranges come from what the dust over them is drawn from
// (`smartEqPreview.ts`); the levels for their tint from the measurement.
jest.mock('../../../renderer/audio/smartEqMeasurement', () => ({
  useSmartEqMeasurement: () => ({
    presenceLevels: [],
    presenceTypical: [],
  }),
}));
jest.mock('../../../renderer/utils/smartEqPreview', () => ({
  useSmartEqPreview: () => ({
    phase: 'listening',
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
      },
    ],
  }),
}));
jest.mock('../../../renderer/utils/presenceThreshold', () => ({
  getPresenceLine: (edge: string) => (edge === 'floor' ? -40 : -20),
  presenceAllowance: () => 0.5,
  usePresenceLines: () => undefined,
}));

const showOverlay = (isResponseHidden = false) =>
  render(
    <svg>
      <CoverageOverlay
        xScale={scaleLog().domain([20, 20000]).range([0, 1000])}
        top={0}
        plotHeight={400}
        isResponseHidden={isResponseHidden}
      />
    </svg>,
  ).container;

it('draws the measured region as a strip along the foot', () => {
  const view = showOverlay();
  const fill = view.querySelector('.chart-coverage__fill');
  expect(fill).not.toBeNull();
  // Half measured: half the region's width, 60 Hz to 250 Hz on the scale.
  const width = Number(
    view.querySelector('.chart-coverage__track')?.getAttribute('width'),
  );
  expect(width).toBeGreaterThan(0);
  expect(Number(fill?.getAttribute('width'))).toBeCloseTo(width / 2, 6);
  expect(Number(fill?.getAttribute('y'))).toBe(400 - 6);
});

it('draws no line to drag, and takes no pointer from the plot', () => {
  const view = showOverlay();
  // POSITIVE CONTROL: the overlay is drawn, so the absences are its own.
  const strip = view.querySelector('.chart-coverage');
  expect(strip).not.toBeNull();
  expect(strip).toHaveAttribute('pointer-events', 'none');
  expect(view.querySelector('.chart-limit__grab')).toBeNull();
  expect(view.querySelector('.chart-presence__grab')).toBeNull();
  expect(view.querySelector('.chart-presence')).toBeNull();
});

it('leaves with the response it belongs to', () => {
  expect(showOverlay(true).querySelector('.chart-coverage')).toHaveClass(
    'is-leaving',
  );
});
