import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { scaleLinear } from 'd3';
import EditablePoint from 'renderer/graph/EditablePoint';
import type { IEditableChartPoint } from 'renderer/graph/ChartController';

it('focuses a clicked graph point and moves gain with Up and Down after release', async () => {
  const svgRef = createRef<SVGSVGElement>();
  const point: IEditableChartPoint = {
    id: 'band',
    name: 'Band',
    color: 'blue',
    mutedColor: 'grey',
    data: { x: 1000, y: 7.3 },
    selected: true,
    hovered: false,
    isEnabled: true,
    isLocked: false,
    onSelect: jest.fn(),
    onHover: jest.fn(),
    onChange: jest.fn(),
    onCommit: jest.fn(),
    onQualityWheel: jest.fn(),
    onGainStep: jest.fn(),
  };
  render(
    <svg ref={svgRef}>
      <EditablePoint
        point={point}
        svgRef={svgRef}
        xScale={scaleLinear().domain([20, 20000]).range([0, 400])}
        yScale={scaleLinear().domain([-20, 20]).range([300, 0])}
      />
    </svg>,
  );
  const handle = screen.getByRole('slider');
  handle.setPointerCapture = jest.fn();
  handle.hasPointerCapture = jest.fn(() => false);
  fireEvent.pointerDown(handle, { pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(handle).toHaveFocus();
  expect(point.onSelect).toHaveBeenCalledTimes(1);
  expect(fireEvent.keyDown(handle, { key: 'ArrowUp' })).toBe(false);
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  expect(point.onGainStep).toHaveBeenNthCalledWith(1, 1);
  expect(point.onGainStep).toHaveBeenNthCalledWith(2, -1);
  expect(point.onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(handle, { key: ' ', ctrlKey: true });
  expect(point.onSelect).toHaveBeenLastCalledWith('toggle', point.data);
  const user = userEvent.setup();
  await user.tab();
  await user.tab();
  expect(handle).toHaveFocus();
});

const handleFor = (overrides: Partial<IEditableChartPoint> = {}) => {
  const svgRef = createRef<SVGSVGElement>();
  const point: IEditableChartPoint = {
    id: 'band',
    name: 'Peak',
    color: 'blue',
    mutedColor: 'grey',
    // The dot stands on the summed curve, 7.3 dB; the band's own gain is 3.5.
    data: { x: 1600, y: 7.3 },
    parameters: { frequency: 1600, gain: 3.5, quality: 1.41 },
    selected: false,
    hovered: false,
    isEnabled: true,
    isLocked: false,
    onSelect: jest.fn(),
    onHover: jest.fn(),
    onChange: jest.fn(),
    onCommit: jest.fn(),
    onQualityWheel: jest.fn(),
    onGainStep: jest.fn(),
    ...overrides,
  };
  render(
    <svg ref={svgRef}>
      <EditablePoint
        point={point}
        svgRef={svgRef}
        xScale={scaleLinear().domain([20, 20000]).range([0, 400])}
        yScale={scaleLinear().domain([-20, 20]).range([300, 0])}
      />
    </svg>,
  );
  return { handle: screen.getByRole('slider'), point };
};

it('names a handle by its band’s shape and frequency, and reads the band’s own gain', () => {
  const { handle } = handleFor();
  // It was "PK band. Drag to change frequency and gain. …", in English in
  // every language, and read out the curve's level under the dot.
  expect(handle).toHaveAccessibleName(
    'Peak, 1.6 kHz. Drag to change its frequency and gain; Ctrl+scroll changes its Q.',
  );
  expect(handle).toHaveAttribute('aria-valuenow', '3.5');
  expect(handle).toHaveAttribute('aria-valuetext', '1.6 kHz, +3.5 dB');
  expect(handle).toHaveAttribute(
    'data-tooltip',
    'Peak · 1.6 kHz · +3.5 dB · Click to select',
  );
});

it('takes a handle off the keyboard while the EQ is switched off', () => {
  const { handle, point } = handleFor({ isLocked: true });
  expect(handle).toHaveAttribute('tabindex', '-1');
  expect(handle).toHaveAttribute('aria-disabled', 'true');
  // Focus left on it from before the switch moves nothing either.
  fireEvent.keyDown(handle, { key: 'ArrowUp' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  expect(point.onGainStep).not.toHaveBeenCalled();
  expect(point.onSelect).not.toHaveBeenCalled();
});
