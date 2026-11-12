/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import SignedCounter from 'renderer/components/featureTour/SignedCounter';
import {
  FLUIDEQ_BEGAN_AT,
  liveFor,
} from 'renderer/components/featureTour/liveFor';

/**
 * 2.5's live count of how long FluidEQ has been alive (Ivan, 2026-11-11:
 * "make the timer real-time, always showing the current time passed from the
 * start, not a fixed value"): read from the clock it is handed, on animation
 * frames, never a timer.
 */

/** Animation frames this test runs by hand. */
let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const due = frames;
  frames = [];
  act(() => due.forEach((frame) => frame(0)));
};

beforeEach(() => {
  frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((frame: FrameRequestCallback) => {
      frames.push(frame);
      return frames.length;
    });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const DAY = 86_400_000;

const unitText = (unit: string) =>
  document.querySelector(`.signed-counter__unit.is-${unit}`)?.textContent;

it('counts from the moment the repository was created', () => {
  expect(new Date(FLUIDEQ_BEGAN_AT).toISOString()).toBe(
    '2026-08-02T15:02:14.000Z',
  );
  expect(liveFor(FLUIDEQ_BEGAN_AT + 101 * DAY + 3_725_000)).toEqual({
    days: 101,
    hours: 1,
    minutes: 2,
    seconds: 5,
  });
  // A clock set before the start reads nothing, never a negative age.
  expect(liveFor(FLUIDEQ_BEGAN_AT - 5000)).toEqual({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
});

it('ticks with the clock it reads, on animation frames', () => {
  let now = FLUIDEQ_BEGAN_AT + 101 * DAY + 3_725_000;
  render(<SignedCounter now={() => now} />);
  expect(unitText('day')).toBe('101days');
  expect(unitText('second')).toBe('05seconds');

  // Nothing moves until a frame runs, and a frame inside the same second
  // shows the same second.
  now += 400;
  runFrame();
  expect(unitText('second')).toBe('05seconds');

  // The next whole second, then the clock's own jump of a minute.
  now += 600;
  runFrame();
  expect(unitText('second')).toBe('06seconds');
  now += 60_000;
  runFrame();
  expect(unitText('minute')).toBe('03minutes');
  // Each frame asks for the next one: the count keeps going.
  expect(frames).toHaveLength(1);
});

it('names each unit with the plural its number takes', () => {
  // One day, one hour, one minute, one second.
  render(
    <SignedCounter now={() => FLUIDEQ_BEGAN_AT + DAY + 3_600_000 + 61_000} />,
  );
  const count = screen.getByRole('group', {
    name: 'FluidEQ has been live for',
  });
  expect(within(count).getByText('day')).toBeInTheDocument();
  expect(within(count).getByText('hour')).toBeInTheDocument();
  expect(within(count).getByText('minute')).toBeInTheDocument();
  expect(within(count).getByText('second')).toBeInTheDocument();
  // The control: other numbers take the other form.
  expect(within(count).queryByText('days')).toBeNull();
});

it('stops asking for frames once it is gone', () => {
  const { unmount } = render(<SignedCounter now={() => FLUIDEQ_BEGAN_AT} />);
  expect(frames).toHaveLength(1);
  unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
});
