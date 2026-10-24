/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IWindowState } from 'common/windowMode';

/**
 * A Linux configure can reach Chromium while the native-size request is
 * still crossing IPC. Listening only after that answer missed the last
 * resize and left the player dark forever. Subscribe before asking, then
 * ask again only when an actual resize made that answer stale.
 */
const untilLinuxViewportIsWindow = async (
  read: () => Promise<IWindowState>,
): Promise<void> => {
  for (;;) {
    let didResize = false;
    let changed: () => void = () => undefined;
    const resized = new Promise<void>((resolve) => {
      changed = () => {
        didResize = true;
        resolve();
      };
    });
    window.addEventListener('resize', changed, { once: true });
    try {
      const state = await read().catch(() => undefined);
      if (!state?.contentSize) {
        return;
      }
      const zoom = state.zoom > 0 ? state.zoom : 1;
      if (
        Math.abs(window.innerWidth - state.contentSize.width / zoom) <= 1 &&
        Math.abs(window.innerHeight - state.contentSize.height / zoom) <= 1
      ) {
        return;
      }
      if (!didResize) {
        await resized;
      }
    } finally {
      window.removeEventListener('resize', changed);
    }
  }
};

export default untilLinuxViewportIsWindow;
