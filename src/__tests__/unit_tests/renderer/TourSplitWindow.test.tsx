/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What's New 2.6's first window: white left of the seam, dark right of it.
 * The seam moves only when its handle is taken (Ivan, 2026-11-25: "I don't
 * like the mouse moving and turning white or black. Let's make them actually
 * click the handle and drag it if they want"): a pointer passing over the
 * picture, or pressing on it away from the handle, leaves the seam where it
 * is. Until the handle is first taken the seam sweeps by itself; after, it
 * stays where it was left; with Animations off it rests in the middle. The
 * stylesheet clips the white picture at the seam, so whatever lies right of
 * the seam is the picture under it. Jest gives every image import one stub,
 * so which file is which is read from the files themselves in
 * `tourWindowPictures.test.ts`: the slide shipped with both sides white.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import TourSplitWindow from '../../../renderer/components/featureTour/TourSplitWindow';
import { applyMotionPreference } from '../../../renderer/utils/motionPreference';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

const WINDOW_LEFT = 100;
const WINDOW_WIDTH = 800;
/** 3% of the window, which is more than the grip's 20px at 800px. */
const EDGE_PERCENT = 3;

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let clock = 0;

/** Paints the frames asked for so far, 16 ms after the last. */
const paintFrame = () => {
  clock += 16;
  const at = clock;
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(at)));
};

const paintFrames = (count: number) => {
  for (let frame = 0; frame < count; frame += 1) {
    paintFrame();
  }
};

/** Paints frames until the seam's loop asks for no more. */
const paintUntilSettled = () => {
  for (let frame = 0; frame < 1000 && frames.size > 0; frame += 1) {
    paintFrame();
  }
  expect(frames.size).toBe(0);
};

const renderWindow = () => {
  const view = render(<TourSplitWindow />);
  const handle = view.getByRole('slider');
  const frame = view.container.querySelector<HTMLElement>(
    '.tour-split__window',
  );
  if (!frame) {
    throw new Error('the window is missing');
  }
  const pictures = Array.from(
    frame.querySelectorAll<HTMLImageElement>('.tour-split__picture'),
  );
  return { view, frame, handle, pictures };
};

const seamOf = (frame: HTMLElement) =>
  parseFloat(frame.style.getPropertyValue('--seam'));

const xOf = (share: number) => WINDOW_LEFT + share * WINDOW_WIDTH;

/**
 * jsdom 20 has no PointerEvent, and Testing Library's stand-in for one
 * drops `clientX`; React reads `clientX`, `button`, `pointerId` and
 * `isPrimary` from any native event of a pointer event's name.
 */
const pointer = (
  target: Element,
  type: string,
  share: number,
  { pointerId = 1, button = 0 } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: xOf(share),
    button,
  });
  Object.assign(event, { pointerId, isPrimary: true });
  fireEvent(target, event);
};

/** Presses the handle at `from`, drags it to each of `to`, and lets go. */
const dragHandle = (handle: Element, from: number, ...to: number[]) => {
  pointer(handle, 'pointerdown', from);
  to.forEach((share) => pointer(handle, 'pointermove', share));
  pointer(handle, 'pointerup', to[to.length - 1] ?? from);
};

beforeEach(() => {
  frames.clear();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id) => frames.delete(id));
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: WINDOW_LEFT,
        right: WINDOW_LEFT + WINDOW_WIDTH,
        width: WINDOW_WIDTH,
        top: 0,
        bottom: 500,
        height: 500,
        x: WINDOW_LEFT,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect,
  );
  // jsdom has no pointer capture; Chromium does, and the drag needs it to
  // keep coming once the pointer is off the handle.
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
  });
});

afterEach(() => {
  act(() => applyMotionPreference('full'));
  jest.restoreAllMocks();
});

it('lays the white picture, the one clipped at the seam, over the other', () => {
  const { pictures } = renderWindow();
  expect(pictures).toHaveLength(2);
  // The first is drawn underneath and never clipped: it is what shows
  // wherever the white one is cut away, right of the seam.
  expect(pictures[0]).not.toHaveClass('tour-split__picture--white');
  expect(pictures[1]).toHaveClass('tour-split__picture--white');
});

it('is a named slider on the handle, not on the picture', () => {
  const { frame, handle } = renderWindow();
  expect(handle).toHaveClass('tour-split__seam');
  expect(handle).toHaveAttribute('tabindex', '0');
  expect(handle).toHaveAccessibleName('tour.v26.window.seamLabel');
  expect(handle).toHaveAttribute('aria-valuemin', '0');
  expect(handle).toHaveAttribute('aria-valuemax', '100');
  expect(handle).toHaveAttribute('aria-valuenow', '50');
  expect(handle).toHaveAttribute(
    'aria-valuetext',
    'tour.v26.window.seamValue {"percent":50}',
  );
  expect(frame).not.toHaveAttribute('role');
  expect(frame).not.toHaveAttribute('tabindex');
});

