import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { scaleLinear, scaleLog } from 'd3';
import BandLabels from 'renderer/graph/BandLabels';
import { IEditableChartPoint } from 'renderer/graph/ChartController';
import {
  setGraphContents,
  toggleGraphBandLabels,
  setGraphView,
} from 'renderer/utils/graphViewSettings';

const point: IEditableChartPoint = {
  id: 'band',
  name: 'Bell',
  color: '#7ad',
  mutedColor: '#678',
  data: { x: 1000, y: 8 },
  parameters: { frequency: 1000, gain: 3.5, quality: 1.44 },
  selected: false,
  hovered: false,
  isEnabled: true,
  onSelect: jest.fn(),
  onChange: jest.fn(),
  onCommit: jest.fn(),
  onQualityWheel: jest.fn(),
  onGainStep: jest.fn(),
  onHover: jest.fn(),
};
const fixture = (band = point) => (
  <svg>
    <BandLabels
      points={[band]}
      xScale={scaleLog().domain([20, 20000]).range([0, 600])}
      yScale={scaleLinear().domain([-20, 20]).range([300, 0])}
      bounds={{ left: 0, right: 600, top: 0, bottom: 300 }}
    />
  </svg>
);

beforeEach(() => {
  setGraphView('normal');
  setGraphContents('everything');
});

it('shows editable band values, updates Q immediately and hides only the label', () => {
  const { container, rerender } = render(fixture());
  const readLines = () =>
    Array.from(container.querySelectorAll('.eq-band-label text')).map(
      (element) => element.textContent,
    );
  expect(readLines()).toEqual(['1 kHz', 'Q 1.44', '+3.5 dB']);
  const linePositions = Array.from(
    container.querySelectorAll('.eq-band-label text'),
  ).map((element) => Number(element.getAttribute('y')));
  expect(linePositions[0]).toBeLessThan(linePositions[1]);
  expect(linePositions[1]).toBeLessThan(linePositions[2]);
  expect(container).not.toHaveTextContent('8 dB');
  rerender(
    fixture({
      ...point,
      parameters: { frequency: 1000, gain: -2, quality: 4 },
    }),
  );
  expect(readLines()).toEqual(['1 kHz', 'Q 4', '-2 dB']);
  act(() => toggleGraphBandLabels());
  expect(container.querySelectorAll('.eq-band-label')).toHaveLength(0);
  act(() => setGraphContents('everything'));
  expect(container.querySelectorAll('.eq-band-label')).toHaveLength(1);
  expect(point.data).toEqual({ x: 1000, y: 8 });
});

it('keeps all readouts stationary and identical when a crowded band is hovered or selected', () => {
  const points = Array.from({ length: 8 }, (_, index) => ({
    ...point,
    id: String(index),
    data: { x: 900 + index * 50, y: 0 },
  }));
  const draw = (bands: IEditableChartPoint[]) => (
    <svg>
      <BandLabels
        points={bands}
        xScale={scaleLog().domain([20, 20000]).range([0, 600])}
        yScale={scaleLinear().domain([-20, 20]).range([300, 0])}
        bounds={{ left: 0, right: 600, top: 0, bottom: 300 }}
      />
    </svg>
  );
  const { container, rerender } = render(draw(points));
  expect(container.querySelectorAll('.eq-band-label')).toHaveLength(8);
  const before = container.innerHTML;
  rerender(
    draw(
      points.map((band, index) => ({
        ...band,
        hovered: index === 7,
        selected: index === 7,
      })),
    ),
  );
  expect(container.innerHTML).toBe(before);
});
