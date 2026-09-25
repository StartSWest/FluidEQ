/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Smart EQ remark is said, then gone — and what takes it down is the end of
 * the hold on the element showing it, never a clock. It was a six-second timer
 * in the engine, which ran whether or not anything was drawn, so a remark made
 * behind a minimised window was gone before anybody looked.
 *
 * jsdom runs no animations, so the hold's end is fired by hand here; its
 * length is the stylesheet's and is held by `momentHolds.test.ts`.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  endSmartEqStatus,
  setSmartEqStatus,
  useSmartEqStatus,
} from 'renderer/utils/smartEqRun';
import isOwnAnimationEnd from 'renderer/utils/ownAnimationEnd';

/** Stands in for the bubble and the player's line, which show it the same way. */
const Remark = () => {
  const status = useSmartEqStatus();
  if (!status) {
    return null;
  }
  return (
    <span
      key={status.id}
      role="status"
      onAnimationEnd={(event) => {
        if (isOwnAnimationEnd(event, 'smart-eq-status-hold')) {
          endSmartEqStatus(status.id);
        }
      }}
    >
      {status.text}
    </span>
  );
};

/** jsdom's AnimationEvent drops `animationName`, so it is put on by hand. */
const endAnimation = (animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  fireEvent(screen.getByRole('status'), event);
};

const holdEnds = () => endAnimation('smart-eq-status-hold');

afterEach(() => {
  act(() => setSmartEqStatus(''));
});

it('stays up until its hold has been shown, and no clock is set', () => {
  render(<Remark />);
  act(() => setSmartEqStatus('Balanced'));

  expect(screen.getByRole('status')).toHaveTextContent('Balanced');
  expect(jest.getTimerCount()).toBe(0);

  act(() => holdEnds());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('ignores the end of an animation that is not the hold', () => {
  render(<Remark />);
  act(() => setSmartEqStatus('Balanced'));

  act(() => endAnimation('pop-in'));
  expect(screen.getByRole('status')).toHaveTextContent('Balanced');
});

it('lets a newer remark keep its whole moment when an older one ends', () => {
  const seen: number[] = [];
  const Ids = () => {
    const status = useSmartEqStatus();
    if (status && !seen.includes(status.id)) {
      seen.push(status.id);
    }
    return null;
  };
  render(
    <>
      <Remark />
      <Ids />
    </>,
  );
  act(() => setSmartEqStatus('Listening 10%'));
  act(() => setSmartEqStatus('Listening 20%'));
  expect(seen).toHaveLength(2);

  // The first remark's hold ending late, by its own id, is not the second's.
  act(() => endSmartEqStatus(seen[0]));
  expect(screen.getByRole('status')).toHaveTextContent('Listening 20%');

  // The positive control: the second's own id does end it.
  act(() => endSmartEqStatus(seen[1]));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('starts no new moment for the same words said again', () => {
  render(<Remark />);
  act(() => setSmartEqStatus('Already balanced'));
  const shown = screen.getByRole('status');
  act(() => setSmartEqStatus('Already balanced'));

  expect(screen.getByRole('status')).toBe(shown);
});

it('is over when said with nothing mounted to show it', () => {
  act(() => setSmartEqStatus('Balanced'));
  render(<Remark />);

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('is over when the last thing showing it goes', () => {
  const { unmount } = render(<Remark />);
  act(() => setSmartEqStatus('Balanced'));
  unmount();

  render(<Remark />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
