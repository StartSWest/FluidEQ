/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What's New 2.6's first window: white left of the seam, dark right of it,
 * the seam under the pointer (Ivan picked look A on 2026-11-25). The
 * stylesheet clips the white picture at the seam, so whatever lies right of
 * the seam is the picture under it; what is held here is that the seam
 * stands where the pointer is, and that the white picture is the one laid
 * over the other. Jest gives every image import one stub, so which file is
 * which is read from the files themselves in `tourWindowPictures.test.ts`:
 * the slide shipped with both sides white.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import TourSplitWindow from '../../../renderer/components/featureTour/TourSplitWindow';
import { applyMotionPreference } from '../../../renderer/utils/motionPreference';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const WINDOW_LEFT = 100;
const WINDOW_WIDTH = 800;

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

/** Paints frames until the seam's loop asks for no more. */
const paintUntilSettled = () => {
  for (let frame = 0; frame < 1000 && frames.size > 0; frame += 1) {
    paintFrame();
  }
  expect(frames.size).toBe(0);
};

const renderWindow = () => {
  const view = render(<TourSplitWindow />);
  const frame = view.getByRole('slider');
  const pictures = Array.from(
    frame.querySelectorAll<HTMLImageElement>('.tour-split__picture'),
  );
  return { frame, pictures };
};

const seamOf = (frame: HTMLElement) =>
  parseFloat(frame.style.getPropertyValue('--seam'));

/**
 * jsdom 20 has no PointerEvent, and Testing Library's stand-in for one
 * drops `clientX`; React reads it from any native event of that name.
 */
const movePointerTo = (frame: HTMLElement, share: number) =>
  fireEvent(
    frame,
    new MouseEvent('pointermove', {
      bubbles: true,
      clientX: WINDOW_LEFT + share * WINDOW_WIDTH,
    }),
  );

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

it.each([0.3, 0.72])(
  'stands the seam under a pointer %s of the way across',
  (share) => {
    const { frame } = renderWindow();
    movePointerTo(frame, share);
    paintUntilSettled();
    expect(seamOf(frame)).toBeCloseTo(share * 100, 1);
    expect(frame).toHaveAttribute('aria-valuenow', String(share * 100));
  },
);

it('puts the seam under the pointer at once with Animations off', () => {
  act(() => applyMotionPreference('reduced'));
  const { frame } = renderWindow();
  movePointerTo(frame, 0.3);
  // One painted frame, not a glide: Animations off never animates the seam.
  paintFrame();
  expect(frame.style.getPropertyValue('--seam')).toBe('30.00%');
  expect(frames.size).toBe(0);
});
