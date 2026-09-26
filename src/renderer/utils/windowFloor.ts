/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { subscribeTheme } from './theme';

/**
 * Tells the native window what colour the shell's floor is.
 *
 * Two moments show the window's own background with no page in front of it:
 * the frames before the first paint at launch, and the strip Windows opens as
 * the window is resized — which the switch between the app and the player does
 * in one step. Both are the whole window, and with a transparent background
 * both read as an empty pane of glass (Ivan, 2026-09-22). Painted in the
 * shell's own floor they read as the app, a moment before its contents arrive.
 *
 * Read back off `#root` rather than listed here. That element's background IS
 * the floor, so this is the one value by construction instead of a copy that
 * can drift — and because it is read after the cascade it is already resolved
 * to `rgb(...)`, whatever a theme wrote it as. A scene tint that repaints the
 * shell is carried for free.
 */
const RGB = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/;

const hex = (value: number) => value.toString(16).padStart(2, '0');

/** `#rrggbb`, or nothing at all if the floor cannot be read yet. */
export const readWindowFloor = (): string | undefined => {
  const root = document.getElementById('root');
  if (!root) {
    return undefined;
  }
  const match = RGB.exec(getComputedStyle(root).backgroundColor);
  if (!match) {
    return undefined;
  }
  return `#${hex(Number(match[1]))}${hex(Number(match[2]))}${hex(
    Number(match[3]),
  )}`;
};

/**
 * Publishes it on mount and whenever the theme's slider moves, at most once a
 * frame.
 *
 * Subscribed to the theme's store directly rather than through a hook: the
 * hook re-rendered the component it lived in, which is the app's own root,
 * so every step of a Brightness drag re-rendered the whole window — every
 * knob and switch rewritten — to send one colour to the main process. A
 * frame's worth of steps send one, read in the frame after the change, once
 * the cascade has applied it.
 *
 * On mount in an effect rather than beside the attribute the theme writes:
 * the theme is applied as soon as its module loads, which in development is
 * before style-loader has put the stylesheet in the document, and the floor
 * would read as whatever an unstyled page computes. An effect runs after the
 * cascade has, every time.
 */
const publishFloor = () => {
  const floor = readWindowFloor();
  if (!floor) {
    return;
  }
  // Every optional link is deliberate: tests stub the bridge with a handful
  // of methods, and the window's background is not worth taking a render
  // down for.
  window.electron?.ipcRenderer?.setWindowFloor?.(floor)?.catch(() => undefined);
};

const useWindowFloor = () => {
  useEffect(() => {
    publishFloor();
    let frame = 0;
    const unsubscribe = subscribeTheme(() => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          publishFloor();
        });
      }
    });
    return () => {
      unsubscribe();
      window.cancelAnimationFrame(frame);
    };
  }, []);
};

export default useWindowFloor;
