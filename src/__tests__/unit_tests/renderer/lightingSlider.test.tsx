import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LightingSlider from 'renderer/plus/lighting/LightingSlider';

it('drags freely between quarter marks and snaps only nearby values, including above 100%', () => {
  const commit = jest.fn();
  render(
    <LightingSlider label="Foreground" value={1} max={2} onCommit={commit} />,
  );
  const slider = screen.getByRole('slider', { name: 'Foreground' });
  fireEvent.change(slider, { target: { value: '1.36' } });
  expect(slider).toHaveAttribute('aria-valuetext', '136%');
  fireEvent.pointerUp(slider);
  expect(commit).toHaveBeenLastCalledWith(1.36);
  fireEvent.change(slider, { target: { value: '1.24' } });
  expect(slider).toHaveAttribute('aria-valuetext', '125%');
  fireEvent.pointerUp(slider);
  expect(commit).toHaveBeenLastCalledWith(1.25);
  fireEvent.change(slider, { target: { value: '1.73' } });
  expect(slider).toHaveAttribute('aria-valuetext', '175%');
  expect(slider).toHaveAttribute('step', 'any');
  expect(screen.getByText('150%')).toBeInTheDocument();
  expect(screen.getByText('200%')).toBeInTheDocument();
});

it('steps through 25%, 50%, 75% from an off-grid minimum and preserves endpoints', () => {
  render(
    <LightingSlider
      label="Brightness"
      value={0.1}
      min={0.1}
      max={0.8}
      onCommit={jest.fn()}
    />,
  );
  const slider = screen.getByRole('slider', { name: 'Brightness' });
  [25, 50, 75, 80].forEach((percent) => {
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider).toHaveAttribute('aria-valuetext', `${percent}%`);
  });
  fireEvent.keyDown(slider, { key: 'PageDown' });
  expect(slider).toHaveAttribute('aria-valuetext', '75%');
  fireEvent.keyDown(slider, { key: 'Home' });
  expect(slider).toHaveAttribute('aria-valuetext', '10%');
  fireEvent.change(slider, { target: { value: '0.8' } });
  expect(slider).toHaveAttribute('aria-valuetext', '80%');
});

it('preserves fine values and lets keyboard nudges cross magnetic marks one percent at a time', () => {
  const commit = jest.fn();
  render(<LightingSlider label="Motion" value={0.26} onCommit={commit} />);
  const slider = screen.getByRole('slider', { name: 'Motion' });
  expect(slider).toHaveAttribute('aria-valuetext', '26%');
  expect(commit).not.toHaveBeenCalled();
  [25, 24, 23].forEach((percent) => {
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider).toHaveAttribute('aria-valuetext', `${percent}%`);
  });
  fireEvent.keyUp(slider, { key: 'ArrowDown' });
  expect(commit).toHaveBeenCalledWith(0.23);
});

it('snaps position offsets around negative marks and centre while preserving endpoints', () => {
  render(
    <LightingSlider
      label="Position"
      value={0}
      min={-0.5}
      max={0.5}
      onCommit={jest.fn()}
    />,
  );
  const slider = screen.getByRole('slider', { name: 'Position' });
  [
    ['-0.24', '-25%'],
    ['-0.16', '-16%'],
    ['0.02', '0%'],
    ['0.5', '50%'],
  ].forEach(([value, text]) => {
    fireEvent.change(slider, { target: { value } });
    expect(slider).toHaveAttribute('aria-valuetext', text);
  });
  fireEvent.keyDown(slider, { key: 'Home' });
  expect(slider).toHaveAttribute('aria-valuetext', '-50%');
  fireEvent.keyDown(slider, { key: 'End' });
  expect(slider).toHaveAttribute('aria-valuetext', '50%');
});
