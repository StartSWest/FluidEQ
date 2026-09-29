/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGestureSource, TSceneGesture } from './sceneInteraction';

/** A press that moves less than this is a tap, not a drag. */
const TAP_TRAVEL_PX = 6;

/** Controls are the app's: a click on one is never a tap on the picture. */
const CONTROLS =
  'button, input, select, textarea, a, label, [role="slider"], [role="menu"], [role="dialog"]';

const listeners = new Set<(gesture: TSceneGesture) => void>();
let last: { x: number; y: number } | undefined;
let press: { x: number; y: number; onControl: boolean } | undefined;

const tell = (gesture: TSceneGesture) =>
  listeners.forEach((listener) => listener(gesture));

const onMove = (event: PointerEvent) => {
  if (last) {
    tell({
      kind: 'move',
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - last.x,
      dy: event.clientY - last.y,
    });
  }
  last = { x: event.clientX, y: event.clientY };
};

const onDown = (event: PointerEvent) => {
  press =
    event.button === 0
      ? {
          x: event.clientX,
          y: event.clientY,
          onControl:
            event.target instanceof Element &&
            Boolean(event.target.closest(CONTROLS)),
        }
      : undefined;
};

const onUp = (event: PointerEvent) => {
  const was = press;
  press = undefined;
  if (
    was &&
    !was.onControl &&
    Math.hypot(event.clientX - was.x, event.clientY - was.y) < TAP_TRAVEL_PX
  ) {
    tell({ kind: 'tap', x: event.clientX, y: event.clientY });
  }
};

const onLeave = () => {
  last = undefined;
};

/**
 * The mouse anywhere over the window, for what a visualizer drawn behind the
 * whole window throws from it (the Backdrop, where the picture is behind the
 * app's glass and the hand is over the app): a trail wherever it goes, a
 * burst where it is clicked on anything but a control - a click on a button
 * is the button's. Heard on the window in the capture phase, passively, so
 * nothing the app does with the same events is touched or delayed; the
 * listeners are there only while something is listening.
 */
const windowGestures: TGestureSource = (listener) => {
  if (listeners.size === 0) {
    window.addEventListener('pointermove', onMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointerdown', onDown, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointerup', onUp, {
      capture: true,
      passive: true,
    });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      document.documentElement.removeEventListener('pointerleave', onLeave);
      last = undefined;
      press = undefined;
    }
  };
};

export default windowGestures;
