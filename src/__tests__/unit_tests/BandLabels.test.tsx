import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { scaleLinear, scaleLog } from 'd3';
import BandLabels from 'renderer/graph/BandLabels';
import { IEditableChartPoint } from 'renderer/graph/ChartController';
import { genrePinBox, labelBoxesOverlap } from 'renderer/graph/bandLabelLayout';
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
  isLocked: false,
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
      bandSetReplacement={0}
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
        bandSetReplacement={0}
      />
    </svg>
  );
  const { container, rerender } = render(draw(points));
  // Eight bands inside 30px: the six lanes above and below hold six labels,
  // because none is ever moved off to the side of its dot.
  expect(container.querySelectorAll('.eq-band-label')).toHaveLength(6);
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

/**
 * Ivan, 2026-10-03: "reseting the EQ need to reset labels too". A label
 * keeps the home it was given while bands are edited; a whole new set of
 * bands from the main process — Clear EQ, a preset, a reset, another output
 * — lays every label out afresh, and a re-read that changed nothing does not.
 */
it('starts the labels over when the EQ is replaced, and only then', () => {
  const band = (id: string, frequency: number, gain: number) => ({
    ...point,
    id,
    data: { x: frequency, y: gain },
    parameters: { frequency, gain, quality: 1.44 },
  });
  const draw = (bands: IEditableChartPoint[], replacement: number) => (
    <svg>
      <BandLabels
        points={bands}
        xScale={scaleLog().domain([20, 20000]).range([0, 600])}
        yScale={scaleLinear().domain([-20, 20]).range([300, 0])}
        bounds={{ left: 0, right: 600, top: 0, bottom: 300 }}
        bandSetReplacement={replacement}
      />
    </svg>
  );
  const fresh = (bands: IEditableChartPoint[]) =>
    render(draw(bands, 0)).container.innerHTML;
  const flat = [band('a', 1000, 0), band('b', 1100, 0)];
  const lifted = [band('a', 1000, 0), band('b', 1100, 8)];
  const preset = [band('a', 1000, 0), band('b', 1100, 8.5)];

  const { container, rerender } = render(draw(flat, 0));
  rerender(draw(lifted, 0));
  const edited = container.innerHTML;
  // Band b's label kept its home below its dot through the edit, which is
  // not where a fresh layout of the same bands puts it.
  expect(edited).not.toBe(fresh(lifted));
  // The state read again after a Tone change: the same bands, nothing moves.
  rerender(draw(lifted, 1));
  expect(container.innerHTML).toBe(edited);
  // Positive control: the same change as an edit keeps the homes...
  const edit = render(draw(flat, 0));
  edit.rerender(draw(lifted, 0));
  edit.rerender(draw(preset, 0));
  expect(edit.container.innerHTML).not.toBe(fresh(preset));
  // ...and as a replacement starts over.
  rerender(draw(preset, 2));
  expect(container.innerHTML).toBe(fresh(preset));
});

it('keeps a band’s label off the genre pin drawn where it would stand', () => {
  const xScale = scaleLog().domain([20, 20000]).range([0, 600]);
  const yScale = scaleLinear().domain([-20, 20]).range([300, 0]);
  const flat = { ...point, data: { x: 1000, y: 0 } };
  const draw = (pins: Array<{ hz: number; db: number }>) => (
    <svg>
      <BandLabels
        points={[flat]}
        xScale={xScale}
        yScale={yScale}
        bounds={{ left: 0, right: 600, top: 0, bottom: 300 }}
        pins={pins}
        bandSetReplacement={0}
      />
    </svg>
  );
  const boxOf = (container: HTMLElement) => {
    const rect = container.querySelector('.eq-band-label rect');
    if (!rect) {
      throw new Error('no label');
    }
    return {
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  };
  const plain = boxOf(render(draw([])).container);
  // A pin whose dot is the label's centre, as a Preset line would put it.
  const pin = {
    hz: Number(xScale.invert(plain.x + plain.width / 2)),
    db: Number(yScale.invert(plain.y + plain.height / 2)),
  };
  const pinBox = genrePinBox(Number(xScale(pin.hz)), Number(yScale(pin.db)));
  expect(labelBoxesOverlap(plain, pinBox)).toBe(true);
  expect(labelBoxesOverlap(boxOf(render(draw([pin])).container), pinBox)).toBe(
    false,
  );
});

it('keeps a band’s label off a measuring view’s key', () => {
  const xScale = scaleLog().domain([20, 20000]).range([0, 600]);
  const yScale = scaleLinear().domain([-20, 20]).range([300, 0]);
  const flat = { ...point, data: { x: 1000, y: 0 } };
  const draw = (legend?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => (
    <svg>
      <BandLabels
        points={[flat]}
        xScale={xScale}
        yScale={yScale}
        bounds={{ left: 0, right: 600, top: 0, bottom: 300 }}
        legend={legend}
        bandSetReplacement={0}
      />
    </svg>
  );
  const boxOf = (container: HTMLElement) => {
    const rect = container.querySelector('.eq-band-label rect');
    if (!rect) {
      throw new Error('no label');
    }
    return {
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  };
  const plain = boxOf(render(draw()).container);
  // A key painted exactly where the label lands untold.
  const legend = { ...plain };
  expect(labelBoxesOverlap(plain, legend)).toBe(true);
  expect(labelBoxesOverlap(boxOf(render(draw(legend)).container), legend)).toBe(
    false,
  );
});
