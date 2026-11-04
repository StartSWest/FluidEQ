/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import { dynamicsPresetSettings } from '../../../common/dsp/dynamicsPresets';
import DspDynamicsGraph from '../../../renderer/dsp/DspDynamicsGraph';

it('draws a dry Mix as unity, including when make-up and compression are set', () => {
  const wet = dynamicsPresetSettings('vocal', true);
  const { container, rerender } = render(
    <DspDynamicsGraph dynamics={{ ...wet, mix: 0 }} />,
  );
  const curves = () =>
    [...container.querySelectorAll('polyline')].map((line) =>
      line.getAttribute('points'),
    );
  const dry = curves();
  expect(new Set(dry).size).toBe(1);
  const points = (dry[0] ?? '')
    .split(' ')
    .map((point) => point.split(',').map(Number));
  // The transfer curve's two corners are the unity line's actual endpoints.
  const unity = container.querySelector('.dsp-dynamics-unity');
  expect(points[0]).toEqual([
    Number(unity?.getAttribute('x1')),
    Number(unity?.getAttribute('y1')),
  ]);
  expect(points[points.length - 1]).toEqual([
    Number(unity?.getAttribute('x2')),
    Number(unity?.getAttribute('y2')),
  ]);
  rerender(<DspDynamicsGraph dynamics={wet} />);
  expect(curves()).not.toEqual(dry);
  expect(
    container.querySelector('.dsp-dynamics-spectrum canvas'),
  ).not.toBeNull();
});
