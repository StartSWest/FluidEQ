/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createSceneInteraction } from 'renderer/graph/sceneInteraction';

/**
 * A 3D scene's camera turns only with Ctrl and a drag, and moves in and out
 * only with Ctrl and the wheel (Ivan, 2026-11-08: "cannot move just with
 * mouse move only when control click so double click goes full screen too",
 * "same for zoom with control scroll"). A plain drag, click, double click or
 * wheel goes on to the surface untouched.
 */

/** jsdom has no PointerEvent: a mouse event that carries a pointer's fields. */
const pointer = (
  type: string,
  x: number,
  y: number,
  init: { buttons?: number; ctrlKey?: boolean; button?: number } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
    ctrlKey: init.ctrlKey ?? false,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
};

const box = { left: 0, top: 0, width: 400, height: 200 } as DOMRect;
const LIMITS = {
  yaw: [-1, 1] as const,
  pitch: [-0.5, 0.5] as const,
  zoom: [0.5, 2] as const,
};

const setUp = () => {
  const panel = document.createElement('div');
  document.body.append(panel);
  // jsdom has no pointer capture.
  Object.assign(panel, {
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
  const hands = createSceneInteraction();
  hands.setLimits(LIMITS);
  const detach = hands.attach(panel, { frame: () => box });
  const panelHeard: string[] = [];
  ['pointerdown', 'dblclick'].forEach((type) =>
    panel.addEventListener(type, () => panelHeard.push(type)),
  );
  const drag = (ctrlKey: boolean) => {
    panel.dispatchEvent(
      pointer('pointerdown', 200, 100, { buttons: 1, ctrlKey }),
    );
    panel.dispatchEvent(
      pointer('pointermove', 260, 120, { buttons: 1, ctrlKey }),
    );
    panel.dispatchEvent(pointer('pointerup', 260, 120, { ctrlKey }));
    hands.read(16);
  };
  const wheel = (ctrlKey: boolean) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: -300,
      ctrlKey,
    });
    panel.dispatchEvent(event);
    hands.read(16);
    return event;
  };
  return { panel, hands, detach, panelHeard, drag, wheel };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('the camera of a scene that can be turned', () => {
  it('stays where it is under a plain drag, which the surface hears', () => {
    const { hands, drag, panelHeard, detach } = setUp();
    drag(false);
    expect(hands.moved()).toBe(false);
    expect(panelHeard).toContain('pointerdown');
    detach();
  });

  // The control beside it: the same drag with Ctrl turns it, and the press is
  // the scene's alone.
  it('turns under Ctrl and a drag', () => {
    const { hands, drag, panelHeard, detach } = setUp();
    drag(true);
    expect(hands.moved()).toBe(true);
    expect(panelHeard).not.toContain('pointerdown');
    detach();
  });

  it('moves in only with Ctrl and the wheel', () => {
    const { hands, wheel, detach } = setUp();
    const plain = wheel(false);
    expect(hands.moved()).toBe(false);
    expect(plain.defaultPrevented).toBe(false);
    const withCtrl = wheel(true);
    expect(hands.moved()).toBe(true);
    expect(withCtrl.defaultPrevented).toBe(true);
    detach();
  });

  it('lets a plain double click through to the surface', () => {
    const { panel, panelHeard, hands, detach } = setUp();
    panel.dispatchEvent(pointer('pointerdown', 200, 100, { buttons: 1 }));
    panel.dispatchEvent(pointer('pointerup', 200, 100));
    panel.dispatchEvent(pointer('dblclick', 200, 100));
    expect(panelHeard).toEqual(['pointerdown', 'dblclick']);
    expect(hands.moved()).toBe(false);
    detach();
  });

  it('turns under no other button, Ctrl or not', () => {
    const { panel, hands, detach } = setUp();
    panel.dispatchEvent(
      pointer('pointerdown', 200, 100, {
        buttons: 2,
        button: 2,
        ctrlKey: true,
      }),
    );
    panel.dispatchEvent(
      pointer('pointermove', 260, 120, { buttons: 2, ctrlKey: true }),
    );
    panel.dispatchEvent(pointer('pointerup', 260, 120, { button: 2 }));
    hands.read(16);
    expect(hands.moved()).toBe(false);
    detach();
  });

  it('shows the open hand only while Ctrl is held over it', () => {
    const { panel, detach } = setUp();
    panel.dispatchEvent(pointer('pointermove', 200, 100));
    expect(panel.dataset.sceneHand).toBeUndefined();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }),
    );
    expect(panel.dataset.sceneHand).toBe('grab');
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    expect(panel.dataset.sceneHand).toBeUndefined();
    detach();
  });
});
