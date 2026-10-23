/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, type RefObject } from 'react';
import { stepStudioChatZoom } from './studioChatStore';

/**
 * A mouse wheel's notch: one step of the chat's size per notch, however a
 * touchpad's pinch (which arrives as Ctrl and many small wheel turns) cuts
 * the same movement up.
 */
const NOTCH = 100;

/**
 * Ctrl and the wheel over the chat make its text larger or smaller. The app
 * keeps the wheel off its whole-window zoom on purpose (a slipped modifier
 * mid-drag), but the chat has no slider under the pointer to steal it from.
 * Listened for by hand because a page cannot hold the browser's own zoom
 * back from a passive listener, which is what React attaches.
 */
export default function useChatZoomWheel(
  target: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const element = target.current;
    if (!element) {
      return undefined;
    }
    let turned = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      turned += event.deltaY;
      if (Math.abs(turned) >= NOTCH) {
        stepStudioChatZoom(turned < 0 ? 1 : -1);
        turned = 0;
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [target]);
}
