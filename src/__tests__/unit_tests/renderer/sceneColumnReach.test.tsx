/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import { useState } from 'react';
import useSceneColumnReach, {
  nextSceneColumnReach,
} from '../../../renderer/graph/useSceneColumnReach';
import { SCENE_SETTLED_EVENT } from '../../../renderer/graph/sceneCanvasHold';
import { setScenePanelsSeeThrough } from '../../../renderer/utils/scenePanels';

let reduced = false;
jest.mock('../../../renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => reduced,
}));

/**
 * The EQ column's scene runs on under the bands' card only while See through
 * is over 0, and the strip it adds there is shown only once a frame drawn for
 * the taller box is on the canvas, then faded in; going back to 0 it fades
 * out before the layer is cut back. It used to come in with the box, the old
 * shorter picture stretched over it for up to a second (Ivan, 2026-11-25:
 * "the scene kind of stretches out for a second to be able to draw into the
 * equalizer").
 */

/** The layer, as `SceneColumnLayer` renders it, with a canvas inside. */
const Layer = () => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const reach = useSceneColumnReach(layer);
  return (
    <div
      ref={setLayer}
      data-testid="layer"
      data-reach={reach === 'off' ? undefined : reach}
    >
      <canvas data-testid="canvas" />
    </div>
  );
};

const boxOf = (element: Element, height: number) => {
  jest
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue({ height } as DOMRect);
};

/** The canvas settles into a box `height` rows tall. */
const settle = (canvas: Element, height: number) => {
  boxOf(canvas, height);
  act(() => {
    canvas.dispatchEvent(new Event(SCENE_SETTLED_EVENT, { bubbles: true }));
  });
};

/** The strip's fade has run to `shown`, as the stylesheet ends it. */
const fade = (layer: HTMLElement, shown: number) => {
  layer.style.setProperty('--scene-reach', String(shown));
  const ended = new Event('transitionend');
  Object.defineProperty(ended, 'propertyName', { value: '--scene-reach' });
  act(() => {
    layer.dispatchEvent(ended);
  });
};

const through = (value: number) =>
  act(() => {
    setScenePanelsSeeThrough(value);
  });

beforeEach(() => {
  reduced = false;
  setScenePanelsSeeThrough(0);
});

it('hides the strip under the card until a frame for the taller box is on the canvas, then fades it in', () => {
  const { getByTestId } = render(<Layer />);
  const layer = getByTestId('layer');
  const canvas = getByTestId('canvas');
  // At 0 the layer stops at the row's foot: nothing under the card is drawn.
  expect(layer.dataset.reach).toBeUndefined();

  boxOf(layer, 700);
  through(1);
  // Reaching, the strip hidden: the picture on the canvas is still the one
  // drawn for the shorter box.
  expect(layer.dataset.reach).toBe('arriving');
  // A frame settling for the box the layer had before it reached is no
  // picture under the card.
  settle(canvas, 300);
  expect(layer.dataset.reach).toBe('arriving');
  settle(canvas, 700);
  expect(layer.dataset.reach).toBe('revealing');
  fade(layer, 1);
  expect(layer.dataset.reach).toBe('on');

  // Moving the slider between values over 0 restarts nothing.
  through(30);
  expect(layer.dataset.reach).toBe('on');
  settle(canvas, 700);
  expect(layer.dataset.reach).toBe('on');
});

it('fades the strip out before the layer is cut back at 0', () => {
  setScenePanelsSeeThrough(20);
  const { getByTestId } = render(<Layer />);
  const layer = getByTestId('layer');
  expect(layer.dataset.reach).toBe('on');
  through(0);
  // Still reaching while it fades: drawn until it is out of sight.
  expect(layer.dataset.reach).toBe('leaving');
  // Turned up again mid-fade: back at once, the picture is still there.
  through(5);
  expect(layer.dataset.reach).toBe('revealing');
  through(0);
  // The end of the fade that was reversed is not this one's.
  fade(layer, 1);
  expect(layer.dataset.reach).toBe('leaving');
  fade(layer, 0);
  expect(layer.dataset.reach).toBeUndefined();
});

it('shows the strip once drawn and takes it away at once with Animations off', () => {
  reduced = true;
  const { getByTestId } = render(<Layer />);
  const layer = getByTestId('layer');
  const canvas = getByTestId('canvas');
  boxOf(layer, 700);
  through(10);
  expect(layer.dataset.reach).toBe('arriving');
  settle(canvas, 700);
  expect(layer.dataset.reach).toBe('on');
  through(0);
  expect(layer.dataset.reach).toBeUndefined();
});

it('lets a strip never shown go at once', () => {
  expect(
    nextSceneColumnReach('arriving', {
      kind: 'through',
      through: false,
      still: false,
    }),
  ).toBe('off');
  // And a picture settling while the layer reaches nowhere is nothing.
  expect(nextSceneColumnReach('off', { kind: 'settled', still: false })).toBe(
    'off',
  );
});