it.each([0.3, 0.72])('drags the seam to %s of the way across', (share) => {
  const { frame, handle } = renderWindow();
  dragHandle(handle, 0.5, 0.4, share);
  paintUntilSettled();
  expect(seamOf(frame)).toBeCloseTo(share * 100, 1);
  expect(handle).toHaveAttribute('aria-valuenow', String(share * 100));
  expect(handle).toHaveAttribute(
    'aria-valuetext',
    `tour.v26.window.seamValue {"percent":${share * 100}}`,
  );
  expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
});

it('follows the hand at once, without gliding behind it', () => {
  const { frame, handle } = renderWindow();
  pointer(handle, 'pointerdown', 0.5);
  pointer(handle, 'pointermove', 0.3);
  paintFrame();
  paintFrame();
  expect(seamOf(frame)).toBeCloseTo(30, 1);
});

it('keeps where the grip was taken, so an off-centre press does not jump', () => {
  const { frame, handle } = renderWindow();
  // Pressed 2% right of the seam, still inside the handle's strip.
  dragHandle(handle, 0.52, 0.62);
  paintUntilSettled();
  expect(seamOf(frame)).toBeCloseTo(60, 1);
});

it('keeps dragging past either edge and stops a sliver short of it', () => {
  const { frame, handle } = renderWindow();
  pointer(handle, 'pointerdown', 0.5);
  pointer(handle, 'pointermove', -0.4);
  paintUntilSettled();
  expect(seamOf(frame)).toBeCloseTo(EDGE_PERCENT, 1);
  pointer(handle, 'pointermove', 1.6);
  paintUntilSettled();
  expect(seamOf(frame)).toBeCloseTo(100 - EDGE_PERCENT, 1);
});

it('keeps the grip whole on a narrow window, where 3% is under its reach', () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: WINDOW_LEFT,
        right: WINDOW_LEFT + 400,
        width: 400,
        top: 0,
        bottom: 250,
        height: 250,
        x: WINDOW_LEFT,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect,
  );
  const { frame, handle } = renderWindow();
  fireEvent.keyDown(handle, { key: 'Home' });
  paintUntilSettled();
  // 20px of 400 is 5%, past the 3% a wide window stops at.
  expect(seamOf(frame)).toBeCloseTo(5, 1);
});

it('stops following once the button is let go', () => {
  const { frame, handle } = renderWindow();
  dragHandle(handle, 0.5, 0.35);
  pointer(handle, 'pointermove', 0.8);
  paintUntilSettled();
  expect(seamOf(frame)).toBeCloseTo(35, 1);
});

it('leaves the seam where it is under a pointer passing over the window', () => {
  act(() => applyMotionPreference('reduced'));
  const { frame, pictures } = renderWindow();
  paintUntilSettled();
  pointer(frame, 'pointerover', 0.2);
  pointer(pictures[1], 'pointermove', 0.2);
  pointer(pictures[1], 'pointermove', 0.85);
  paintFrames(5);
  expect(seamOf(frame)).toBe(50);
});

it('leaves the seam where it is when the picture is pressed and dragged away from the handle', () => {
  act(() => applyMotionPreference('reduced'));
  const { frame, pictures } = renderWindow();
  paintUntilSettled();
  pointer(pictures[0], 'pointerdown', 0.8);
  pointer(pictures[0], 'pointermove', 0.3);
  pointer(pictures[0], 'pointerup', 0.3);
  fireEvent.click(pictures[0]);
  paintFrames(5);
  expect(seamOf(frame)).toBe(50);
});

it('does not follow a pointer over the window while it sweeps', () => {
  const { frame } = renderWindow();
  pointer(frame, 'pointermove', 0.1);
  paintFrames(20);
  // 0.32 s into a 22 s sweep, a hair right of the middle: nowhere near 10%.
  expect(seamOf(frame)).toBeGreaterThan(49);
  expect(seamOf(frame)).toBeLessThan(53);
});

it('ignores a press with any button but the main one', () => {
  act(() => applyMotionPreference('reduced'));
  const { frame, handle } = renderWindow();
  paintUntilSettled();
  pointer(handle, 'pointerdown', 0.5, { button: 2 });
  pointer(handle, 'pointermove', 0.2, { button: 2 });
  paintFrames(3);
  expect(seamOf(frame)).toBe(50);
});

