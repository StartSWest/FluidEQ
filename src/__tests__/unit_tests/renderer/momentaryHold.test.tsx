/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Something shown for a moment, taken down by its own hold animation's end.
 *
 * The look's name on the graph and the titlebar wave's style name were each
 * taken down by a two-second timer. jsdom plays no animations, so the running
 * hold is a stand-in here, found the way the browser's would be: through
 * `getAnimations()`.
 */

import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import useMomentaryHold from 'renderer/utils/useMomentaryHold';

const HOLD = 'test-hold';

let playing: { animationName: string; currentTime: number }[] = [];

let show: () => void = () => undefined;

function Pill() {
  const hold = useMomentaryHold<HTMLSpanElement>(HOLD);
  useEffect(() => {
    show = hold.show;
  }, [hold.show]);
  return (
    <span
      ref={hold.ref}
      data-testid="pill"
      data-shown={hold.isShown}
      onAnimationEnd={hold.onAnimationEnd}
    >
      <span data-testid="inside" />
    </span>
  );
}

const shown = (element: HTMLElement) => element.dataset.shown === 'true';

/** jsdom has no AnimationEvent, so the name is put on a plain one. */
const animationEvent = (type: string, target: Element, name: string) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { animationName: name });
  act(() => {
    target.dispatchEvent(event);
  });
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  playing = [];
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => playing,
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  jest.useRealTimers();
});

it('stays up, with no timer, until its own hold ends', () => {
  playing = [{ animationName: HOLD, currentTime: 0 }];
  const { getByTestId } = render(<Pill />);
  const pill = getByTestId('pill');
  act(() => show());
  expect(shown(pill)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);

  // NULL: something else's animation, and a child's, are not the moment.
  animationEvent('animationend', pill, 'something-else');
  animationEvent('animationend', getByTestId('inside'), HOLD);
  expect(shown(pill)).toBe(true);

  // POSITIVE CONTROL: its own hold ending takes it down.
  animationEvent('animationend', pill, HOLD);
  expect(shown(pill)).toBe(false);
});

it('starts the hold over when shown again', () => {
  const hold = { animationName: HOLD, currentTime: 1500 };
  playing = [hold];
  render(<Pill />);
  act(() => show());
  hold.currentTime = 1500;
  act(() => show());
  expect(hold.currentTime).toBe(0);
});

it('comes down when the hold is cancelled, as hiding the element does', () => {
  playing = [{ animationName: HOLD, currentTime: 0 }];
  const { getByTestId } = render(<Pill />);
  const pill = getByTestId('pill');
  act(() => show());
  expect(shown(pill)).toBe(true);
  animationEvent('animationcancel', pill, HOLD);
  expect(shown(pill)).toBe(false);
});

it('comes down at once when nothing plays, rather than waiting for an end that is not coming', () => {
  const { getByTestId } = render(<Pill />);
  act(() => show());
  expect(shown(getByTestId('pill'))).toBe(false);
});
