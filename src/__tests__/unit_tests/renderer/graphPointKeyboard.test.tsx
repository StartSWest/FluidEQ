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