describe('from the keyboard', () => {
  it.each([
    ['ArrowLeft', 45],
    ['ArrowDown', 45],
    ['ArrowRight', 55],
    ['ArrowUp', 55],
    ['PageDown', 30],
    ['PageUp', 70],
    ['Home', EDGE_PERCENT],
    ['End', 100 - EDGE_PERCENT],
  ])('%s moves the seam to %s', (key, percent) => {
    const { frame, handle } = renderWindow();
    fireEvent.keyDown(handle, { key });
    paintUntilSettled();
    expect(seamOf(frame)).toBeCloseTo(percent, 1);
    expect(handle).toHaveAttribute('aria-valuenow', String(percent));
  });

  it('keeps the arrows from walking the tour to another slide', () => {
    const { handle } = renderWindow();
    // The tour listens on the document (`FeatureTour`).
    const onTourKey = jest.fn();
    document.addEventListener('keydown', onTourKey);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onTourKey).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: 'Tab' });
    expect(onTourKey).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', onTourKey);
  });

  it('steps from where the last step went, not from where the glide is', () => {
    const { frame, handle } = renderWindow();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    paintUntilSettled();
    expect(seamOf(frame)).toBeCloseTo(60, 1);
  });
});

describe('the sweep', () => {
  it('moves the seam by itself until the handle is taken', () => {
    const { frame } = renderWindow();
    // A quarter of the way through its 22 s, the sweep is at its reach.
    paintFrames(Math.round(5500 / 16));
    expect(seamOf(frame)).toBeCloseTo(74, 0);
    expect(frames.size).toBe(1);
  });

  it('stops for good where the reader let go', () => {
    const { frame, handle } = renderWindow();
    paintFrames(100);
    // Taken where the sweep has brought it, a tenth right of the middle.
    const at = seamOf(frame) / 100;
    expect(at).toBeGreaterThan(0.58);
    dragHandle(handle, at, 0.4);
    paintUntilSettled();
    // Within the pixel the press was rounded to: a pointer stands on whole
    // pixels, an eighth of a percent of this window.
    const left = seamOf(frame);
    expect(left).toBeCloseTo(40, 0);
    // Leaving the handle and moving off it never brings the sweep back.
    fireEvent.pointerLeave(handle);
    fireEvent.blur(handle);
    paintFrames(50);
    expect(frames.size).toBe(0);
    expect(seamOf(frame)).toBe(left);
  });

  it('stops for good after a key', () => {
    const { frame, handle } = renderWindow();
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.blur(handle);
    paintUntilSettled();
    expect(seamOf(frame)).toBeCloseTo(45, 1);
  });

  it('waits while the pointer is on the handle, and goes on after', () => {
    const { frame, handle } = renderWindow();
    paintFrames(100);
    fireEvent.pointerEnter(handle);
    paintUntilSettled();
    const waited = seamOf(frame);
    expect(waited).toBeGreaterThan(51);
    fireEvent.pointerLeave(handle);
    expect(frames.size).toBe(1);
    paintFrames(100);
    expect(seamOf(frame)).toBeGreaterThan(waited);
  });

  it('waits while the handle has focus, and goes on after', () => {
    const { frame, handle } = renderWindow();
    paintFrames(100);
    fireEvent.focus(handle);
    paintUntilSettled();
    const waited = seamOf(frame);
    fireEvent.blur(handle);
    expect(frames.size).toBe(1);
    paintFrames(100);
    expect(seamOf(frame)).toBeGreaterThan(waited);
  });
});

describe('with Animations off', () => {
  beforeEach(() => act(() => applyMotionPreference('reduced')));

  it('rests in the middle and never sweeps', () => {
    const { frame, handle } = renderWindow();
    paintFrame();
    expect(frames.size).toBe(0);
    expect(seamOf(frame)).toBe(50);
    expect(handle).toHaveAttribute('aria-valuenow', '50');
  });

  it('puts the seam under the dragging hand in one frame', () => {
    const { frame, handle } = renderWindow();
    paintUntilSettled();
    pointer(handle, 'pointerdown', 0.5);
    pointer(handle, 'pointermove', 0.3);
    paintFrame();
    expect(frame.style.getPropertyValue('--seam')).toBe('30.00%');
    expect(frames.size).toBe(0);
  });

  it('steps a key in one frame, without a glide', () => {
    const { frame, handle } = renderWindow();
    paintUntilSettled();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    paintFrame();
    expect(frame.style.getPropertyValue('--seam')).toBe('55.00%');
    expect(frames.size).toBe(0);
  });
});
