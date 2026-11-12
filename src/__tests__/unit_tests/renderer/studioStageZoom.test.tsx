/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A closer look at the Studio's stage (`useStageZoom.ts`; Ivan, 2026-11-08:
 * "control scroll or add icons on top, zoom the scene, space pan scene that
 * is zoomed"): Ctrl with the wheel zooms about the pointer, the buttons step,
 * Space held moves the zoomed view and the scene's hands never hear that
 * press — and an unzoomed stage takes nothing from the keyboard.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import StudioStageZoom from '../../../renderer/studio/StudioStageZoom';
import useStageZoom from '../../../renderer/studio/useStageZoom';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.assign(window, { PointerEvent: TestPointerEvent });
  }
});

/** What the scene's own hands heard: a press on the stage inside. */
const heard = jest.fn();

/**
 * A stage of 800 by 450, the way `StudioStage` lays its parts; `least` under
 * 1 is Edit mode's canvas, as the stage asks for it while Edit is on.
 */
function Stage({ least = 1 }: { least?: number }) {
  const well = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const zoom = useStageZoom(well, screenRef, 800, 450, least);
  return (
    <div ref={well} data-testid="well">
      <div
        data-testid="stage"
        ref={(element) => {
          // The scene's hands listen on the stage, in the capture phase.
          element?.addEventListener('pointerdown', heard, { capture: true });
        }}
      >
        <div ref={screenRef} data-testid="screen">
          <span data-testid="view" data-panning={zoom.panning}>
            {zoom.view.scale.toFixed(2)} {Math.round(zoom.view.x)}{' '}
            {Math.round(zoom.view.y)}
          </span>
        </div>
      </div>
      <StudioStageZoom zoom={zoom} />
    </div>
  );
}

beforeEach(() => {
  heard.mockClear();
  Element.prototype.setPointerCapture = jest.fn();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 450,
    width: 800,
    height: 450,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const view = () => screen.getByTestId('view').textContent;

it('zooms about the pointer with Ctrl and the wheel, and leaves the plain wheel to the scene', () => {
  render(<Stage />);
  const stage = screen.getByTestId('stage');
  // A plain wheel is the camera's: nothing here takes it.
  expect(fireEvent.wheel(stage, { deltaY: -100 })).toBe(true);
  expect(view()).toBe('1.00 0 0');
  // Ctrl and a notch in at the left edge: that edge stays where it was.
  fireEvent.wheel(stage, {
    deltaY: -500,
    ctrlKey: true,
    clientX: 0,
    clientY: 225,
  });
  const [scale, x] = String(view()).split(' ').map(Number);
  expect(scale).toBeCloseTo(Math.exp(1), 1);
  expect(x).toBe(0);
});

it('steps with its buttons, says how close, and fits again from the figure', () => {
  render(<Stage />);
  expect(
    screen.queryByRole('button', { name: /studio.picture.fit/ }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  expect(view()).toBe('2.00 -400 -225');
  const figure = screen.getByRole('button', { name: /studio.picture.fit/ });
  expect(figure).toHaveTextContent('studio.framing.percent 200');
  fireEvent.click(figure);
  expect(view()).toBe('1.00 0 0');
  expect(
    screen.getByRole('button', { name: 'studio.picture.zoomOut' }),
  ).toHaveAttribute('aria-disabled', 'true');
});

it('moves a zoomed view with Space held, and the scene never hears that press', () => {
  render(<Stage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  act(() => {
    fireEvent.keyDown(document, { code: 'Space', key: ' ' });
  });
  const stage = screen.getByTestId('stage');
  fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(stage, { clientX: 500, clientY: 260 });
  fireEvent.pointerUp(stage, { clientX: 500, clientY: 260 });
  expect(view()).toBe('2.00 -300 -165');
  expect(heard).not.toHaveBeenCalled();
  act(() => {
    fireEvent.keyUp(document, { code: 'Space', key: ' ' });
  });
  // The control: the same press with Space let go is the scene's.
  fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 200 });
  expect(heard).toHaveBeenCalled();
});

it('takes no Space while the stage is not zoomed', () => {
  render(<Stage />);
  // Not prevented: a stage at its whole picture leaves the key alone.
  expect(fireEvent.keyDown(document, { code: 'Space', key: ' ' })).toBe(true);
  fireEvent.keyUp(document, { code: 'Space', key: ' ' });
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  expect(fireEvent.keyDown(document, { code: 'Space', key: ' ' })).toBe(false);
});

// Ivan, 2026-11-11: "if the user hits space while in the editor, show the
// hand cursor so they can move the scene".
it("moves the scene on Edit mode's canvas with Space held, at its own size", () => {
  render(<Stage least={0.25} />);
  const stage = screen.getByTestId('stage');
  act(() => {
    // Taken from the page: no button pressed, no music started or stopped.
    expect(fireEvent.keyDown(document, { code: 'Space', key: ' ' })).toBe(
      false,
    );
  });
  // The stage says the hand is the view's, which the cursor follows.
  expect(screen.getByTestId('view')).toHaveAttribute('data-panning', 'true');
  fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(stage, { clientX: 300, clientY: 260 });
  fireEvent.pointerUp(stage, { clientX: 300, clientY: 260 });
  expect(view()).toBe('1.00 -100 60');
  // Nothing under the hand was picked or moved.
  expect(heard).not.toHaveBeenCalled();
  // However far it goes, a fifth of the scene stays on screen to grab.
  fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(stage, { clientX: 4000, clientY: 200 });
  fireEvent.pointerUp(stage, { clientX: 4000, clientY: 200 });
  expect(view()).toBe('1.00 640 60');
  act(() => {
    fireEvent.keyUp(document, { code: 'Space', key: ' ' });
  });
  expect(screen.getByTestId('view')).toHaveAttribute('data-panning', 'false');
  // A space typed into a field is a space.
  const field = document.createElement('input');
  document.body.append(field);
  expect(fireEvent.keyDown(field, { code: 'Space', key: ' ' })).toBe(true);
  expect(screen.getByTestId('view')).toHaveAttribute('data-panning', 'false');
  field.remove();
});

it('lays the scene back on the screen when Edit mode ends', () => {
  const { rerender } = render(<Stage least={0.25} />);
  const stage = screen.getByTestId('stage');
  act(() => {
    fireEvent.keyDown(document, { code: 'Space', key: ' ' });
  });
  fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(stage, { clientX: 300, clientY: 260 });
  fireEvent.pointerUp(stage, { clientX: 300, clientY: 260 });
  act(() => {
    fireEvent.keyUp(document, { code: 'Space', key: ' ' });
  });
  expect(view()).toBe('1.00 -100 60');
  rerender(<Stage />);
  expect(view()).toBe('1.00 0 0');
});
