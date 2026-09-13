import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LightingSlider from 'renderer/plus/lighting/LightingSlider';

it('snaps pointer changes to absolute quarters, including values above 100%', () => {
  const commit = jest.fn();
  render(
    <LightingSlider label="Foreground" value={1} max={2} onCommit={commit} />,
  );
  const slider = screen.getByRole('slider', { name: 'Foreground' });
  fireEvent.change(slider, { target: { value: '1.36' } });
  expect(slider).toHaveAttribute('aria-valuetext', '125%');
  fireEvent.pointerUp(slider);
  expect(commit).toHaveBeenCalledWith(1.25);
  fireEvent.change(slider, { target: { value: '1.68' } });
  expect(slider).toHaveAttribute('aria-valuetext', '175%');
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
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuetext', `${percent}%`);
  });
  fireEvent.keyDown(slider, { key: 'ArrowLeft' });
  expect(slider).toHaveAttribute('aria-valuetext', '75%');
  fireEvent.keyDown(slider, { key: 'Home' });
  expect(slider).toHaveAttribute('aria-valuetext', '10%');
  fireEvent.change(slider, { target: { value: '0.8' } });
  expect(slider).toHaveAttribute('aria-valuetext', '80%');
});

it('preserves an existing fine value until adjusted, then commits keyboard snapping', () => {
  const commit = jest.fn();
  render(<LightingSlider label="Motion" value={0.38} onCommit={commit} />);
  const slider = screen.getByRole('slider', { name: 'Motion' });
  expect(slider).toHaveAttribute('aria-valuetext', '38%');
  expect(commit).not.toHaveBeenCalled();
  fireEvent.keyDown(slider, { key: 'ArrowDown' });
  fireEvent.keyUp(slider, { key: 'ArrowDown' });
  expect(commit).toHaveBeenCalledWith(0.25);
});
